const router = require('express').Router();
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { dateOrNull } = require('../utils/http');

router.use(authenticate, requireAdmin);

router.get('/projects', async (req, res) => {
  const rows = await db.q(
    `SELECT p.id, p.project_name, p.client_category, p.status, p.start_date, p.end_date,
            COUNT(t.id) AS total_tasks,
            COALESCE(SUM(t.status='COMPLETED'),0) AS completed_tasks,
            COALESCE(SUM(t.status='IN_PROGRESS'),0) AS in_progress_tasks,
            COALESCE(SUM(t.status<>'COMPLETED' AND t.end_date < CURDATE()),0) AS overdue_tasks,
            COALESCE(SUM(t.estimated_hours),0) AS estimated_hours,
            COALESCE(SUM(t.actual_hours),0) AS actual_hours
       FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id ORDER BY p.project_name`
  );
  res.json({ success: true, data: rows.map((r) => ({
    ...r, progress_percent: r.total_tasks ? Math.round((r.completed_tasks / r.total_tasks) * 100) : 0
  })) });
});

router.get('/employees', async (req, res) => {
  const from = dateOrNull(req.query.from, 'From');
  const to = dateOrNull(req.query.to, 'To');
  const rows = await db.q(
    `SELECT e.id, e.employee_code, e.full_name, e.department, e.work_type,
            COUNT(t.id) AS total_tasks,
            COALESCE(SUM(t.status='COMPLETED'),0) AS completed_tasks,
            COALESCE(SUM(t.status<>'COMPLETED' AND t.end_date < CURDATE()),0) AS overdue_tasks,
            COALESCE(SUM(t.estimated_hours),0) AS estimated_hours,
            (SELECT COALESCE(SUM(l.hours),0) FROM daily_task_logs l
              WHERE l.employee_id = e.id AND (? IS NULL OR l.log_date >= ?) AND (? IS NULL OR l.log_date <= ?)) AS logged_hours
       FROM employees e LEFT JOIN tasks t ON t.assigned_to = e.id
      WHERE e.is_active = 1
      GROUP BY e.id ORDER BY e.full_name`,
    [from, from, to, to]
  );
  res.json({ success: true, data: rows });
});

router.get('/teams', async (req, res) => {
  const from = dateOrNull(req.query.from, 'From');
  const to = dateOrNull(req.query.to, 'To');
  const rows = await db.q(
    `SELECT e.work_type,
            COUNT(DISTINCT e.id) AS employees,
            COUNT(t.id) AS total_tasks,
            COALESCE(SUM(t.status='COMPLETED'),0) AS completed_tasks,
            COALESCE(SUM(t.status<>'COMPLETED' AND t.end_date < CURDATE()),0) AS overdue_tasks,
            COALESCE(SUM(t.estimated_hours),0) AS estimated_hours,
            (SELECT COALESCE(SUM(l.hours),0) FROM daily_task_logs l JOIN employees e2 ON e2.id = l.employee_id
              WHERE e2.work_type = e.work_type AND (? IS NULL OR l.log_date >= ?) AND (? IS NULL OR l.log_date <= ?)) AS logged_hours
       FROM employees e JOIN users u ON u.id = e.user_id AND u.role = 'EMPLOYEE'
       LEFT JOIN tasks t ON t.assigned_to = e.id
      WHERE e.is_active = 1 GROUP BY e.work_type ORDER BY e.work_type`,
    [from, from, to, to]
  );
  res.json({ success: true, data: rows });
});

router.get('/overdue', async (req, res) => {
  const rows = await db.q(
    `SELECT t.id, t.title, t.task_type, t.priority, t.status, t.end_date, p.project_name, e.full_name AS assignee_name,
            DATEDIFF(CURDATE(), t.end_date) AS days_overdue
       FROM tasks t JOIN projects p ON p.id = t.project_id LEFT JOIN employees e ON e.id = t.assigned_to
      WHERE t.status <> 'COMPLETED' AND t.end_date < CURDATE()
      ORDER BY days_overdue DESC`
  );
  res.json({ success: true, data: rows });
});

router.get('/effort', async (req, res) => {
  const rows = await db.q(
    `SELECT t.id, t.title, p.project_name, e.full_name AS assignee_name, t.status,
            t.estimated_hours, t.actual_hours, (t.actual_hours - t.estimated_hours) AS variance_hours
       FROM tasks t JOIN projects p ON p.id = t.project_id LEFT JOIN employees e ON e.id = t.assigned_to
      ORDER BY p.project_name, t.title`
  );
  res.json({ success: true, data: rows });
});

module.exports = router;
