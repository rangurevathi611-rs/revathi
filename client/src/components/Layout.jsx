import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { initials, roleLabel } from '../format.js';

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="8" width="22" height="17" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 14.5h22" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="20" r="1.7" fill="currentColor" />
    </svg>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const manager = user.role === 'owner' || user.role === 'admin';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Mark />
          <div>
            <strong>TrustVault</strong>
            <span>{user.organization.name}</span>
          </div>
        </div>
        <nav className="nav" aria-label="Vault">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Documents
          </NavLink>
          {manager && (
            <NavLink to="/members" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Members
            </NavLink>
          )}
          {manager && (
            <NavLink to="/audit" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Audit trail
            </NavLink>
          )}
        </nav>
        <div className="sidebar-user">
          <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
          <div>
            <strong>{user.name}</strong>
            <span>{roleLabel(user.role)}</span>
          </div>
          <button type="button" className="text-button" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
