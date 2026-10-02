const router = require('express').Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { bad, forbidden, notFound, str, oneOf, dateOrNull, num, LOG_STATUS, WORK_TYPE, TEST_RESULT, todayLocal } = require('../utils/http');

router.use(authenticate);

const today = todayLocal;
const isAdmin = (req) => req.user.role === 'ADMIN';

// Recalculate task totals from its daily logs
async function syncTask(conn, taskId, lastLog) {
  const s = (await conn.query(
    'SELECT COALESCE(SUM(hours),0) AS h, MIN(log_date) AS first_d FROM daily_task_logs WHERE task_id = ?', [taskId]
  ))[0];
  await conn.query(
    `UPDATE tasks SET actual_hours = ?,
            actual_start_date = COALESCE(actual_start_date, ?),
            status = IF(status = 'NOT_STARTED', 'IN_PROGRESS', status)
      WHERE id = ?`,
    [s.h, s.first_d, taskId]
  );
  if (lastLog && lastLog.status === 'COMPLETED') {
    await conn.query(
      "UPDATE tasks SET status='COMPLETED', actual_end_date = COALESCE(actual_end_date, ?) WHERE id = ?",
      [lastLog.log_date, taskId]
    );
  }
}

const LOG_SELECT = `
  SELECT l.*, t.title AS task_title, p.project_name, e.full_name AS employee_name, e.work_type AS employee_type
    FROM daily_task_logs l
    JOIN tasks t ON t.id = l.task_id
    JOIN projects p ON p.id = t.project_id
    JOIN employees e ON e.id = l.employee_id`;

// Daily work report / list
router.get('/logs', async (req, res) => {
  const { from, to, employee_id, task_id, project_id, work_type } = req.query;
  const where = [];
  const params = [];
  if (!isAdmin(req)) { where.push('l.employee_id = ?'); params.push(req.user.employeeId || 0); }
  else if (employee_id) { where.push('l.employee_id = ?'); params.push(employee_id); }
  if (from) { dateOrNull(from, 'From'); where.push('l.log_date >= ?'); params.push(from); }
  if (to) { dateOrNull(to, 'To'); where.push('l.log_date <= ?'); params.push(to); }
  if (task_id) { where.push('l.task_id = ?'); params.push(task_id); }
  if (project_id) { where.push('t.project_id = ?'); params.push(project_id); }
  if (work_type) { where.push('l.work_type = ?'); params.push(work_type); }

  const rows = await db.q(
    `${LOG_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY l.log_date DESC, l.id DESC LIMIT 500`,
    params
  );
  res.json({ success: true, data: rows });
});

router.get('/tasks/:id/logs', async (req, res) => {
  const t = (await db.q('SELECT assigned_to FROM tasks WHERE id = ?', [req.params.id]))[0];
  if (!t) throw notFound('Task not found');
  if (!isAdmin(req) && t.assigned_to !== req.user.employeeId) throw forbidden();
  const rows = await db.q(`${LOG_SELECT} WHERE l.task_id = ? ORDER BY l.log_date DESC`, [req.params.id]);
  res.json({ success: true, data: rows });
});

router.post('/tasks/:id/logs', async (req, res) => {
  const b = req.body || {};
  const t = (await db.q('SELECT id, assigned_to, task_type FROM tasks WHERE id = ?', [req.params.id]))[0];
  if (!t) throw notFound('Task not found');

  let employee_id;
  if (isAdmin(req)) {
    employee_id = Number(b.employee_id) || t.assigned_to;
    if (!employee_id) throw bad('Task has no assignee; choose an employee for this log');
  } else {
    if (t.assigned_to !== req.user.employeeId) throw forbidden('You can only log work on tasks assigned to you');
    employee_id = req.user.employeeId;
  }

  const log_date = dateOrNull(b.log_date, 'Log date') || today();
  if (log_date > today()) throw bad('Log date cannot be in the future');
  const hours = num(b.hours, 'Hours', { min: 0.25, max: 24 });
  const log = {
    log_date,
    work_description: str(b.work_description, 'Work description', { required: true, max: 5000 }),
    hours,
    status: oneOf(b.status || 'WORKING', LOG_STATUS, 'Status'),
    remarks: str(b.remarks, 'Remarks', { max: 2000 }),
    work_type: null,
    work_category: str(b.work_category, 'Work category', { max: 80 }),
    reference: str(b.reference, 'Reference', { max: 150 }),
    tools_used: str(b.tools_used, 'Tools / equipment', { max: 255 }),
    test_result: oneOf(b.test_result || 'NA', TEST_RESULT, 'Test result')
  };
  // Hardware / Software: the form the employee used; default to the employee's team, then the task's type
  const emp = (await db.q('SELECT work_type FROM employees WHERE id = ?', [employee_id]))[0];
  log.work_type = oneOf(b.work_type || (emp && emp.work_type !== 'GENERAL' ? emp.work_type : t.task_type) || 'GENERAL', WORK_TYPE, 'Work type');

  await db.tx(async (conn) => {
    // One log per task/employee/day: saving again the same day replaces it
    await conn.query(
      `INSERT INTO daily_task_logs (task_id, employee_id, log_date, work_description, hours, status, remarks,
                                  work_type, work_category, reference, tools_used, test_result)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE work_description=VALUES(work_description), hours=VALUES(hours),
                               status=VALUES(status), remarks=VALUES(remarks), work_type=VALUES(work_type),
                               work_category=VALUES(work_category), reference=VALUES(reference),
                               tools_used=VALUES(tools_used), test_result=VALUES(test_result)`,
      [t.id, employee_id, log.log_date, log.work_description, log.hours, log.status, log.remarks,
       log.work_type, log.work_category, log.reference, log.tools_used, log.test_result]
    );
    await syncTask(conn, t.id, log);
  });
  res.status(201).json({ success: true });
});

router.delete('/logs/:id', async (req, res) => {
  const l = (await db.q('SELECT id, task_id, employee_id FROM daily_task_logs WHERE id = ?', [req.params.id]))[0];
  if (!l) throw notFound('Log not found');
  if (!isAdmin(req) && l.employee_id !== req.user.employeeId) throw forbidden();
  await db.tx(async (conn) => {
    await conn.query('DELETE FROM daily_task_logs WHERE id = ?', [l.id]);
    await syncTask(conn, l.task_id, null);
  });
  res.json({ success: true });
});

module.exports = router;
