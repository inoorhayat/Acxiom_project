import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const MENU = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/customers', label: 'Customers' },
  { to: '/leads', label: 'Leads' },
  { to: '/opportunities', label: 'Opportunities' },
  { to: '/followups', label: 'Follow-Ups' },
  { to: '/reports', label: 'Reports' },
  { to: '/users', label: 'Users', roles: ['Admin'] },
  { to: '/audit', label: 'Audit Log', roles: ['Admin'] },
];

// Menu items are filtered by role for usability; the server enforces the real permissions
export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = (user?.name || 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Acxiom<span>CRM</span></div>
        <nav className="nav">
          {MENU.filter((m) => !m.roles || hasRole(...m.roles)).map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end}>{m.label}</NavLink>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="user">
            <div className="avatar">{initials}</div>
            <div className="user-meta">
              <strong>{user?.name}</strong>
              <small>{user?.role === 'SalesExecutive' ? 'Sales Executive' : user?.role}</small>
            </div>
          </div>
          <button className="btn secondary small" onClick={handleLogout}>Log out</button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
