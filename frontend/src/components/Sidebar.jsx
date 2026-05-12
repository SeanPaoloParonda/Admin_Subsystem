import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Sidebar.css';

const navItems = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  },
  {
    label: 'User Management',
    path: '/users',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  },
  {
    label: 'Roles & Permissions',
    path: '/roles',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  },
  {
    label: 'Service Catalog',
    path: '/services',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  },
  {
    label: 'Audit Logs',
    path: '/audit',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
];

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useMemo(getStoredUser, []);
  const displayName = user.role || user.username || 'Admin';
  const accountDetail = user.username || 'Admin account';
  const accountTitle = user.username ? `Signed in as ${user.username}` : displayName;
  const accountInitial = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || 'A';

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-logo">
        <div className="app-logo-icon">
          <img src="/hospitallogo.png" alt="VitalMed Logo" width="55" height="44" />
        </div>
        <div className="app-logo-text-wrapper">
          <span className="app-logo-text">VitalMed</span>
          <span className="app-logo-subtext">Hospital System</span>
        </div>
      </div>

      <nav className="app-sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.path}
            type="button"
            className={`app-nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="app-sidebar-footer">
        <div className="app-profile-summary" title={accountTitle}>
          <div className="app-profile-avatar">{accountInitial}</div>
          <div className="app-profile-copy">
            <div className="app-profile-name">{displayName}</div>
            <div className="app-profile-detail">{accountDetail}</div>
          </div>
          <button className="app-logout-btn" title="Logout" onClick={handleLogout}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
