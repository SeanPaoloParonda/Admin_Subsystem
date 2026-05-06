import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [activities, setActivities] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [userInfo, setUserInfo] = useState({ username: '', role: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getAlertSource = (alert) => {
    return alert.user?.username || alert.username || alert.ip_addr || alert.ip || 'Unknown source';
  };

  const formatAlertTimestamp = (createdAt) => {
    if (!createdAt) return '';
    const date = new Date(createdAt);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  useEffect(() => {
    // Load user info directly from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUserInfo(JSON.parse(storedUser));
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('accessToken');
        if (!token) {
          setError('No token found, please log in again.');
          navigate('/login');
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        const [statsRes, actRes, alertRes] = await Promise.all([
          fetch('/admin/api/stats', { headers }),
          fetch('/admin/api/activities', { headers }),
          fetch('/admin/api/alerts', { headers })
        ]);

        if (!statsRes.ok || !actRes.ok || !alertRes.ok) {
          throw new Error('Failed to fetch one or more endpoints');
        }

        setStats(await statsRes.json());
        setActivities(await actRes.json());
        setAlerts(await alertRes.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <img src="/hospitallogo.png" alt="VitalMed Logo" width="55" height="44" />
          </div>
          <div className="logo-text-wrapper">
            <span className="logo-text">VitalMed</span>
            <span className="logo-subtext">Hospital System</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {[
            { label: 'Dashboard', active: true, path: '/dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
            { label: 'User Management', active: false, path: '/users', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
            { label: 'Roles & Permissions', active: false, path: '/roles', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
            { label: 'Service Catalog', active: false, path: '/services', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
            { label: 'Audit Logs', active: false, path: '/audit', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
          ].map((item) => (
            <div
              key={item.label}
              className={`nav-item ${item.active ? 'active' : ''}`}
              onClick={() => item.path !== '#' && navigate(item.path)}
              style={{ cursor: item.path !== '#' ? 'pointer' : 'default' }}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-info">
            <div className="profile-details">
              <div className="profile-name">{userInfo.username || 'admin'}</div>
              <div className="profile-role">{userInfo.role || 'View Staff'}</div>
            </div>
          </div>
          <button className="logout-btn" title="Logout" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="dashboard-header">
          <h1>Welcome back, {userInfo.role || 'Admin'}!</h1>
          <p className="header-date">{new Date().toLocaleDateString()}</p>
        </header>

        {loading && <div className="loading">Loading dashboard data...</div>}
        {error && <div className="error">Error: {error}</div>}

        {!loading && !error && (
          <>
            {/* Stats */}
            <section className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Total Users</div>
                <div className="stat-value">{stats.totalUsers}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active Users</div>
                <div className="stat-value">{stats.activeUsers}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Roles Defined</div>
                <div className="stat-value">{stats.rolesDefined}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Audit Events</div>
                <div className="stat-value">{stats.auditEvents}</div>
              </div>
            </section>

            {/* Activities + Alerts */}
            <section className="bottom-row">
              <div className="activity-section">
                <h3>Recent Activity</h3>
                {activities.length === 0 ? (
                  <p className="empty">No recent activity found.</p>
                ) : (
                  <div className="activity-list">
                    {activities.map((act) => (
                      <div key={act.log_id} className="activity-item">
                        <span className="activity-user">{act.username || 'System'}</span>
                        <span className="activity-spacer"> - </span>
                        <span className="activity-action">{act.action_type}</span>
                        <span className="activity-spacer"> - </span>
                        <span className="activity-time">{new Date(act.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="alerts-section">
                <h3>Security Alerts</h3>
                {alerts.length === 0 ? (
                  <p className="empty">No alerts at this time.</p>
                ) : (
                  <div className="alerts-list">
                    {alerts.map((alert) => (
                      <div key={alert.alert_id} className="alert-item">
                        <span className="alert-message"> {alert.message || alert.type || 'Alert detected'}</span>
                        <div className="alert-meta">
                          <span>{getAlertSource(alert)}</span>
                          <span className="alert-divider">|</span>
                          <span>{formatAlertTimestamp(alert.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
