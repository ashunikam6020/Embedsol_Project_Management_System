import { useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth';
import { Alert, Field, PageHead } from '../components';

export default function Settings() {
  const { user } = useAuth();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  const submit = async (e) => {
    e.preventDefault();
    if (f.newPassword !== f.confirm) return setMsg({ type: 'error', text: 'New passwords do not match' });
    try {
      await api.post('/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      setF({ currentPassword: '', newPassword: '', confirm: '' });
      setMsg({ type: 'success', text: 'Password changed successfully' });
    } catch (err) { setMsg({ type: 'error', text: errMsg(err) }); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <PageHead title="Settings" subtitle="Your account" />
      <section className="panel narrow">
        <h3>Profile</h3>
        <p><b>{user.fullName}</b><br /><span className="muted">{user.email} · {user.role === 'ADMIN' ? 'Administrator' : 'Employee'}{user.department ? ` · ${user.department}` : ''}</span></p>
      </section>
      <section className="panel narrow">
        <h3>Change password</h3>
        <form onSubmit={submit} className="form-grid one">
          <Alert type={msg.type}>{msg.text}</Alert>
          <Field label="Current password"><input type="password" value={f.currentPassword} onChange={set('currentPassword')} required /></Field>
          <Field label="New password (min 6)"><input type="password" minLength="6" value={f.newPassword} onChange={set('newPassword')} required /></Field>
          <Field label="Confirm new password"><input type="password" value={f.confirm} onChange={set('confirm')} required /></Field>
          <div className="form-actions"><button className="btn primary">Update password</button></div>
        </form>
      </section>
    </>
  );
}
