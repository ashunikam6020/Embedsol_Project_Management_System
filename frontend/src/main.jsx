import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { AuthProvider, useAuth } from './auth';
import Layout from './Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Employees from './pages/Employees';
import DailyReports from './pages/DailyReports';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Attendance from './pages/Attendance';
import Notifications from './pages/Notifications';
import AuditLogs from './pages/AuditLogs';

function Protected({ adminOnly, children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/employees" element={<Protected adminOnly><Employees /></Protected>} />
        <Route path="/daily" element={<DailyReports />} />
        <Route path="/reports" element={<Protected adminOnly><Reports /></Protected>} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/audit" element={<Protected adminOnly><AuditLogs /></Protected>} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter>
  </React.StrictMode>
);
