import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { humanise } from '../lib/format';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/requests', label: 'Billing Requests', end: false },
  { to: '/invoices', label: 'Invoices', end: false },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">FD</span>
          <span className="brand__name">FlowDesk</span>
        </div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'nav__link nav__link--active' : 'nav__link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-chip">
          <div className="user-chip__meta">
            <span className="user-chip__name">{user?.name}</span>
            <span className="badge badge--role">
              {user ? humanise(user.role) : ''}
            </span>
          </div>
          <button className="btn btn--ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
