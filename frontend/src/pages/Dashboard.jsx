import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../auth';
import { Alert, Badge, Empty, PageHead, PRIORITY, Progress, STATUS, TypeBadge, WORK_TYPE, fmtDate } from '../components';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [d, setD] = useState(null);
  const [todayReport, setTodayReport] = useState(null);
  const [myDay, setMyDay] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard').then((r) => setD(r.data.data)).catch((e) => setError(errMsg(e)));
    if (!isAdmin) {
      api.get('/daily-reports/today').then((r) => setTodayReport(r.data.data)).catch(() => {});
      api.get('/daily-reports/my-day').then((r) => setMyDay(r.data.data)).catch(() => {});
    }
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!d) return <div className="center">Loading…</div>;
  const t = d.tasks;
  const bars = [['Not Started', t.not_started, '#98a2b3'], ['In Progress', t.in_progress, '#2454c6'], ['On Hold', t.on_hold, '#f79009'], ['Completed', t.completed, '#12b76a']];

  return (
    <>
      <PageHead title={`Welcome back, ${user.fullName.split(' ')[0]}!`}
        subtitle={isAdmin ? 'Manage projects, tasks and team performance.' : 'Here is your work at a glance.'} />

      {!isAdmin && <section className="panel employee-today">
        <div><h3>Today's work <TypeBadge value={user.workType} /></h3>
          <p className="muted">{myDay ? `${myDay.summary.assigned} task(s) added automatically · ${myDay.summary.logged} logged · ${myDay.summary.hours} h today` : 'Your assigned tasks appear in Daily Work automatically.'}</p></div>
        <div className="row-actions"><span className={`badge b-${String(todayReport?.status || 'DRAFT').toLowerCase()}`}>{todayReport?.status || 'NOT SUBMITTED'}</span><Link className="btn primary" to="/daily">{myDay && myDay.summary.logged < myDay.summary.assigned ? 'Log today\'s work' : todayReport ? 'Open report' : 'Submit daily report'}</Link></div>
      </section>}

      <section className="cards">
        <div className="card card-projects"><span>{isAdmin ? 'Total Projects' : 'My Projects'}</span><strong>{d.projects.total}</strong><small>{d.projects.active} active</small></div>
        <div className="card card-tasks"><span>{isAdmin ? 'Total Tasks' : 'My Tasks'}</span><strong>{t.total}</strong><small>{t.in_progress} in progress · {t.completed} completed</small></div>
        {isAdmin
          ? <div className="card card-employees"><span>Active Employees</span><strong>{d.employees}</strong><small>Team members</small></div>
          : <div className="card card-hours"><span>Hours This Week</span><strong>{d.hours.week}</strong><small>{d.hours.today} logged today</small></div>}
        <div className="card card-overdue danger"><span>Overdue Tasks</span><strong>{t.overdue}</strong><small>Needs attention</small></div>
      </section>

      {isAdmin && d.teams?.length > 0 && (
        <section className="team-cards">
          {d.teams.map((tm) => (
            <div className={`card team-card ${tm.work_type.toLowerCase()}`} key={tm.work_type}>
              <h3>{WORK_TYPE[tm.work_type]} team</h3>
              <div className="stats">
                <div><b>{tm.employees}</b><small>employees</small></div>
                <div><b>{tm.open_tasks}</b><small>open tasks</small></div>
                <div><b>{tm.week_hours}</b><small>hours (7 days)</small></div>
              </div>
            </div>
          ))}
          <Link className="card team-card" to="/daily" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h3>Today's team report →</h3><p className="muted small">See who logged work and sent a daily report today.</p>
          </Link>
        </section>
      )}

      <div className="grid2">
        <section className="panel">
          <h3>Task status</h3>
          {t.total === 0 ? <Empty /> : bars.map(([label, n, color]) => (
            <div className="bar-row" key={label}>
              <span>{label}</span>
              <div className="progress"><div style={{ width: `${(n / t.total) * 100}%`, background: color }} /></div>
              <b>{n}</b>
            </div>
          ))}
          <p className="muted small">Hours logged: {d.hours.today} today · {d.hours.week} in the last 7 days</p>
        </section>

        <section className="panel">
          <h3>Project progress</h3>
          {d.projectProgress.length === 0 ? <Empty /> : d.projectProgress.map((p) => (
            <div className="proj-row" key={p.id}>
              <div className="between"><span>{p.project_name}</span><b>{p.progress}%</b></div>
              <Progress value={p.progress} />
            </div>
          ))}
        </section>
      </div>

      <section className="panel">
        <div className="between"><h3>Upcoming & overdue tasks</h3><Link to="/tasks">View all →</Link></div>
        {d.upcoming.length === 0 ? <Empty>No open tasks. 🎉</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Task</th><th>Project</th>{isAdmin && <th>Assignee</th>}<th>Priority</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>{d.upcoming.map((x) => (
              <tr key={x.id}>
                <td>{x.title}</td><td>{x.project_name}</td>{isAdmin && <td>{x.assignee_name || '—'}</td>}
                <td><Badge value={x.priority} map={PRIORITY} /></td>
                <td><Badge value={x.status} map={STATUS} /></td>
                <td className={x.is_overdue ? 'overdue' : ''}>{fmtDate(x.end_date)}{x.is_overdue && ' (overdue)'}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
