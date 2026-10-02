import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { Alert, Empty, PageHead, PRIORITY, PROJECT_STATUS, STATUS, Progress, WORK_TYPE, downloadCSV, fmtDate } from '../components';

const TABS = {
  teams: {
    label: 'Hardware vs Software',
    cols: [
      { label: 'Team', get: (r) => WORK_TYPE[r.work_type] }, { label: 'Employees', key: 'employees' }, { label: 'Tasks', key: 'total_tasks' },
      { label: 'Completed', key: 'completed_tasks' }, { label: 'Overdue', key: 'overdue_tasks' },
      { label: 'Est. hrs', key: 'estimated_hours' }, { label: 'Hours logged', key: 'logged_hours' }
    ]
  },
  projects: {
    label: 'Project progress',
    cols: [
      { label: 'Project', key: 'project_name' }, { label: 'Category', key: 'client_category' },
      { label: 'Status', get: (r) => PROJECT_STATUS[r.status] }, { label: 'Tasks', key: 'total_tasks' },
      { label: 'Completed', key: 'completed_tasks' }, { label: 'Overdue', key: 'overdue_tasks' },
      { label: 'Est. hrs', key: 'estimated_hours' }, { label: 'Actual hrs', key: 'actual_hours' },
      { label: 'Progress %', key: 'progress_percent' }
    ]
  },
  employees: {
    label: 'Employee tasks',
    cols: [
      { label: 'Code', key: 'employee_code' }, { label: 'Employee', key: 'full_name' }, { label: 'Team', get: (r) => WORK_TYPE[r.work_type] }, { label: 'Department', key: 'department' },
      { label: 'Tasks', key: 'total_tasks' }, { label: 'Completed', key: 'completed_tasks' }, { label: 'Overdue', key: 'overdue_tasks' },
      { label: 'Est. hrs', key: 'estimated_hours' }, { label: 'Hours logged', key: 'logged_hours' }
    ]
  },
  overdue: {
    label: 'Overdue tasks',
    cols: [
      { label: 'Task', key: 'title' }, { label: 'Project', key: 'project_name' }, { label: 'Assignee', key: 'assignee_name' },
      { label: 'Priority', get: (r) => PRIORITY[r.priority] }, { label: 'Status', get: (r) => STATUS[r.status] },
      { label: 'Due', get: (r) => fmtDate(r.end_date) }, { label: 'Days overdue', key: 'days_overdue' }
    ]
  },
  effort: {
    label: 'Estimated vs actual',
    cols: [
      { label: 'Task', key: 'title' }, { label: 'Project', key: 'project_name' }, { label: 'Assignee', key: 'assignee_name' },
      { label: 'Status', get: (r) => STATUS[r.status] }, { label: 'Estimated', key: 'estimated_hours' },
      { label: 'Actual', key: 'actual_hours' }, { label: 'Variance', key: 'variance_hours' }
    ]
  }
};

export default function Reports() {
  const [tab, setTab] = useState('teams');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setRows([]); setError('');
    api.get(`/reports/${tab}`).then((r) => setRows(r.data.data)).catch((e) => setError(errMsg(e)));
  }, [tab]);

  const { cols, label } = TABS[tab];
  const cell = (r, c) => {
    const v = c.get ? c.get(r) : r[c.key];
    if (c.key === 'progress_percent') return <div className="prog-cell"><Progress value={v} /><span>{v}%</span></div>;
    if (c.key === 'variance_hours') return <span className={v > 0 ? 'overdue' : ''}>{v > 0 ? `+${v}` : v}</span>;
    return v ?? '—';
  };

  return (
    <>
      <PageHead title="Reports" subtitle="Project, employee, overdue and effort summaries">
        <button className="btn" disabled={!rows.length} onClick={() => downloadCSV(`${tab}-report.csv`, rows, cols)}>Export CSV</button>
      </PageHead>
      <div className="tabs">{Object.entries(TABS).map(([k, t]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{t.label}</button>)}</div>
      <Alert>{error}</Alert>
      <section className="panel">
        <h3>{label}</h3>
        {rows.length === 0 ? <Empty>No data for this report.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr>{cols.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={r.id ?? i}>{cols.map((c) => <td key={c.label}>{cell(r, c)}</td>)}</tr>)}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
