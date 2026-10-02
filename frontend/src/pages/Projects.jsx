import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth';
import { Alert, Badge, Empty, Field, Modal, PageHead, PROJECT_STATUS, Progress, STATUS, PRIORITY, fmtDate } from '../components';

const blank = {
  project_name: '', client_category: '', description: '', start_date: '', end_date: '',
  status: 'PLANNING', project_type: 'BOTH', responsible_employee_id: '', materials: []
};

const newMaterial = (type) => type === 'HARDWARE'
  ? { material_type: 'HARDWARE', material_name: '', quantity: '', unit: '', remarks: '', software_kind: '', version: '' }
  : { material_type: 'SOFTWARE', material_name: '', quantity: '', unit: '', remarks: '', software_kind: 'LANGUAGE', version: '' };

export default function Projects() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = () => api.get('/projects').then((r) => setRows(r.data.data)).catch((e) => setError(errMsg(e)));
  const loadEmployees = () => api.get('/employees').then((r) => setEmployees(r.data.data.filter((e) => e.is_active))).catch(() => {});
  useEffect(() => { load(); loadEmployees(); }, []);

  const save = async (e) => {
    e.preventDefault(); setError('');
    try {
      const payload = { ...form, responsible_employee_id: form.responsible_employee_id || null };
      form.id ? await api.put(`/projects/${form.id}`, payload) : await api.post('/projects', payload);
      setForm(null); load();
    } catch (err) { setError(errMsg(err)); }
  };
  const remove = async (p) => {
    if (!confirm(`Delete project "${p.project_name}" and all its tasks?`)) return;
    try { await api.delete(`/projects/${p.id}`); load(); } catch (err) { setError(errMsg(err)); }
  };
  const open = async (p) => {
    try { setDetail((await api.get(`/projects/${p.id}`)).data.data); } catch (err) { setError(errMsg(err)); }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const edit = async (p) => {
    try {
      const d = (await api.get(`/projects/${p.id}`)).data.data;
      setError('');
      setForm({ ...blank, ...d, responsible_employee_id: d.responsible_employee_id || '', materials: d.materials || [] });
    } catch (err) { setError(errMsg(err)); }
  };
  const addMaterial = (type) => setForm({ ...form, materials: [...(form.materials || []), newMaterial(type)] });
  const updateMaterial = (i, key, value) => setForm({ ...form, materials: form.materials.map((m, idx) => idx === i ? { ...m, [key]: value } : m) });
  const removeMaterial = (i) => setForm({ ...form, materials: form.materials.filter((_, idx) => idx !== i) });
  const hardware = (form?.materials || []).map((m, i) => ({ ...m, _i: i })).filter((m) => m.material_type === 'HARDWARE');
  const software = (form?.materials || []).map((m, i) => ({ ...m, _i: i })).filter((m) => m.material_type === 'SOFTWARE');

  return (
    <>
      <PageHead title="Projects" subtitle="Project directory with responsible person, tasks and project materials">
        {isAdmin && <button className="btn primary" onClick={() => { setError(''); setForm({ ...blank, materials: [] }); }}>+ New Project</button>}
      </PageHead>
      {!form && <Alert>{error}</Alert>}

      {rows.length === 0 ? <Empty>No projects yet.</Empty> : (
        <div className="project-grid">
          {rows.map((p) => (
            <div className="card project" key={p.id}>
              <div className="between"><h3>{p.project_name}</h3><Badge value={p.status} map={PROJECT_STATUS} /></div>
              <p className="muted small">{p.client_category || 'No category'} · {p.project_type || 'BOTH'}</p>
              <p className="small"><b>Responsible:</b> {p.responsible_person || 'Not assigned'}</p>
              <p className="muted small">{fmtDate(p.start_date)} → {fmtDate(p.end_date)}</p>
              <div className="between small"><span>{p.completed_tasks}/{p.total_tasks} tasks done</span><b>{p.progress}%</b></div>
              <Progress value={p.progress} />
              {p.overdue_tasks > 0 && <p className="overdue small">{p.overdue_tasks} overdue task(s)</p>}
              <div className="row-actions">
                <button className="btn small" onClick={() => open(p)}>View</button>
                {isAdmin && <><button className="btn small" onClick={() => edit(p)}>Edit</button><button className="btn small danger" onClick={() => remove(p)}>Delete</button></>}
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={form.id ? 'Edit Project' : 'New Project'} onClose={() => setForm(null)} wide>
          <form onSubmit={save} className="form-grid">
            <Alert>{error}</Alert>
            <Field label="Project name *" span><input value={form.project_name} onChange={set('project_name')} required /></Field>
            <Field label="Client / category"><input value={form.client_category || ''} onChange={set('client_category')} /></Field>
            <Field label="Project type"><select value={form.project_type || 'BOTH'} onChange={set('project_type')}><option value="BOTH">Hardware + Software</option><option value="HARDWARE">Hardware</option><option value="SOFTWARE">Software</option></select></Field>
            <Field label="Responsible person *"><select value={form.responsible_employee_id || ''} onChange={set('responsible_employee_id')} required><option value="">Select employee</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.work_type || 'GENERAL'})</option>)}</select></Field>
            <Field label="Status"><select value={form.status} onChange={set('status')}>{Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Target start"><input type="date" value={form.start_date || ''} onChange={set('start_date')} /></Field>
            <Field label="Target end"><input type="date" value={form.end_date || ''} onChange={set('end_date')} /></Field>
            <Field label="Description" span><textarea rows="3" value={form.description || ''} onChange={set('description')} /></Field>

            <div className="span2 project-material-box">
              <div className="project-material-title">
                <div><b>Project Materials & Technology</b><div className="muted small">Add only the Hardware items and Software technologies used in this project.</div></div>
                <div className="row-actions"><button type="button" className="btn small" onClick={() => addMaterial('HARDWARE')}>+ Hardware</button><button type="button" className="btn small" onClick={() => addMaterial('SOFTWARE')}>+ Software</button></div>
              </div>

              <div className="material-columns">
                <section className="material-list hardware-list">
                  <div className="material-list-head"><h4>Hardware List</h4><span>{hardware.length}</span></div>
                  {hardware.length === 0 ? <p className="muted small">No hardware added.</p> : hardware.map((m) => (
                    <div className="material-item" key={m._i}>
                      <Field label="Hardware name"><input value={m.material_name} onChange={(e) => updateMaterial(m._i, 'material_name', e.target.value)} placeholder="ESP32, Gateway Box, RS485 Module" required /></Field>
                      <div className="material-mini-grid"><Field label="Qty"><input type="number" min="0" step="0.01" value={m.quantity} onChange={(e) => updateMaterial(m._i, 'quantity', e.target.value)} /></Field><Field label="Unit"><input value={m.unit} onChange={(e) => updateMaterial(m._i, 'unit', e.target.value)} placeholder="pcs" /></Field></div>
                      <Field label="Remarks"><input value={m.remarks} onChange={(e) => updateMaterial(m._i, 'remarks', e.target.value)} /></Field>
                      <button type="button" className="btn small danger" onClick={() => removeMaterial(m._i)}>Remove</button>
                    </div>
                  ))}
                </section>

                <section className="material-list software-list">
                  <div className="material-list-head"><h4>Software / Technology List</h4><span>{software.length}</span></div>
                  {software.length === 0 ? <p className="muted small">No software technologies added.</p> : software.map((m) => (
                    <div className="material-item" key={m._i}>
                      <div className="material-mini-grid"><Field label="Type"><select value={m.software_kind || 'LANGUAGE'} onChange={(e) => updateMaterial(m._i, 'software_kind', e.target.value)}><option value="LANGUAGE">Programming Language</option><option value="FRAMEWORK">Framework</option><option value="TOOL">Tool</option><option value="DATABASE">Database</option><option value="OTHER">Other</option></select></Field><Field label="Version"><input value={m.version || ''} onChange={(e) => updateMaterial(m._i, 'version', e.target.value)} placeholder="e.g. 20.x" /></Field></div>
                      <Field label="Technology name"><input value={m.material_name} onChange={(e) => updateMaterial(m._i, 'material_name', e.target.value)} placeholder="JavaScript, React, Express.js, MariaDB" required /></Field>
                      <button type="button" className="btn small danger" onClick={() => removeMaterial(m._i)}>Remove</button>
                    </div>
                  ))}
                </section>
              </div>
            </div>

            <div className="form-actions span2"><button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button><button className="btn primary">Save Project</button></div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={detail.project_name} onClose={() => setDetail(null)} wide>
          <p className="muted">{detail.description || 'No description.'}</p>
          <div className="form-grid" style={{ marginBottom: 16 }}><div><b>Type:</b> {detail.project_type}</div><div><b>Responsible:</b> {detail.responsible_person || 'Not assigned'}</div></div>
          <h4>Hardware & Software</h4>
          <div className="material-columns detail-material-columns">
            <section className="material-list hardware-list"><div className="material-list-head"><h4>Hardware</h4><span>{detail.materials?.filter((m) => m.material_type === 'HARDWARE').length || 0}</span></div>{detail.materials?.filter((m) => m.material_type === 'HARDWARE').map((m) => <div className="detail-material" key={m.id}><b>{m.material_name}</b><span>{m.quantity ?? '—'} {m.unit || ''}</span><small>{m.remarks || ''}</small></div>)}</section>
            <section className="material-list software-list"><div className="material-list-head"><h4>Software / Technology</h4><span>{detail.materials?.filter((m) => m.material_type === 'SOFTWARE').length || 0}</span></div>{detail.materials?.filter((m) => m.material_type === 'SOFTWARE').map((m) => <div className="detail-material" key={m.id}><b>{m.material_name}</b><span>{m.software_kind || 'SOFTWARE'} {m.version ? `· ${m.version}` : ''}</span><small>{m.remarks || ''}</small></div>)}</section>
          </div>
          <h4 style={{ marginTop: 18 }}>Tasks</h4>
          <div className="table-wrap"><table><thead><tr><th>Task</th><th>Type</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead><tbody>{detail.tasks.length === 0 ? <tr><td colSpan="6"><Empty>No tasks in this project.</Empty></td></tr> : detail.tasks.map((t) => <tr key={t.id}><td>{t.title}</td><td>{t.task_type}</td><td>{t.assignee_name || '—'}</td><td><Badge value={t.priority} map={PRIORITY} /></td><td><Badge value={t.status} map={STATUS} /></td><td>{fmtDate(t.end_date)}</td></tr>)}</tbody></table></div>
        </Modal>
      )}
    </>
  );
}
