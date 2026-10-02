import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth';
import {
  Alert, Badge, Empty, Field, LOG_STATUS, LogForm, Modal, PageHead, PRIORITY, TEST_RESULT, TypeBadge, WORK_TYPE,
  downloadCSV, fmtDate, todayStr
} from '../components';

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return todayStrOf(d); };
function todayStrOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const REPORT_STATUS = { DRAFT: 'Draft', SUBMITTED: 'Submitted', REVIEWED: 'Reviewed', RETURNED: 'Returned' };
const RB = (s) => <span className={`badge b-${String(s || 'draft').toLowerCase()}`}>{REPORT_STATUS[s] || 'Not submitted'}</span>;

const CSV_COLS = [
  { label: 'Date', key: 'log_date' }, { label: 'Employee', key: 'employee_name' }, { label: 'Team', get: (r) => WORK_TYPE[r.work_type] },
  { label: 'Project', key: 'project_name' }, { label: 'Task', key: 'task_title' }, { label: 'Category', key: 'work_category' },
  { label: 'Work', key: 'work_description' }, { label: 'Reference / device', key: 'reference' }, { label: 'Tools / equipment', key: 'tools_used' },
  { label: 'Test result', get: (r) => TEST_RESULT[r.test_result] }, { label: 'Hours', key: 'hours' },
  { label: 'Status', get: (r) => LOG_STATUS[r.status] }, { label: 'Remarks', key: 'remarks' }
];

export default function DailyReports() {
  const { isAdmin, user } = useAuth();
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [f, setF] = useState({ from: daysAgo(6), to: todayStr(), employee_id: '', work_type: '' });
  const [employees, setEmployees] = useState([]);

  // employee: tasks added automatically for the chosen day
  const [day, setDay] = useState(todayStr());
  const [myDay, setMyDay] = useState(null);
  const [logTask, setLogTask] = useState(null);
  const [reportForm, setReportForm] = useState(null);

  // admin: team overview + review
  const [ovDate, setOvDate] = useState(todayStr());
  const [ovType, setOvType] = useState('');
  const [overview, setOverview] = useState(null);
  const [review, setReview] = useState(null);

  const loadHistory = () => {
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
    Promise.all([api.get('/logs', { params }), api.get('/daily-reports', { params: { from: f.from, to: f.to, employee_id: f.employee_id || undefined } })])
      .then(([l, r]) => { setLogs(l.data.data); setReports(r.data.data); })
      .catch((e) => setError(errMsg(e)));
  };
  const loadMyDay = () => api.get('/daily-reports/my-day', { params: { date: day } })
    .then((r) => setMyDay(r.data.data)).catch((e) => setError(errMsg(e)));
  const loadOverview = () => api.get('/daily-reports/overview', { params: { date: ovDate, work_type: ovType || undefined } })
    .then((r) => setOverview(r.data.data)).catch((e) => setError(errMsg(e)));
  const refreshAll = () => { loadHistory(); isAdmin ? loadOverview() : loadMyDay(); };

  useEffect(loadHistory, [f]);
  useEffect(() => { if (!isAdmin) loadMyDay(); }, [day, isAdmin]);
  useEffect(() => { if (isAdmin) loadOverview(); }, [ovDate, ovType, isAdmin]);
  useEffect(() => { if (isAdmin) api.get('/employees').then((r) => setEmployees(r.data.data)).catch(() => {}); }, [isAdmin]);

  // ---------- employee: daily report with auto-filled text ----------
  const buildAuto = () => {
    const done = (myDay?.tasks || []).filter((t) => t.log_id);
    const summary = done.map((t) => `• ${t.title}${t.work_category ? ` (${t.work_category})` : ''}: ${t.today_work} — ${t.today_hours} h`).join('\n');
    const blockers = done.filter((t) => t.log_status === 'BLOCKED' || t.remarks).map((t) => `• ${t.title}: ${t.remarks || 'Blocked'}`).join('\n');
    return { summary, blockers };
  };
  const openReport = () => {
    setError('');
    const r = myDay?.report;
    const auto = buildAuto();
    setReportForm({
      report_date: day, status: 'SUBMITTED',
      summary: r?.summary || auto.summary, blockers: r?.blockers || auto.blockers, tomorrow_plan: r?.tomorrow_plan || ''
    });
  };
  const submitReport = async (e) => {
    e.preventDefault(); setError('');
    try { await api.post('/daily-reports', reportForm); setReportForm(null); refreshAll(); }
    catch (err) { setError(errMsg(err)); }
  };
  const reviewReport = async (e) => {
    e.preventDefault(); setError('');
    try { await api.patch(`/daily-reports/${review.id}/review`, review); setReview(null); refreshAll(); }
    catch (err) { setError(errMsg(err)); }
  };
  const del = async (l) => {
    if (!confirm('Delete this work entry?')) return;
    try { await api.delete(`/logs/${l.id}`); refreshAll(); } catch (err) { setError(errMsg(err)); }
  };
  const rset = (k) => (e) => setReportForm({ ...reportForm, [k]: e.target.value });
  const fset = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const total = logs.reduce((s, l) => s + Number(l.hours || 0), 0);
  const logInitial = (t) => t.log_id ? {
    id: t.log_id, log_date: day, hours: t.today_hours, work_description: t.today_work, status: t.log_status,
    work_type: t.log_work_type, work_category: t.work_category, reference: t.reference, tools_used: t.tools_used,
    test_result: t.test_result, remarks: t.remarks
  } : { log_date: day };

  return (
    <>
      <PageHead title="Daily Work & Reports"
        subtitle={isAdmin ? 'See what each Hardware and Software employee did today, and review their reports.' : 'Your assigned tasks appear here automatically. Log your work and send the daily report to HR.'}>
        <button className="btn" disabled={!logs.length} onClick={() => downloadCSV('daily-work-report.csv', logs, CSV_COLS)}>Export work CSV</button>
        {!isAdmin && <button className="btn primary" onClick={openReport}>{myDay?.report ? 'Update daily report' : '+ Daily report to HR'}</button>}
      </PageHead>
      {!logTask && !reportForm && !review && <Alert>{error}</Alert>}

      {/* ================= EMPLOYEE: tasks added automatically ================= */}
      {!isAdmin && (
        <section className="panel">
          <div className="between wrap">
            <div>
              <h3>{day === todayStr() ? "Today's tasks" : `Tasks for ${fmtDate(day)}`} <TypeBadge value={myDay?.work_type} /></h3>
              <p className="muted small">Added automatically from the tasks your admin assigned to you. Just add the hours and what you did.</p>
            </div>
            <label className="inline">Date <input type="date" max={todayStr()} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></label>
          </div>
          {myDay && <p className="chips"><span>{myDay.summary.assigned} tasks</span><span>{myDay.summary.logged} logged</span><span>{myDay.summary.hours} hours</span>
            <span>Daily report: {RB(myDay.report?.status)}</span></p>}
          {!myDay ? <Empty>Loading…</Empty> : myDay.tasks.length === 0 ? <Empty>No open tasks assigned to you for this day. Your admin will assign tasks.</Empty> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Task</th><th>Priority</th><th>Due</th><th>Status</th><th>{day === todayStr() ? "Today's work" : 'Work logged'}</th><th></th></tr></thead>
              <tbody>{myDay.tasks.map((t) => (
                <tr key={t.id} className={t.is_overdue ? 'row-overdue' : ''}>
                  <td><b>{t.title}</b> <TypeBadge value={t.task_type} /><div className="muted small">{t.project_name}</div></td>
                  <td><Badge value={t.priority} map={PRIORITY} /></td>
                  <td className={t.is_overdue ? 'overdue' : ''}>{fmtDate(t.end_date)}{t.is_overdue && ' (overdue)'}</td>
                  <td>{t.status.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}</td>
                  <td>{t.log_id ? <><b>{t.today_hours} h</b>{t.work_category && ` · ${t.work_category}`}<div className="muted small">{t.today_work}</div></> : <span className="muted">Not logged yet</span>}</td>
                  <td><button className={`btn small ${t.log_id ? '' : 'primary'}`} onClick={() => { setError(''); setLogTask(t); }}>{t.log_id ? 'Edit' : 'Log work'}</button></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </section>
      )}

      {/* ================= ADMIN: team overview ================= */}
      {isAdmin && (
        <section className="panel">
          <div className="between wrap">
            <div><h3>Team overview</h3><p className="muted small">Who has logged work and sent a report on the selected day.</p></div>
            <label className="inline">Date <input type="date" max={todayStr()} value={ovDate} onChange={(e) => e.target.value && setOvDate(e.target.value)} /></label>
          </div>
          <div className="tabs">
            {[['', 'All teams'], ['HARDWARE', 'Hardware'], ['SOFTWARE', 'Software'], ['GENERAL', 'General']].map(([k, v]) => (
              <button key={k} className={ovType === k ? 'active' : ''} onClick={() => setOvType(k)}>{v}</button>))}
          </div>
          {overview && <p className="chips"><span>{overview.totals.employees} employee{overview.totals.employees === 1 ? '' : 's'}</span><span>{overview.totals.logged} logged work</span>
            <span>{overview.totals.reported} sent a report</span><span>{overview.totals.hours} hours</span></p>}
          {!overview ? <Empty>Loading…</Empty> : overview.employees.length === 0 ? <Empty>No employees in this team yet. Set each employee's team on the Employees page.</Empty> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Employee</th><th>Team</th><th>Open tasks</th><th>Entries</th><th>Hours</th><th>Daily report</th><th></th></tr></thead>
              <tbody>{overview.employees.map((e) => (
                <tr key={e.id}>
                  <td><b>{e.full_name}</b><div className="muted small">{e.designation || e.department || ''}</div></td>
                  <td><TypeBadge value={e.work_type} /></td><td>{e.open_tasks}</td>
                  <td className={e.log_entries ? '' : 'overdue'}>{e.log_entries || 'None'}</td><td>{e.hours}</td>
                  <td>{RB(e.report_status)}</td>
                  <td><button className="btn small" onClick={() => setF({ ...f, from: ovDate, to: ovDate, employee_id: String(e.id) })}>View work</button></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </section>
      )}

      {/* ================= history ================= */}
      <div className="filters">
        <label className="inline">From <input type="date" value={f.from} onChange={fset('from')} /></label>
        <label className="inline">To <input type="date" value={f.to} onChange={fset('to')} /></label>
        {isAdmin && <select value={f.employee_id} onChange={fset('employee_id')}><option value="">All employees</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>}
        {isAdmin && <select value={f.work_type} onChange={fset('work_type')}><option value="">Hardware & Software</option>{Object.entries(WORK_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
        <span className="muted">{logs.length} work entries · <b>{total}</b> hours · {reports.length} report{reports.length === 1 ? '' : 's'}</span>
      </div>

      <section className="panel"><h3>Work entries</h3>
        {logs.length === 0 ? <Empty>No work logged in this period.</Empty> : <div className="table-wrap"><table>
          <thead><tr><th>Date</th>{isAdmin && <th>Employee</th>}<th>Project / Task</th><th>Work done</th><th>Hrs</th><th>Status</th><th></th></tr></thead>
          <tbody>{logs.map((l) => (
            <tr key={l.id}><td>{fmtDate(l.log_date)}</td>
              {isAdmin && <td>{l.employee_name}<div><TypeBadge value={l.work_type} /></div></td>}
              <td>{l.project_name}<div className="muted small">{l.task_title}</div></td>
              <td>{l.work_category && <b>{l.work_category}: </b>}{l.work_description}
                {(l.reference || l.tools_used) && <div className="muted small">{[l.reference, l.tools_used].filter(Boolean).join(' · ')}</div>}
                {l.test_result !== 'NA' && <div className="muted small">Result: {TEST_RESULT[l.test_result]}</div>}
                {l.remarks && <div className="muted small">{l.remarks}</div>}</td>
              <td>{l.hours}</td><td>{LOG_STATUS[l.status]}</td>
              <td><button className="btn small danger" onClick={() => del(l)}>Delete</button></td></tr>))}</tbody>
        </table></div>}
      </section>

      <section className="panel">
        <div className="between"><h3>Daily reports to HR</h3><span className="muted small">Submitted → HR reviews → Returned if changes are needed</span></div>
        {reports.length === 0 ? <Empty>No daily reports in this period.</Empty> : <div className="table-wrap"><table>
          <thead><tr><th>Date</th>{isAdmin && <th>Employee</th>}<th>Summary</th><th>Blockers</th><th>Tomorrow</th><th>Status</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>{reports.map((r) => (
            <tr key={r.id}><td>{fmtDate(r.report_date)}</td>
              {isAdmin && <td><b>{r.employee_name}</b><div><TypeBadge value={r.work_type} /></div></td>}
              <td className="pre">{r.summary}</td><td className="pre">{r.blockers || '—'}</td><td className="pre">{r.tomorrow_plan || '—'}</td>
              <td>{RB(r.status)}{r.hr_comment && <div className="muted small">HR: {r.hr_comment}</div>}</td>
              {isAdmin && <td>{r.status === 'SUBMITTED' && <button className="btn small" onClick={() => setReview({ id: r.id, status: 'REVIEWED', hr_comment: '' })}>Review</button>}</td>}</tr>))}</tbody>
        </table></div>}
      </section>

      {logTask && (
        <Modal title={`${logTask.log_id ? 'Edit' : 'Log'} work: ${logTask.title}`} onClose={() => setLogTask(null)}>
          <LogForm task={{ id: logTask.id, assigned_to: user.employeeId, task_type: logTask.task_type }}
            initial={logInitial(logTask)} defaultType={user.workType}
            onSaved={() => { setLogTask(null); refreshAll(); }} onCancel={() => setLogTask(null)} />
        </Modal>
      )}

      {reportForm && (
        <Modal title="Daily report to HR" onClose={() => setReportForm(null)}>
          <form onSubmit={submitReport} className="form-grid"><Alert>{error}</Alert>
            <Field label="Report date"><input type="date" max={todayStr()} value={reportForm.report_date} onChange={rset('report_date')} required /></Field>
            <Field label="Submission"><select value={reportForm.status} onChange={rset('status')}><option value="SUBMITTED">Submit to HR</option><option value="DRAFT">Save draft</option></select></Field>
            <div className="span2 between"><span className="muted small">Filled from the work you logged. You can edit it.</span>
              <button type="button" className="btn small" onClick={() => setReportForm({ ...reportForm, ...buildAuto() })}>Re-fill from my work</button></div>
            <Field label="What did you complete? *" span><textarea rows="6" value={reportForm.summary} onChange={rset('summary')} required /></Field>
            <Field label="Problems / blockers" span><textarea rows="3" value={reportForm.blockers} onChange={rset('blockers')} /></Field>
            <Field label="Tomorrow's plan" span><textarea rows="3" value={reportForm.tomorrow_plan} onChange={rset('tomorrow_plan')} /></Field>
            <div className="form-actions span2"><button type="button" className="btn" onClick={() => setReportForm(null)}>Cancel</button>
              <button className="btn primary">{reportForm.status === 'DRAFT' ? 'Save draft' : 'Submit to HR'}</button></div>
          </form>
        </Modal>
      )}

      {review && (
        <Modal title="HR review" onClose={() => setReview(null)}>
          <form onSubmit={reviewReport} className="form-grid"><Alert>{error}</Alert>
            <Field label="Decision" span><select value={review.status} onChange={(e) => setReview({ ...review, status: e.target.value })}><option value="REVIEWED">Reviewed / Accepted</option><option value="RETURNED">Return to employee</option></select></Field>
            <Field label="HR comment" span><textarea rows="4" value={review.hr_comment} onChange={(e) => setReview({ ...review, hr_comment: e.target.value })} placeholder="Optional feedback for the employee" /></Field>
            <div className="form-actions span2"><button type="button" className="btn" onClick={() => setReview(null)}>Cancel</button><button className="btn primary">Save review</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
