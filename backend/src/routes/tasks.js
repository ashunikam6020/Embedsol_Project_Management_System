const router = require('express').Router();
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  bad, forbidden, notFound, str, oneOf, dateOrNull, num,
  TASK_STATUS, PRIORITY, WORK_TYPE, todayLocal
} = require('../utils/http');

router.use(authenticate);

const today = todayLocal;

router.get('/', async (req, res) => {
  const { search, project_id, assigned_to, status, priority, overdue, task_type } = req.query;
  const where = [];
  const params = [];

  if (req.user.role !== 'ADMIN') {
    where.push('t.assigned_to = ?');
    params.push(req.user.employeeId || 0);
  } else if (assigned_to) {
    where.push('t.assigned_to = ?');
    params.push(assigned_to);
  }
  if (project_id) { where.push('t.project_id = ?'); params.push(project_id); }
  if (status) { where.push('t.status = ?'); params.push(status); }
  if (priority) { where.push('t.priority = ?'); params.push(priority); }
  if (task_type) { where.push('t.task_type = ?'); params.push(task_type); }
  if (overdue === '1') where.push("t.status <> 'COMPLETED' AND t.end_date < CURDATE()");
  if (search) {
    where.push('(t.title LIKE ? OR p.project_name LIKE ? OR p.client_category LIKE ? OR e.full_name LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const rows = await db.q(
    `SELECT t.*, p.project_name, p.client_category AS client_name, e.full_name AS assignee_name,
            (t.status <> 'COMPLETED' AND t.end_date < CURDATE()) AS is_overdue
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN employees e ON e.id = t.assigned_to
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY (t.status = 'COMPLETED'), t.end_date IS NULL, t.end_date, t.id DESC`,
    params
  );
  res.json({ success: true, data: rows.map((r) => ({ ...r, is_overdue: !!r.is_overdue })) });
});

async function parseTask(b, conn = db) {
  const project_id = Number(b.project_id);
  if (!project_id) throw bad('Project is required');
  const p = await conn.query('SELECT id, status FROM projects WHERE id = ?', [project_id]);
  if (!p[0]) throw bad('Selected project does not exist');

  let assigned_to = b.assigned_to ? Number(b.assigned_to) : null;
  let assigneeType = 'GENERAL';
  if (assigned_to) {
    const e = await conn.query('SELECT id, work_type FROM employees WHERE id = ? AND is_active = 1', [assigned_to]);
    if (!e[0]) throw bad('Assignee does not exist or is inactive');
    assigneeType = e[0].work_type;
  }
  const start_date = dateOrNull(b.start_date, 'Start date');
  const end_date = dateOrNull(b.end_date, 'End date');
  if (start_date && end_date && end_date < start_date) throw bad('End date cannot be before start date');

  return {
    project_id,
    title: str(b.title, 'Title', { required: true }),
    description: str(b.description, 'Description', { max: 5000 }),
    assigned_to,
    // Hardware / Software: use the chosen type, otherwise follow the assignee's team
    task_type: oneOf(b.task_type || assigneeType, WORK_TYPE, 'Task type'),
    priority: oneOf(b.priority || 'MEDIUM', PRIORITY, 'Priority'),
    status: oneOf(b.status || 'NOT_STARTED', TASK_STATUS, 'Status'),
    start_date, end_date,
    estimated_hours: num(b.estimated_hours ?? 0, 'Estimated hours', { max: 100000 })
  };
}

router.post('/', requireAdmin, async (req, res) => {
  const d = await parseTask(req.body || {});
  const r = await db.q(
    `INSERT INTO tasks (project_id, title, description, assigned_to, task_type, priority, status, start_date, end_date, estimated_hours)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [d.project_id, d.title, d.description, d.assigned_to, d.task_type, d.priority, d.status, d.start_date, d.end_date, d.estimated_hours]
  );
  res.status(201).json({ success: true, id: r.insertId });
});

router.put('/:id', requireAdmin, async (req, res) => {
  const d = await parseTask(req.body || {});
  const r = await db.q(
    `UPDATE tasks SET project_id=?, title=?, description=?, assigned_to=?, task_type=?, priority=?, status=?,
            start_date=?, end_date=?, estimated_hours=? WHERE id=?`,
    [d.project_id, d.title, d.description, d.assigned_to, d.task_type, d.priority, d.status, d.start_date, d.end_date, d.estimated_hours, req.params.id]
  );
  if (!r.affectedRows) throw notFound('Task not found');
  res.json({ success: true });
});

// Progress update: admin, or the employee the task is assigned to
router.patch('/:id/progress', async (req, res) => {
  const rows = await db.q('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  const t = rows[0];
  if (!t) throw notFound('Task not found');
  if (req.user.role !== 'ADMIN' && t.assigned_to !== req.user.employeeId) {
    throw forbidden('You can only update tasks assigned to you');
  }
  const b = req.body || {};
  const status = oneOf(b.status || t.status, TASK_STATUS, 'Status');
  let actual_start_date = b.actual_start_date !== undefined ? dateOrNull(b.actual_start_date, 'Actual start date') : t.actual_start_date;
  let actual_end_date = b.actual_end_date !== undefined ? dateOrNull(b.actual_end_date, 'Actual end date') : t.actual_end_date;
  const actual_hours = b.actual_hours !== undefined ? num(b.actual_hours, 'Actual hours') : t.actual_hours;

  if (status !== 'NOT_STARTED' && !actual_start_date) actual_start_date = today();
  if (status === 'COMPLETED' && !actual_end_date) actual_end_date = today();
  if (status !== 'COMPLETED') actual_end_date = null;
  if (actual_start_date && actual_end_date && actual_end_date < actual_start_date) {
    throw bad('Actual end date cannot be before actual start date');
  }

  await db.q(
    'UPDATE tasks SET status=?, actual_start_date=?, actual_end_date=?, actual_hours=? WHERE id=?',
    [status, actual_start_date, actual_end_date, actual_hours, t.id]
  );
  res.json({ success: true });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const r = await db.q('DELETE FROM tasks WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw notFound('Task not found');
  res.json({ success: true });
});

module.exports = router;
