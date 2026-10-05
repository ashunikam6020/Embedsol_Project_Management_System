import { useEffect, useState } from 'react';
import api, { errMsg } from './api';

export const STATUS = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed'
};

// New Task workflow status
export const TASK_WORKFLOW_STATUS = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

export const PRIORITY = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical'
};

export const PROJECT_STATUS = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

export const LOG_STATUS = {
  WORKING: 'Working',
  COMPLETED: 'Completed',
  BLOCKED: 'Blocked'
};

export const fmtDate = (d) => {
  if (!d) return '—';
  const x = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
// Local date (not UTC) so "today" is correct all day in India
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const WORK_TYPE = { HARDWARE: 'Hardware', SOFTWARE: 'Software', GENERAL: 'General' };
export const TEST_RESULT = { NA: 'Not applicable', PASS: 'Passed', FAIL: 'Failed', PARTIAL: 'Partially passed' };

// The daily-work form changes for Hardware and Software employees
export const WORK_CONFIG = {
  HARDWARE: {
    categories: ['PCB / Schematic Design', 'Firmware Development', 'Hardware Testing', 'Assembly / Soldering', 'Calibration', 'Debugging / Troubleshooting', 'Field Installation / Commissioning', 'Documentation', 'Other'],
    referenceLabel: 'Device / board / serial no.', referencePlaceholder: 'e.g. Gateway GW-01 rev B',
    toolsLabel: 'Equipment / components used', toolsPlaceholder: 'e.g. Oscilloscope, USB-RS485, soldering station',
    testLabel: 'Test result', descPlaceholder: 'e.g. Calibrated RS485 timing and verified readings on the bench'
  },
  SOFTWARE: {
    categories: ['Frontend', 'Backend / API', 'Database', 'Bug Fix', 'Testing / QA', 'DevOps / Deployment', 'Code Review', 'Documentation', 'Other'],
    referenceLabel: 'Module / ticket / commit', referencePlaceholder: 'e.g. API-14, PR #21',
    toolsLabel: 'Technology / tools used', toolsPlaceholder: 'e.g. Node.js, MariaDB, Postman',
    testLabel: 'Test / build result', descPlaceholder: 'e.g. Implemented meter readings endpoint and added validation'
  },
  GENERAL: {
    categories: ['Planning', 'Meeting', 'Documentation', 'Support', 'Other'],
    referenceLabel: 'Reference', referencePlaceholder: '',
    toolsLabel: 'Tools used', toolsPlaceholder: '',
    testLabel: 'Outcome', descPlaceholder: 'What did you work on?'
  }
};

export const TypeBadge = ({ value }) => (
  value ? <span className={`badge t-${String(value).toLowerCase()}`}>{WORK_TYPE[value] || value}</span> : null
);

export function Badge({ value, map }) {
  return <span className={`badge b-${String(value).toLowerCase()}`}>{map?.[value] || value}</span>;
}

export function Progress({ value }) {
  return (
    <div className="progress" title={`${value}%`}>
      <div style={{ width: `${value}%` }} />
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label, children, span }) => (
  <label className={`field ${span ? 'span2' : ''}`}><span>{label}</span>{children}</label>
);

export const Alert = ({ children, type = 'error' }) => (children ? <div className={`alert ${type}`}>{children}</div> : null);

export const Empty = ({ children = 'Nothing to show yet.' }) => <div className="empty">{children}</div>;

export const PageHead = ({ title, subtitle, children }) => (
  <div className="page-head">
    <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    <div className="actions">{children}</div>
  </div>
);

export function toCSV(rows, columns) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => esc(c.label)).join(',')];
  rows.forEach((r) => lines.push(columns.map((c) => esc(c.get ? c.get(r) : r[c.key])).join(',')));
  return lines.join('\n');
}
export function downloadCSV(name, rows, columns) {
  const blob = new Blob([toCSV(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}


// Daily work entry form. Fields and labels follow the Hardware / Software work type.
export function LogForm({ task, initial = {}, defaultType = 'GENERAL', isAdmin, employees = [], onSaved, onCancel }) {
  const startType = initial.work_type || (defaultType !== 'GENERAL' ? defaultType : task.task_type) || 'GENERAL';
  const [f, setF] = useState({
    log_date: initial.log_date || todayStr(),
    hours: initial.hours ?? '',
    work_type: startType,
    work_category: initial.work_category || '',
    reference: initial.reference || '',
    tools_used: initial.tools_used || '',
    test_result: initial.test_result || 'NA',
    status: initial.status || 'WORKING',
    work_description: initial.work_description || '',
    remarks: initial.remarks || '',
    employee_id: task.assigned_to || ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cfg = WORK_CONFIG[f.work_type] || WORK_CONFIG.GENERAL;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { await api.post(`/tasks/${task.id}/logs`, f); onSaved(); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="form-grid">
      <Alert>{error}</Alert>
      <Field label="Date"><input type="date" max={todayStr()} value={f.log_date} onChange={set('log_date')} required /></Field>
      <Field label="Hours worked *"><input type="number" min="0.25" max="24" step="0.25" value={f.hours} onChange={set('hours')} required /></Field>
      <Field label="Work type"><select value={f.work_type} onChange={(e) => setF({ ...f, work_type: e.target.value, work_category: '' })}>
        {Object.entries(WORK_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Category"><select value={f.work_category} onChange={set('work_category')}>
        <option value="">Select…</option>{cfg.categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label={cfg.referenceLabel}><input value={f.reference} onChange={set('reference')} placeholder={cfg.referencePlaceholder} /></Field>
      <Field label={cfg.toolsLabel}><input value={f.tools_used} onChange={set('tools_used')} placeholder={cfg.toolsPlaceholder} /></Field>
      <Field label={cfg.testLabel}><select value={f.test_result} onChange={set('test_result')}>
        {Object.entries(TEST_RESULT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Task status after today"><select value={f.status} onChange={set('status')}>
        {Object.entries(LOG_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      {isAdmin && !task.assigned_to && (
        <Field label="Employee" span><select value={f.employee_id} onChange={set('employee_id')} required>
          <option value="">Select employee</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></Field>
      )}
      <Field label="Work completed *" span><textarea rows="3" value={f.work_description} onChange={set('work_description')} placeholder={cfg.descPlaceholder} required /></Field>
      <Field label="Remarks / problems" span><input value={f.remarks} onChange={set('remarks')} placeholder="Optional" /></Field>
      <div className="form-actions span2">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : initial.id || initial.hours ? 'Update entry' : 'Save entry'}</button>
      </div>
    </form>
  );
}
