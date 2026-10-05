const router = require('express').Router();
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const {
  bad,
  forbidden,
  notFound,
  str,
  oneOf,
  dateOrNull,
  num,
  PRIORITY,
  WORK_TYPE,
  todayLocal
} = require('../utils/http');

router.use(authenticate);

const today = todayLocal;

const WORKFLOW_STATUS = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

const ALLOWED_TRANSITIONS = {
  PLANNING: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

function validateWorkflowStatus(status) {
  const value = status || 'PLANNING';

  const allowed = Object.keys(WORKFLOW_STATUS);

  if (!allowed.includes(value)) {
    throw bad(`Invalid status: ${value}`);
  }

  return value;
}

function validateTransition(from, to) {
  if (from === to) return;

  const allowed = ALLOWED_TRANSITIONS[from] || [];

  if (!allowed.includes(to)) {
    throw bad(
      `Invalid status change: ${WORKFLOW_STATUS[from]} → ${WORKFLOW_STATUS[to]}`
    );
  }
}

function legacyStatus(workflowStatus) {
  switch (workflowStatus) {
    case 'PLANNING':
      return 'NOT_STARTED';

    case 'ACTIVE':
      return 'IN_PROGRESS';

    case 'ON_HOLD':
      return 'ON_HOLD';

    case 'COMPLETED':
      return 'COMPLETED';

    case 'CANCELLED':
      return 'ON_HOLD';

    default:
      return 'NOT_STARTED';
  }
}

/*
|--------------------------------------------------------------------------
| GET TASKS
|--------------------------------------------------------------------------
*/
router.get('/', async (req, res) => {
  const {
    search,
    project_id,
    assigned_to,
    status,
    priority,
    overdue,
    task_type
  } = req.query;

  const where = [];
  const params = [];

  if (req.user.role !== 'ADMIN') {
    where.push('t.assigned_to = ?');
    params.push(req.user.employeeId || 0);
  } else if (assigned_to) {
    where.push('t.assigned_to = ?');
    params.push(assigned_to);
  }

  if (project_id) {
    where.push('t.project_id = ?');
    params.push(project_id);
  }

  if (status) {
    where.push('t.workflow_status = ?');
    params.push(status);
  }

  if (priority) {
    where.push('t.priority = ?');
    params.push(priority);
  }

  if (task_type) {
    where.push('t.task_type = ?');
    params.push(task_type);
  }

  if (overdue === '1') {
    where.push(
      "t.workflow_status NOT IN ('COMPLETED','CANCELLED') AND t.end_date < CURDATE()"
    );
  }

  if (search) {
    where.push(
      '(t.title LIKE ? OR p.project_name LIKE ? OR p.client_category LIKE ? OR e.full_name LIKE ?)'
    );

    const s = `%${search}%`;

    params.push(s, s, s, s);
  }

  const rows = await db.q(
    `
    SELECT
      t.*,
      t.workflow_status AS current_workflow_status,
      p.project_name,
      p.client_category AS client_name,
      e.full_name AS assignee_name,

      (
        t.workflow_status NOT IN ('COMPLETED','CANCELLED')
        AND t.end_date < CURDATE()
      ) AS is_overdue

    FROM tasks t

    JOIN projects p
      ON p.id = t.project_id

    LEFT JOIN employees e
      ON e.id = t.assigned_to

    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}

    ORDER BY
      (t.workflow_status IN ('COMPLETED','CANCELLED')),
      t.end_date IS NULL,
      t.end_date,
      t.id DESC
    `,
    params
  );

  /*
   * Get status history for all tasks
   */
  let history = [];

  if (rows.length) {
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');

    history = await db.q(
      `
      SELECT
        id,
        task_id,
        status,
        changed_at,
        changed_by
      FROM task_status_history
      WHERE task_id IN (${placeholders})
      ORDER BY changed_at ASC, id ASC
      `,
      ids
    );
  }

  const historyMap = {};

  for (const h of history) {
    if (!historyMap[h.task_id]) {
      historyMap[h.task_id] = [];
    }

    historyMap[h.task_id].push(h);
  }

  const data = rows.map((r) => ({
    ...r,

    // Frontend uses status
    status: r.current_workflow_status,

    // Status history
    status_history: historyMap[r.id] || [],

    is_overdue: !!r.is_overdue
  }));

  res.json({
    success: true,
    data
  });
});

/*
|--------------------------------------------------------------------------
| Parse task
|--------------------------------------------------------------------------
*/
async function parseTask(b) {
  const project_id = Number(b.project_id);

  if (!project_id) {
    throw bad('Project is required');
  }

  const p = await db.q(
    'SELECT id FROM projects WHERE id = ?',
    [project_id]
  );

  if (!p[0]) {
    throw bad('Selected project does not exist');
  }

  let assigned_to = b.assigned_to
    ? Number(b.assigned_to)
    : null;

  let assigneeType = 'GENERAL';

  if (assigned_to) {
    const e = await db.q(
      `
      SELECT id, work_type
      FROM employees
      WHERE id = ?
      AND is_active = 1
      `,
      [assigned_to]
    );

    if (!e[0]) {
      throw bad('Assignee does not exist or is inactive');
    }

    assigneeType = e[0].work_type;
  }

  const start_date = dateOrNull(
    b.start_date,
    'Start date'
  );

  const end_date = dateOrNull(
    b.end_date,
    'End date'
  );

  if (
    start_date &&
    end_date &&
    end_date < start_date
  ) {
    throw bad('End date cannot be before start date');
  }

  return {
    project_id,

    title: str(
      b.title,
      'Title',
      { required: true }
    ),

    description: str(
      b.description,
      'Description',
      { max: 5000 }
    ),

    assigned_to,

    task_type: oneOf(
      b.task_type || assigneeType,
      WORK_TYPE,
      'Task type'
    ),

    priority: oneOf(
      b.priority || 'MEDIUM',
      PRIORITY,
      'Priority'
    ),

    status: validateWorkflowStatus(
      b.status || 'PLANNING'
    ),

    start_date,
    end_date,

    estimated_hours: num(
      b.estimated_hours ?? 0,
      'Estimated hours',
      { max: 100000 }
    )
  };
}

/*
|--------------------------------------------------------------------------
| CREATE TASK
|--------------------------------------------------------------------------
*/
router.post('/', requireAdmin, async (req, res) => {
  const d = await parseTask(req.body || {});

  // Every NEW task starts with Planning
  d.status = 'PLANNING';

  const r = await db.q(
    `
    INSERT INTO tasks
    (
      project_id,
      title,
      description,
      assigned_to,
      task_type,
      priority,
      status,
      workflow_status,
      start_date,
      end_date,
      estimated_hours
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `,
    [
      d.project_id,
      d.title,
      d.description,
      d.assigned_to,
      d.task_type,
      d.priority,

      // old status
      'NOT_STARTED',

      // new workflow status
      'PLANNING',

      d.start_date,
      d.end_date,
      d.estimated_hours
    ]
  );

  await db.q(
    `
    INSERT INTO task_status_history
    (
      task_id,
      status,
      changed_by
    )
    VALUES (?, 'PLANNING', ?)
    `,
    [
      r.insertId,
      req.user.id
    ]
  );

  res.status(201).json({
    success: true,
    id: r.insertId
  });
});

/*
|--------------------------------------------------------------------------
| EDIT TASK
|--------------------------------------------------------------------------
*/
router.put('/:id', requireAdmin, async (req, res) => {
  const oldRows = await db.q(
    `
    SELECT *
    FROM tasks
    WHERE id = ?
    `,
    [req.params.id]
  );

  const oldTask = oldRows[0];

  if (!oldTask) {
    throw notFound('Task not found');
  }

  const d = await parseTask(req.body || {});

  const oldStatus =
    oldTask.workflow_status || 'PLANNING';

  const newStatus =
    d.status || oldStatus;

  validateTransition(
    oldStatus,
    newStatus
  );

  const r = await db.q(
    `
    UPDATE tasks
    SET
      project_id = ?,
      title = ?,
      description = ?,
      assigned_to = ?,
      task_type = ?,
      priority = ?,
      status = ?,
      workflow_status = ?,
      start_date = ?,
      end_date = ?,
      estimated_hours = ?
    WHERE id = ?
    `,
    [
      d.project_id,
      d.title,
      d.description,
      d.assigned_to,
      d.task_type,
      d.priority,

      legacyStatus(newStatus),

      newStatus,

      d.start_date,
      d.end_date,
      d.estimated_hours,

      req.params.id
    ]
  );

  if (!r.affectedRows) {
    throw notFound('Task not found');
  }

  if (oldStatus !== newStatus) {
    await db.q(
      `
      INSERT INTO task_status_history
      (
        task_id,
        status,
        changed_by
      )
      VALUES (?, ?, ?)
      `,
      [
        req.params.id,
        newStatus,
        req.user.id
      ]
    );
  }

  res.json({
    success: true
  });
});

/*
|--------------------------------------------------------------------------
| UPDATE TASK PROGRESS / STATUS
|--------------------------------------------------------------------------
*/
router.patch('/:id/progress', async (req, res) => {
  const rows = await db.q(
    `
    SELECT *
    FROM tasks
    WHERE id = ?
    `,
    [req.params.id]
  );

  const t = rows[0];

  if (!t) {
    throw notFound('Task not found');
  }

  if (
    req.user.role !== 'ADMIN' &&
    t.assigned_to !== req.user.employeeId
  ) {
    throw forbidden(
      'You can only update tasks assigned to you'
    );
  }

  const b = req.body || {};

  const oldStatus =
    t.workflow_status || 'PLANNING';

  const newStatus = validateWorkflowStatus(
    b.status || oldStatus
  );

  validateTransition(
    oldStatus,
    newStatus
  );

  let actual_start_date =
    b.actual_start_date !== undefined
      ? dateOrNull(
          b.actual_start_date,
          'Actual start date'
        )
      : t.actual_start_date;

  let actual_end_date =
    b.actual_end_date !== undefined
      ? dateOrNull(
          b.actual_end_date,
          'Actual end date'
        )
      : t.actual_end_date;

  const actual_hours =
    b.actual_hours !== undefined
      ? num(b.actual_hours, 'Actual hours')
      : t.actual_hours;

  /*
   * Active starts the actual task
   */
  if (
    newStatus !== 'PLANNING' &&
    !actual_start_date
  ) {
    actual_start_date = today();
  }

  /*
   * Completed gets actual end date
   */
  if (
    newStatus === 'COMPLETED' &&
    !actual_end_date
  ) {
    actual_end_date = today();
  }

  /*
   * Only Completed has actual end date
   */
  if (newStatus !== 'COMPLETED') {
    actual_end_date = null;
  }

  if (
    actual_start_date &&
    actual_end_date &&
    actual_end_date < actual_start_date
  ) {
    throw bad(
      'Actual end date cannot be before actual start date'
    );
  }

  await db.q(
    `
    UPDATE tasks
    SET
      status = ?,
      workflow_status = ?,
      actual_start_date = ?,
      actual_end_date = ?,
      actual_hours = ?
    WHERE id = ?
    `,
    [
      legacyStatus(newStatus),
      newStatus,
      actual_start_date,
      actual_end_date,
      actual_hours,
      t.id
    ]
  );

  if (oldStatus !== newStatus) {
    await db.q(
      `
      INSERT INTO task_status_history
      (
        task_id,
        status,
        changed_by
      )
      VALUES (?, ?, ?)
      `,
      [
        t.id,
        newStatus,
        req.user.id
      ]
    );
  }

  res.json({
    success: true
  });
});

/*
|--------------------------------------------------------------------------
| DELETE TASK
|--------------------------------------------------------------------------
*/
router.delete('/:id', requireAdmin, async (req, res) => {
  const r = await db.q(
    'DELETE FROM tasks WHERE id = ?',
    [req.params.id]
  );

  if (!r.affectedRows) {
    throw notFound('Task not found');
  }

  res.json({
    success: true
  });
});

module.exports = router;