const router = require('express').Router();
const pool = require('../config/db');

router.get('/health', async (req, res) => {
  let database = 'connected';
  try {
    await pool.q('SELECT 1');
  } catch (err) {
    console.error('DB health check failed:', err.message);
    database = 'not connected';
  }
  res.json({
    success: true,
    application: 'Embedsol Technologies – Project & Task Management System',
    status: 'API running',
    database
  });
});

router.use('/auth', require('./auth'));
router.use('/employees', require('./employees'));
router.use('/projects', require('./projects'));
router.use('/project-members', require('./projectMembers'));
router.use('/tasks', require('./tasks'));
router.use('/dashboard', require('./dashboard'));
router.use('/daily-reports', require('./dailyReports'));
router.use('/reports', require('./reports'));
router.use('/attendance', require('./attendance'));
router.use('/notifications', require('./notifications'));
router.use('/audit-logs', require('./auditLogs'));
router.use('/', require('./taskComments'));
router.use('/', require('./logs')); // /tasks/:id/logs and /logs

module.exports = router;
