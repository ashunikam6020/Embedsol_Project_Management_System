const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { HttpError, bad } = require('../utils/http');

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) throw bad('Username and password are required');

  const rows = await db.q(
    `SELECT u.id, u.username, u.email, u.password_hash, u.role, u.is_active,
            e.id AS employee_id, e.full_name, e.work_type, e.is_active AS employee_active
       FROM users u LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.username = ? OR u.email = ? LIMIT 1`,
    [username, username]
  );
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    throw new HttpError(401, 'Invalid username or password');
  }
  if (!u.is_active || (u.employee_id && !u.employee_active)) {
    throw new HttpError(403, 'This account is deactivated');
  }

  const token = jwt.sign(
    { id: u.id, role: u.role, employeeId: u.employee_id || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  res.json({
    success: true,
    token,
    user: { id: u.id, username: u.username, email: u.email, role: u.role, employeeId: u.employee_id, fullName: u.full_name || u.username, workType: u.work_type || 'GENERAL' }
  });
});

router.get('/me', authenticate, async (req, res) => {
  const rows = await db.q(
    `SELECT u.id, u.username, u.email, u.role, e.id AS employeeId, e.full_name AS fullName,
            e.department, e.designation, e.work_type AS workType
       FROM users u LEFT JOIN employees e ON e.user_id = u.id WHERE u.id = ?`,
    [req.user.id]
  );
  if (!rows[0]) throw new HttpError(401, 'User no longer exists');
  res.json({ success: true, user: { ...rows[0], fullName: rows[0].fullName || rows[0].username } });
});

router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) throw bad('New password must be at least 6 characters');
  const rows = await db.q('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!rows[0] || !(await bcrypt.compare(currentPassword || '', rows[0].password_hash))) {
    throw bad('Current password is incorrect');
  }
  await db.q('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 10), req.user.id]);
  res.json({ success: true, message: 'Password changed' });
});

module.exports = router;
