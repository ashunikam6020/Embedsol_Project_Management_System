const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { bad, notFound, str, isEmail, oneOf, WORK_TYPE } = require('../utils/http');

router.use(authenticate);

// Admin sees everything; employees can only see a basic list (used for names)
router.get('/', async (req, res) => {
  const rows = await db.q(
    `SELECT e.id, e.employee_code, e.full_name, e.work_email, e.department, e.designation, e.work_type, e.is_active,
            u.role, e.created_at,
            (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = e.id AND t.status <> 'COMPLETED') AS open_tasks
       FROM employees e LEFT JOIN users u ON u.id = e.user_id
      ${req.user.role === 'ADMIN' ? '' : 'WHERE e.is_active = 1'}
      ORDER BY e.full_name`
  );
  res.json({ success: true, data: rows });
});

function parse(body) {
  const full_name = str(body.full_name, 'Full name', { required: true, max: 150 });
  const work_email = str(body.work_email, 'Work email', { required: true, max: 150 });
  if (!isEmail(work_email)) throw bad('Work email is not valid');
  return {
    full_name,
    work_email: work_email.toLowerCase(),
    department: str(body.department, 'Department', { max: 100 }),
    designation: str(body.designation, 'Designation', { max: 100 }),
    role: oneOf(body.role || 'EMPLOYEE', ['ADMIN', 'EMPLOYEE'], 'Role'),
    work_type: oneOf(body.work_type || 'GENERAL', WORK_TYPE, 'Work type')
  };
}

router.post('/', requireAdmin, async (req, res) => {
  const d = parse(req.body || {});
  const password = req.body.password;
  if (!password || password.length < 6) throw bad('Password must be at least 6 characters');
  const hash = await bcrypt.hash(password, 10);

  const id = await db.tx(async (conn) => {
    const u = await conn.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?,?,?,?)',
      [d.work_email, d.work_email, hash, d.role]
    );
    const e = await conn.query(
      'INSERT INTO employees (user_id, full_name, work_email, department, designation, work_type) VALUES (?,?,?,?,?,?)',
      [u.insertId, d.full_name, d.work_email, d.department, d.designation, d.work_type]
    );
    const code = 'EMB' + String(e.insertId).padStart(4, '0');
    await conn.query('UPDATE employees SET employee_code = ? WHERE id = ?', [code, e.insertId]);
    return e.insertId;
  });
  res.status(201).json({ success: true, id });
});

router.put('/:id', requireAdmin, async (req, res) => {
  const d = parse(req.body || {});
  const rows = await db.q('SELECT id, user_id FROM employees WHERE id = ?', [req.params.id]);
  if (!rows[0]) throw notFound('Employee not found');
  const emp = rows[0];
  if (emp.user_id === req.user.id && d.role !== 'ADMIN') throw bad('You cannot remove your own administrator role');

  await db.tx(async (conn) => {
    await conn.query(
      'UPDATE employees SET full_name=?, work_email=?, department=?, designation=?, work_type=? WHERE id=?',
      [d.full_name, d.work_email, d.department, d.designation, d.work_type, emp.id]
    );
    // Existing tasks without a type follow the employee's team (Hardware / Software)
    if (d.work_type !== 'GENERAL') {
      await conn.query("UPDATE tasks SET task_type = ? WHERE assigned_to = ? AND task_type = 'GENERAL'", [d.work_type, emp.id]);
    }
    if (emp.user_id) {
      await conn.query('UPDATE users SET username=?, email=?, role=? WHERE id=?', [d.work_email, d.work_email, d.role, emp.user_id]);
      if (req.body.password) {
        if (req.body.password.length < 6) throw bad('Password must be at least 6 characters');
        await conn.query('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(req.body.password, 10), emp.user_id]);
      }
    }
  });
  res.json({ success: true });
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  const active = req.body?.is_active ? 1 : 0;
  const rows = await db.q('SELECT id, user_id FROM employees WHERE id = ?', [req.params.id]);
  if (!rows[0]) throw notFound('Employee not found');
  if (rows[0].user_id === req.user.id && !active) throw bad('You cannot deactivate your own account');
  await db.tx(async (conn) => {
    await conn.query('UPDATE employees SET is_active=? WHERE id=?', [active, rows[0].id]);
    if (rows[0].user_id) await conn.query('UPDATE users SET is_active=? WHERE id=?', [active, rows[0].user_id]);
  });
  res.json({ success: true });
});

module.exports = router;
