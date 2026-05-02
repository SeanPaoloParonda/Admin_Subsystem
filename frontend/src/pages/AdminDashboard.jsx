import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';
import { NavLink } from 'react-router-dom';

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
          <img src="/hospitallogo.png" alt="VitalMed Logo" className="logo-icon" />
          <div className="logo-text-wrapper">
            <span className="logo-text">VitalMed</span>
            <span className="logo-subtext">Hospital System</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className="nav-item">
            Dashboard
          </NavLink>
          <NavLink to="/users" className="nav-item">
            User Management
          </NavLink>
          <NavLink to="/roles" className="nav-item">
            Roles & Permissions
          </NavLink>
          <NavLink to="/services" className="nav-item">
            Service Catalog
          </NavLink>
          <NavLink to="/audit" className="nav-item">
            Audit Logs
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="profile-info">
            <div className="profile-details">
              <div className="profile-role">{userInfo.role || 'Role'}</div>
              <div className="profile-name">{userInfo.username || 'Username'}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
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
                        <span className="activity-time">
                          {new Date(act.created_at).toLocaleString()}
                        </span>
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
