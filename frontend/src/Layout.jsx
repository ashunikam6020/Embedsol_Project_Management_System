import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const nav = useNavigate();
  const links = [
    ['/', 'Dashboard', true],
    ['/projects', 'Projects', true],
    ['/tasks', 'Tasks', true],
    ['/employees', 'Employees', isAdmin],
    ['/daily', isAdmin ? 'Daily Reports / HR Review' : 'My Daily Work', true],
    ['/attendance', 'Attendance', true],
    ['/notifications', 'Notifications', true],
    ['/reports', 'Reports', isAdmin],
    ['/audit', 'Audit Log', isAdmin],
    ['/settings', 'Settings', true]
  ].filter((l) => l[2]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">E</div>
          <div><h2>Embedsol Technologies</h2><span>Project & Task Management</span></div>
        </div>
        <nav>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
          ))}
        </nav>
        <button className="logout" onClick={() => { logout(); nav('/login'); }}>Sign out</button>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="user">{user.fullName} · {isAdmin ? 'Administrator' : 'Employee'}</div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
