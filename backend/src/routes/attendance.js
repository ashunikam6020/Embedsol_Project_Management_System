const router = require('express').Router();
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { bad, notFound, todayLocal } = require('../utils/http');
const audit = require('../utils/audit');

router.use(authenticate);

router.get('/today', async (req, res) => {
  const employeeId = req.user.role === 'ADMIN' && req.query.employee_id ? Number(req.query.employee_id) : req.user.employeeId;
  if (!employeeId) return res.json({ success: true, data: null });
  const rows = await db.q(
    `SELECT a.*, e.full_name FROM attendance a JOIN employees e ON e.id=a.employee_id
     WHERE a.employee_id=? AND a.attendance_date=? LIMIT 1`, [employeeId, todayLocal()]
  );
  res.json({ success: true, data: rows[0] || null });
});

router.get('/', requireAdmin, async (req, res) => {
  const { from, to, employee_id } = req.query;
  const where = []; const params = [];
  if (from) { where.push('a.attendance_date >= ?'); params.push(from); }
  if (to) { where.push('a.attendance_date <= ?'); params.push(to); }
  if (employee_id) { where.push('a.employee_id = ?'); params.push(employee_id); }
  const rows = await db.q(`SELECT a.*, e.full_name, e.employee_code FROM attendance a
    JOIN employees e ON e.id=a.employee_id ${where.length ? 'WHERE '+where.join(' AND ') : ''}
    ORDER BY a.attendance_date DESC, e.full_name`, params);
  res.json({ success: true, data: rows });
});

router.post('/check-in', async (req, res) => {
  if (!req.user.employeeId) throw bad('Only employee accounts can check in');
  const today = todayLocal();
  const existing = await db.q('SELECT * FROM attendance WHERE employee_id=? AND attendance_date=?', [req.user.employeeId, today]);
  if (existing[0]?.check_in) throw bad('Already checked in today');
  if (existing[0]) {
    await db.q('UPDATE attendance SET check_in=NOW(), status=? WHERE id=?', ['PRESENT', existing[0].id]);
  } else {
    await db.q('INSERT INTO attendance (employee_id, attendance_date, check_in, status) VALUES (?, ?, NOW(), ?)', [req.user.employeeId, today, 'PRESENT']);
  }
  await audit(req.user.id, 'CHECK_IN', 'ATTENDANCE', req.user.employeeId);
  res.json({ success: true, message: 'Check-in recorded' });
});

router.post('/check-out', async (req, res) => {
  if (!req.user.employeeId) throw bad('Only employee accounts can check out');
  const rows = await db.q('SELECT * FROM attendance WHERE employee_id=? AND attendance_date=?', [req.user.employeeId, todayLocal()]);
  if (!rows[0]?.check_in) throw bad('Please check in first');
  if (rows[0].check_out) throw bad('Already checked out today');
  await db.q('UPDATE attendance SET check_out=NOW() WHERE id=?', [rows[0].id]);
  await audit(req.user.id, 'CHECK_OUT', 'ATTENDANCE', req.user.employeeId);
  res.json({ success: true, message: 'Check-out recorded' });
});

module.exports = router;
