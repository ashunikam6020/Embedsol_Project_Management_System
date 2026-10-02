const router = require('express').Router();
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { bad, forbidden, notFound, str, oneOf, dateOrNull, WORK_TYPE, todayLocal } = require('../utils/http');

router.use(authenticate);
const today = todayLocal;
const selectReport = `
  SELECT r.*, e.full_name AS employee_name, e.employee_code, e.department, e.designation, e.work_type,
         u.email AS employee_email, reviewer.full_name AS reviewer_name
    FROM daily_reports r
    JOIN employees e ON e.id = r.employee_id
    LEFT JOIN users u ON u.id = e.user_id
    LEFT JOIN employees reviewer ON reviewer.id = r.reviewed_by`;

// ---- Employee: "My day". Tasks assigned to the employee are added automatically (nothing to pick),
// together with whatever has already been logged for the day.
router.get('/my-day', async (req, res) => {
  if (!req.user.employeeId) throw forbidden('Employee profile is required');
  const date = dateOrNull(req.query.date, 'Date') || today();
  if (date > today()) throw bad('Date cannot be in the future');
  const emp = (await db.q('SELECT id, full_name, work_type FROM employees WHERE id = ?', [req.user.employeeId]))[0];

  const tasks = await db.q(
    `SELECT t.id, t.title, t.description, t.priority, t.status, t.task_type, t.start_date, t.end_date,
            t.estimated_hours, t.actual_hours, p.project_name,
            (t.status <> 'COMPLETED' AND t.end_date < ?) AS is_overdue,
            l.id AS log_id, l.hours AS today_hours, l.work_description AS today_work, l.status AS log_status,
            l.remarks, l.work_type AS log_work_type, l.work_category, l.reference, l.tools_used, l.test_result
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN daily_task_logs l ON l.task_id = t.id AND l.employee_id = ? AND l.log_date = ?
      WHERE t.assigned_to = ? AND p.status <> 'CANCELLED'
        AND ((t.status <> 'COMPLETED' AND (t.start_date IS NULL OR t.start_date <= ?)) OR l.id IS NOT NULL)
      ORDER BY (l.id IS NOT NULL), FIELD(t.priority,'CRITICAL','HIGH','MEDIUM','LOW'), t.end_date IS NULL, t.end_date`,
    [date, emp.id, date, emp.id, date]
  );
  const report = (await db.q(`${selectReport} WHERE r.employee_id = ? AND r.report_date = ? LIMIT 1`, [emp.id, date]))[0] || null;
  const rows = tasks.map((t) => ({ ...t, is_overdue: !!t.is_overdue }));
  res.json({
    success: true,
    data: {
      date, work_type: emp.work_type, tasks: rows, report,
      summary: {
        assigned: rows.length,
        logged: rows.filter((t) => t.log_id).length,
        hours: rows.reduce((s, t) => s + Number(t.today_hours || 0), 0)
      }
    }
  });
});

// ---- Admin: team overview for one day (who logged work, who reported, by Hardware / Software team)
router.get('/overview', requireAdmin, async (req, res) => {
  const date = dateOrNull(req.query.date, 'Date') || today();
  const params = [date, date, date];
  let typeFilter = '';
  if (req.query.work_type) {
    typeFilter = 'AND e.work_type = ?';
    params.push(oneOf(req.query.work_type, WORK_TYPE, 'Work type'));
  }
  const rows = await db.q(
    `SELECT e.id, e.employee_code, e.full_name, e.department, e.designation, e.work_type,
            (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = e.id AND t.status <> 'COMPLETED') AS open_tasks,
            (SELECT COUNT(*) FROM daily_task_logs l WHERE l.employee_id = e.id AND l.log_date = ?) AS log_entries,
            (SELECT COALESCE(SUM(l.hours), 0) FROM daily_task_logs l WHERE l.employee_id = e.id AND l.log_date = ?) AS hours,
            r.id AS report_id, r.status AS report_status
       FROM employees e
       JOIN users u ON u.id = e.user_id AND u.role = 'EMPLOYEE'
       LEFT JOIN daily_reports r ON r.employee_id = e.id AND r.report_date = ?
      WHERE e.is_active = 1 ${typeFilter}
      ORDER BY e.work_type, e.full_name`,
    params
  );
  res.json({
    success: true,
    data: {
      date,
      employees: rows,
      totals: {
        employees: rows.length,
        logged: rows.filter((r) => r.log_entries > 0).length,
        reported: rows.filter((r) => ['SUBMITTED', 'REVIEWED', 'RETURNED'].includes(r.report_status)).length,
        hours: rows.reduce((s, r) => s + Number(r.hours), 0)
      }
    }
  });
});

router.get('/', async (req, res) => {
  const { from, to, employee_id, status } = req.query;
  const where = [], params = [];
  if (req.user.role !== 'ADMIN') { where.push('r.employee_id = ?'); params.push(req.user.employeeId || 0); }
  else if (employee_id) { where.push('r.employee_id = ?'); params.push(employee_id); }
  if (from) { dateOrNull(from, 'From'); where.push('r.report_date >= ?'); params.push(from); }
  if (to) { dateOrNull(to, 'To'); where.push('r.report_date <= ?'); params.push(to); }
  if (status) { oneOf(status, ['DRAFT','SUBMITTED','REVIEWED','RETURNED'], 'Status'); where.push('r.status = ?'); params.push(status); }
  const rows = await db.q(`${selectReport} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.report_date DESC, r.id DESC LIMIT 500`, params);
  res.json({ success: true, data: rows });
});

router.get('/today', async (req, res) => {
  if (!req.user.employeeId) throw forbidden('Employee profile is required');
  const rows = await db.q(`${selectReport} WHERE r.employee_id = ? AND r.report_date = ? LIMIT 1`, [req.user.employeeId, today()]);
  res.json({ success: true, data: rows[0] || null });
});

router.post('/', async (req, res) => {
  if (!req.user.employeeId) throw forbidden('Employee profile is required');
  const b = req.body || {};
  const report_date = dateOrNull(b.report_date, 'Report date') || today();
  if (report_date > today()) throw bad('Report date cannot be in the future');
  const summary = str(b.summary, 'Daily summary', { required: true, max: 5000 });
  const blockers = str(b.blockers, 'Blockers', { max: 3000 });
  const tomorrow_plan = str(b.tomorrow_plan, 'Tomorrow plan', { max: 3000 });
  const status = oneOf(b.status || 'SUBMITTED', ['DRAFT', 'SUBMITTED'], 'Status');
  await db.q(`INSERT INTO daily_reports (employee_id, report_date, summary, blockers, tomorrow_plan, status, submitted_at)
    VALUES (?,?,?,?,?,?,CASE WHEN ?='SUBMITTED' THEN CURRENT_TIMESTAMP ELSE NULL END)
    ON DUPLICATE KEY UPDATE summary=VALUES(summary), blockers=VALUES(blockers), tomorrow_plan=VALUES(tomorrow_plan),
      status=VALUES(status), submitted_at=CASE WHEN VALUES(status)='SUBMITTED' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
      reviewed_by=NULL, reviewed_at=NULL, hr_comment=NULL`,
    [req.user.employeeId, report_date, summary, blockers, tomorrow_plan, status, status]);
  res.status(201).json({ success: true, message: status === 'SUBMITTED' ? 'Daily report submitted to HR' : 'Daily report saved as draft' });
});

router.patch('/:id/review', requireAdmin, async (req, res) => {
  const status = oneOf(req.body?.status, ['REVIEWED', 'RETURNED'], 'Review status');
  const hr_comment = str(req.body?.hr_comment, 'HR comment', { max: 3000 });
  const report = (await db.q('SELECT id FROM daily_reports WHERE id = ?', [req.params.id]))[0];
  if (!report) throw notFound('Daily report not found');
  const reviewer = (await db.q('SELECT id FROM employees WHERE user_id = ?', [req.user.id]))[0];
  await db.q('UPDATE daily_reports SET status=?, hr_comment=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?', [status, hr_comment, reviewer?.id || null, report.id]);
  res.json({ success: true, message: status === 'REVIEWED' ? 'Report marked as reviewed' : 'Report returned to employee' });
});

module.exports = router;
