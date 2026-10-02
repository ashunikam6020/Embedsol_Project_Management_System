const router = require('express').Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  const admin = req.user.role === 'ADMIN';
  const empId = req.user.employeeId || 0;
  const scope = admin ? '' : 'AND t.assigned_to = ?';
  const sp = admin ? [] : [empId];

  const t = (await db.q(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(status='NOT_STARTED'),0) AS not_started,
            COALESCE(SUM(status='IN_PROGRESS'),0) AS in_progress,
            COALESCE(SUM(status='ON_HOLD'),0) AS on_hold,
            COALESCE(SUM(status='COMPLETED'),0) AS completed,
            COALESCE(SUM(status<>'COMPLETED' AND end_date < CURDATE()),0) AS overdue
       FROM tasks t WHERE 1=1 ${scope}`, sp
  ))[0];

  const projects = (await db.q(
    admin
      ? `SELECT COUNT(*) AS total, COALESCE(SUM(status='ACTIVE'),0) AS active FROM projects`
      : `SELECT COUNT(DISTINCT p.id) AS total, COALESCE(SUM(p.status='ACTIVE'),0) AS active
           FROM projects p JOIN tasks t ON t.project_id = p.id WHERE t.assigned_to = ?`,
    admin ? [] : [empId]
  ))[0];

  const employees = admin
    ? (await db.q('SELECT COUNT(*) AS total FROM employees WHERE is_active = 1'))[0].total
    : null;

  const lp = admin ? [] : [empId];
  const lw = admin ? '' : 'WHERE employee_id = ?';
  const hours = (await db.q(
    `SELECT COALESCE(SUM(CASE WHEN log_date = CURDATE() THEN hours END),0) AS today,
            COALESCE(SUM(CASE WHEN log_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN hours END),0) AS week
       FROM daily_task_logs ${lw}`, lp
  ))[0];

  const upcoming = await db.q(
    `SELECT t.id, t.title, t.priority, t.status, t.end_date, p.project_name, e.full_name AS assignee_name,
            (t.end_date < CURDATE()) AS is_overdue
       FROM tasks t JOIN projects p ON p.id = t.project_id LEFT JOIN employees e ON e.id = t.assigned_to
      WHERE t.status <> 'COMPLETED' ${scope}
      ORDER BY t.end_date IS NULL, t.end_date LIMIT 6`, sp
  );

  const prog = await db.q(
    `SELECT p.id, p.project_name, COUNT(t.id) AS total_tasks,
            COALESCE(SUM(t.status='COMPLETED'),0) AS completed_tasks
       FROM projects p JOIN tasks t ON t.project_id = p.id
      ${admin ? '' : 'WHERE p.id IN (SELECT project_id FROM tasks WHERE assigned_to = ?)'}
      GROUP BY p.id ORDER BY p.created_at DESC LIMIT 6`, admin ? [] : [empId]
  );

  // Hardware vs Software team summary (admin only)
  const teams = admin ? await db.q(
    `SELECT e.work_type,
            COUNT(DISTINCT e.id) AS employees,
            (SELECT COUNT(*) FROM tasks t2 JOIN employees e2 ON e2.id = t2.assigned_to
              WHERE e2.work_type = e.work_type AND e2.is_active = 1 AND t2.status <> 'COMPLETED') AS open_tasks,
            (SELECT COALESCE(SUM(l.hours),0) FROM daily_task_logs l JOIN employees e3 ON e3.id = l.employee_id
              WHERE e3.work_type = e.work_type AND l.log_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)) AS week_hours
       FROM employees e JOIN users u ON u.id = e.user_id AND u.role = 'EMPLOYEE'
      WHERE e.is_active = 1 GROUP BY e.work_type ORDER BY e.work_type`
  ) : [];

  res.json({
    success: true,
    data: {
      teams,
      tasks: t,
      projects,
      employees,
      hours: { today: hours.today, week: hours.week },
      upcoming: upcoming.map((r) => ({ ...r, is_overdue: !!r.is_overdue })),
      projectProgress: prog.map((p) => ({
        ...p, progress: p.total_tasks ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0
      }))
    }
  });
});

module.exports = router;
