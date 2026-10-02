import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth';
import { Alert, Empty, Field, Modal, PageHead, TypeBadge, WORK_TYPE } from '../components';

const blank = { full_name: '', work_email: '', department: '', designation: '', role: 'EMPLOYEE', work_type: 'GENERAL', password: '' };

export default function Employees() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [team, setTeam] = useState('');

  const load = () => api.get('/employees').then((r) => setRows(r.data.data)).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setError('');
    try {
      form.id ? await api.put(`/employees/${form.id}`, form) : await api.post('/employees', form);
      setForm(null); load();
    } catch (err) { setError(errMsg(err)); }
  };
  const toggle = async (emp) => {
    try { await api.patch(`/employees/${emp.id}/status`, { is_active: !emp.is_active }); load(); }
    catch (err) { setError(errMsg(err)); }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHead title="Employees" subtitle="Team members and their login accounts">
        <button className="btn primary" onClick={() => { setError(''); setForm(blank); }}>+ Add Employee</button>
      </PageHead>
      {!form && <Alert>{error}</Alert>}
      <div className="tabs">
        {[['', 'All'], ...Object.entries(WORK_TYPE)].map(([k, v]) => (
          <button key={k} className={team === k ? 'active' : ''} onClick={() => setTeam(k)}>
            {v} ({k ? rows.filter((r) => r.work_type === k).length : rows.length})
          </button>
        ))}
      </div>
      <section className="panel">
        {rows.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Code</th><th>Name</th><th>Work email</th><th>Department</th><th>Designation</th><th>Team</th><th>Role</th><th>Open tasks</th><th>Status</th><th></th></tr></thead>
            <tbody>{rows.filter((r) => !team || r.work_type === team).map((r) => (
              <tr key={r.id} className={r.is_active ? '' : 'inactive'}>
                <td>{r.employee_code}</td><td><b>{r.full_name}</b></td><td>{r.work_email}</td>
                <td>{r.department || '—'}</td><td>{r.designation || '—'}</td>
                <td><TypeBadge value={r.work_type} /></td>
                <td>{r.role === 'ADMIN' ? 'Administrator' : 'Employee'}</td><td>{r.open_tasks}</td>
                <td><span className={`badge ${r.is_active ? 'b-completed' : 'b-cancelled'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="row-actions">
                  <button className="btn small" onClick={() => { setError(''); setForm({ ...blank, ...r, password: '' }); }}>Edit</button>
                  {r.id !== user.employeeId && <button className="btn small" onClick={() => toggle(r)}>{r.is_active ? 'Deactivate' : 'Activate'}</button>}
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>

      {form && (
        <Modal title={form.id ? 'Edit Employee' : 'Add Employee'} onClose={() => setForm(null)}>
          <form onSubmit={save} className="form-grid">
            <Alert>{error}</Alert>
            <Field label="Full name *"><input value={form.full_name} onChange={set('full_name')} required /></Field>
            <Field label="Work email * (login ID)"><input type="email" value={form.work_email} onChange={set('work_email')} required /></Field>
            <Field label="Department"><input value={form.department || ''} onChange={set('department')} /></Field>
            <Field label="Designation"><input value={form.designation || ''} onChange={set('designation')} /></Field>
            <Field label="Team (daily work form) *"><select value={form.work_type || 'GENERAL'} onChange={set('work_type')}>
              <option value="HARDWARE">Hardware</option><option value="SOFTWARE">Software</option><option value="GENERAL">General / Management</option></select></Field>
            <Field label="Role"><select value={form.role || 'EMPLOYEE'} onChange={set('role')}><option value="EMPLOYEE">Employee</option><option value="ADMIN">Administrator</option></select></Field>
            <Field label={form.id ? 'New password (optional)' : 'Password * (min 6)'}><input type="password" minLength="6" value={form.password} onChange={set('password')} required={!form.id} /></Field>
            <div className="form-actions span2"><button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button><button className="btn primary">Save</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
