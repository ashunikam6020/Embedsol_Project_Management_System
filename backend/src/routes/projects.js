const router = require('express').Router();
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { bad, notFound, str, oneOf, dateOrNull, PROJECT_STATUS } = require('../utils/http');

router.use(authenticate);

const SUMMARY = `
  SELECT p.id, p.project_name, p.client_category, p.description, p.start_date, p.end_date, p.status, p.project_type,
         p.responsible_employee_id, re.full_name AS responsible_person, p.created_at,
         COUNT(t.id) AS total_tasks,
         COALESCE(SUM(t.status = 'COMPLETED'), 0) AS completed_tasks,
         COALESCE(SUM(t.status = 'IN_PROGRESS'), 0) AS in_progress_tasks,
         COALESCE(SUM(t.status <> 'COMPLETED' AND t.end_date < CURDATE()), 0) AS overdue_tasks
    FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
    LEFT JOIN employees re ON re.id = p.responsible_employee_id`;

const withProgress = (r) => ({
  ...r,
  progress: r.total_tasks ? Math.round((r.completed_tasks / r.total_tasks) * 100) : 0
});

router.get('/', async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.role !== 'ADMIN') {
    where = 'WHERE EXISTS (SELECT 1 FROM tasks x WHERE x.project_id = p.id AND x.assigned_to = ?)';
    params.push(req.user.employeeId || 0);
  }
  const rows = await db.q(`${SUMMARY} ${where} GROUP BY p.id ORDER BY p.created_at DESC`, params);
  res.json({ success: true, data: rows.map(withProgress) });
});

router.get('/:id', async (req, res) => {
  const rows = await db.q(`${SUMMARY} WHERE p.id = ? GROUP BY p.id`, [req.params.id]);
  if (!rows[0]) throw notFound('Project not found');
  const tasks = await db.q(
    `SELECT t.id, t.title, t.priority, t.status, t.task_type, t.start_date, t.end_date, e.full_name AS assignee_name
       FROM tasks t LEFT JOIN employees e ON e.id = t.assigned_to
      WHERE t.project_id = ? ORDER BY t.end_date`,
    [req.params.id]
  );
  const materials = await db.q('SELECT id, material_type, material_name, software_kind, version, quantity, unit, remarks FROM project_materials WHERE project_id = ? ORDER BY material_type, material_name', [req.params.id]);
  res.json({ success: true, data: { ...withProgress(rows[0]), tasks, materials } });
});

async function parse(b) {
  const start_date = dateOrNull(b.start_date, 'Start date');
  const end_date = dateOrNull(b.end_date, 'End date');
  if (start_date && end_date && end_date < start_date) throw bad('End date cannot be before start date');
  const responsible_employee_id = b.responsible_employee_id ? Number(b.responsible_employee_id) : null;
  if (responsible_employee_id) {
    const e = await db.q('SELECT id FROM employees WHERE id = ? AND is_active = 1', [responsible_employee_id]);
    if (!e[0]) throw bad('Responsible employee does not exist or is inactive');
  }
  return {
    project_name: str(b.project_name, 'Project name', { required: true, max: 200 }),
    client_category: str(b.client_category, 'Client / category', { max: 150 }),
    description: str(b.description, 'Description', { max: 5000 }),
    start_date, end_date,
    status: oneOf(b.status || 'PLANNING', PROJECT_STATUS, 'Status'),
    project_type: oneOf(b.project_type || 'BOTH', ['HARDWARE','SOFTWARE','BOTH'], 'Project type'),
    responsible_employee_id
  };
}

async function saveMaterials(projectId, materials) {
  const list = Array.isArray(materials) ? materials : [];
  await db.q('DELETE FROM project_materials WHERE project_id = ?', [projectId]);
  for (const m of list) {
    const name = str(m.material_name, 'Material name', { required: true, max: 200 });
    const type = oneOf(m.material_type, ['HARDWARE','SOFTWARE'], 'Material type');
    const quantity = m.quantity === '' || m.quantity == null ? null : Number(m.quantity);
    if (quantity !== null && (Number.isNaN(quantity) || quantity < 0)) throw bad('Material quantity must be a positive number');
    const software_kind = type === 'SOFTWARE' ? oneOf(m.software_kind || 'OTHER', ['LANGUAGE','FRAMEWORK','TOOL','DATABASE','OTHER'], 'Software type') : null;
    const version = type === 'SOFTWARE' ? str(m.version, 'Version', { max: 50 }) : null;
    await db.q('INSERT INTO project_materials (project_id, material_type, material_name, software_kind, version, quantity, unit, remarks) VALUES (?,?,?,?,?,?,?,?)',
      [projectId, type, name, software_kind, version, quantity, str(m.unit, 'Unit', { max: 50 }), str(m.remarks, 'Remarks', { max: 500 })]);
  }
}

router.post('/', requireAdmin, async (req, res) => {
  const d = await parse(req.body || {});
  const r = await db.q(
    `INSERT INTO projects (project_name, client_category, description, start_date, end_date, status, project_type, responsible_employee_id, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [d.project_name, d.client_category, d.description, d.start_date, d.end_date, d.status, d.project_type, d.responsible_employee_id, req.user.id]
  );
  await saveMaterials(r.insertId, req.body?.materials);
  res.status(201).json({ success: true, id: r.insertId });
});

router.put('/:id', requireAdmin, async (req, res) => {
  const d = await parse(req.body || {});
  const r = await db.q(
    `UPDATE projects SET project_name=?, client_category=?, description=?, start_date=?, end_date=?, status=?, project_type=?, responsible_employee_id=? WHERE id=?`,
    [d.project_name, d.client_category, d.description, d.start_date, d.end_date, d.status, d.project_type, d.responsible_employee_id, req.params.id]
  );
  if (!r.affectedRows) throw notFound('Project not found');
  await saveMaterials(req.params.id, req.body?.materials);
  res.json({ success: true });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const r = await db.q('DELETE FROM projects WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw notFound('Project not found');
  res.json({ success: true });
});

module.exports = router;
