import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth';
import { Alert, Badge, Empty, Field, LOG_STATUS, LogForm, Modal, PageHead, PRIORITY, STATUS, TEST_RESULT, TypeBadge, WORK_TYPE, fmtDate } from '../components';

const blank = { project_id: '', title: '', description: '', assigned_to: '', task_type: '', priority: 'MEDIUM', status: 'NOT_STARTED', start_date: '', end_date: '', estimated_hours: 0 };

export default function Tasks() {
  const { isAdmin, user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [f, setF] = useState({ search: '', project_id: '', assigned_to: '', status: '', priority: '', task_type: '' });
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);      // create/edit (admin)
  const [prog, setProg] = useState(null);      // progress update
  const [logTask, setLogTask] = useState(null); // work logs

  const load = () => {
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
    api.get('/tasks', { params }).then((r) => setTasks(r.data.data)).catch((e) => setError(errMsg(e)));
  };
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [f]);
  useEffect(() => {
    api.get('/projects').then((r) => setProjects(r.data.data));
    if (isAdmin) api.get('/employees').then((r) => setEmployees(r.data.data.filter((e) => e.is_active)));
  }, [isAdmin]);

  const saveTask = async (e) => {
    e.preventDefault(); setError('');
    try {
      form.id ? await api.put(`/tasks/${form.id}`, form) : await api.post('/tasks', form);
      setForm(null); load();
    } catch (err) { setError(errMsg(err)); }
  };
  const saveProgress = async (e) => {
    e.preventDefault(); setError('');
    try {
      await api.patch(`/tasks/${prog.id}/progress`, {
        status: prog.status, actual_start_date: prog.actual_start_date || null,
        actual_end_date: prog.actual_end_date || null, actual_hours: prog.actual_hours
      });
      setProg(null); load();
    } catch (err) { setError(errMsg(err)); }
  };
  const remove = async (t) => {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    try { await api.delete(`/tasks/${t.id}`); load(); } catch (err) { setError(errMsg(err)); }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const fset = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <PageHead title={isAdmin ? 'Tasks Workspace' : 'My Tasks'} subtitle="Track priority, status, dates and effort">
        {isAdmin && <button className="btn primary" onClick={() => { setError(''); setForm({ ...blank, project_id: projects[0]?.id || '' }); }}>+ New Task</button>}
      </PageHead>
      {!form && !prog && !logTask && <Alert>{error}</Alert>}

      <div className="filters">
        <input placeholder="Search tasks, projects, people…" value={f.search} onChange={fset('search')} />
        <select value={f.project_id} onChange={fset('project_id')}><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}</select>
        {isAdmin && <select value={f.assigned_to} onChange={fset('assigned_to')}><option value="">All employees</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>}
        <select value={f.status} onChange={fset('status')}><option value="">All statuses</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={f.task_type} onChange={fset('task_type')}><option value="">Hardware & Software</option>{Object.entries(WORK_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={f.priority} onChange={fset('priority')}><option value="">All priorities</option>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>

      <section className="panel">
        {tasks.length === 0 ? <Empty>No tasks match your filters.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Task</th><th>Project</th><th>Client</th>{isAdmin && <th>Assignee</th>}<th>Priority</th><th>Status</th><th>Target</th><th>Est / Actual hrs</th><th></th></tr></thead>
            <tbody>{tasks.map((t) => (
              <tr key={t.id} className={t.is_overdue ? 'row-overdue' : ''}>
                <td><b>{t.title}</b> <TypeBadge value={t.task_type} /></td><td>{t.project_name}</td><td>{t.client_name || '—'}</td>{isAdmin && <td>{t.assignee_name || '—'}</td>}
                <td><Badge value={t.priority} map={PRIORITY} /></td>
                <td><Badge value={t.status} map={STATUS} /></td>
                <td className={t.is_overdue ? 'overdue' : ''}>{fmtDate(t.start_date)} → {fmtDate(t.end_date)}</td>
                <td>{t.estimated_hours} / {t.actual_hours}</td>
                <td className="row-actions">
                  <button className="btn small" onClick={() => { setError(''); setProg({ ...t }); }}>Update</button>
                  <button className="btn small" onClick={() => setLogTask(t)}>Logs</button>
                  {isAdmin && <>
                    <button className="btn small" onClick={() => { setError(''); setForm({ ...blank, ...t, assigned_to: t.assigned_to || '' }); }}>Edit</button>
                    <button className="btn small danger" onClick={() => remove(t)}>Delete</button>
                  </>}
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>

      {form && (
        <Modal title={form.id ? 'Edit Task' : 'New Task'} onClose={() => setForm(null)}>
          <form onSubmit={saveTask} className="form-grid">
            <Alert>{error}</Alert>
            <Field label="Project *"><select value={form.project_id} onChange={set('project_id')} required><option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}</select></Field>
            <Field label="Assign to"><select value={form.assigned_to} onChange={(e) => {
              const emp = employees.find((x) => String(x.id) === e.target.value);
              setForm({ ...form, assigned_to: e.target.value, task_type: emp && emp.work_type !== 'GENERAL' ? emp.work_type : form.task_type });
            }}><option value="">Unassigned</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({WORK_TYPE[e.work_type] || 'General'})</option>)}</select></Field>
            <Field label="Task type"><select value={form.task_type || ''} onChange={set('task_type')}><option value="">Same as assignee's team</option>{Object.entries(WORK_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Title *" span><input value={form.title} onChange={set('title')} required /></Field>
            <Field label="Priority"><select value={form.priority} onChange={set('priority')}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Status"><select value={form.status} onChange={set('status')}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Target start"><input type="date" value={form.start_date || ''} onChange={set('start_date')} /></Field>
            <Field label="Target end"><input type="date" value={form.end_date || ''} onChange={set('end_date')} /></Field>
            <Field label="Estimated hours"><input type="number" min="0" step="0.5" value={form.estimated_hours} onChange={set('estimated_hours')} /></Field>
            <Field label="Description" span><textarea rows="3" value={form.description || ''} onChange={set('description')} /></Field>
            <div className="form-actions span2"><button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button><button className="btn primary">Save</button></div>
          </form>
        </Modal>
      )}

      {prog && (
        <Modal title={`Update: ${prog.title}`} onClose={() => setProg(null)}>
          <form onSubmit={saveProgress} className="form-grid">
            <Alert>{error}</Alert>
            <Field label="Status" span><select value={prog.status} onChange={(e) => setProg({ ...prog, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Actual start"><input type="date" value={prog.actual_start_date || ''} onChange={(e) => setProg({ ...prog, actual_start_date: e.target.value })} /></Field>
            <Field label="Actual end"><input type="date" value={prog.actual_end_date || ''} onChange={(e) => setProg({ ...prog, actual_end_date: e.target.value })} /></Field>
            <Field label="Actual hours logged" span><input type="number" min="0" step="0.25" value={prog.actual_hours} onChange={(e) => setProg({ ...prog, actual_hours: e.target.value })} /></Field>
            <p className="muted small span2">Tip: adding a daily work log updates actual hours automatically.</p>
            <div className="form-actions span2"><button type="button" className="btn" onClick={() => setProg(null)}>Cancel</button><button className="btn primary">Save</button></div>
          </form>
        </Modal>
      )}

      {logTask && <TaskLogs task={logTask} employees={employees} isAdmin={isAdmin} onClose={() => { setLogTask(null); load(); }} />}
    </>
  );
}

function TaskLogs({ task, employees, isAdmin, onClose }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const load = () => api.get(`/tasks/${task.id}/logs`).then((r) => setLogs(r.data.data)).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, []);

  const del = async (l) => {
    if (!confirm('Delete this log entry?')) return;
    try { await api.delete(`/logs/${l.id}`); load(); } catch (err) { setError(errMsg(err)); }
  };

  return (
    <Modal title={`Daily logs: ${task.title}`} onClose={onClose} wide>
      <Alert>{error}</Alert>
      {adding ? (
        <LogForm task={task} isAdmin={isAdmin} employees={employees} defaultType={isAdmin ? 'GENERAL' : user.workType}
          onSaved={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />
      ) : (
        <div className="form-actions" style={{ marginBottom: 12 }}><button className="btn primary" onClick={() => setAdding(true)}>+ Add work entry</button></div>
      )}
      <div className="table-wrap"><table>
        <thead><tr><th>Date</th><th>Employee</th><th>Work done</th><th>Hrs</th><th>Status</th><th></th></tr></thead>
        <tbody>{logs.length === 0 ? <tr><td colSpan="6"><Empty>No work logged yet.</Empty></td></tr> : logs.map((l) => (
          <tr key={l.id}><td>{fmtDate(l.log_date)}</td><td>{l.employee_name}<div><TypeBadge value={l.work_type} /></div></td>
            <td>{l.work_category && <b>{l.work_category}: </b>}{l.work_description}
              {(l.reference || l.tools_used) && <div className="muted small">{[l.reference, l.tools_used].filter(Boolean).join(' · ')}</div>}
              {l.test_result !== 'NA' && <div className="muted small">Result: {TEST_RESULT[l.test_result]}</div>}
              {l.remarks && <div className="muted small">{l.remarks}</div>}</td>
            <td>{l.hours}</td><td>{LOG_STATUS[l.status]}</td>
            <td><button className="btn small danger" onClick={() => del(l)}>Delete</button></td></tr>))}</tbody>
      </table></div>
    </Modal>
  );
}
