import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
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
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const formatDashboardDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeTime = (createdAt) => {
    if (!createdAt) return 'Just now';
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const diffMins = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  const getInitials = (name = 'System') => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'S';
    return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
  };

  const getActivityName = (activity) => {
    const fullName = [activity.first_name, activity.last_name].filter(Boolean).join(' ').trim();
    return fullName || activity.username || 'System';
  };

  const getActivityDetails = (activity) => {
    if (activity.details) return activity.details;
    return `${getActionLabel(activity.action_type)} recorded`;
  };

  const getActionLabel = (action = '') => {
    return action.replace(/_/g, ' ').toUpperCase();
  };

  const getBadgeClass = (action = '') => {
    const normalized = action.toUpperCase();
    if (normalized.includes('FAILED') || normalized.includes('FAIL')) return 'badge-failed';
    if (normalized.includes('LOGIN')) return 'badge-login';
    if (normalized.includes('CREATE')) return 'badge-create';
    if (normalized.includes('UPDATE') || normalized.includes('PATCH')) return 'badge-update';
    if (normalized.includes('DELETE') || normalized.includes('DEACTIVATE')) return 'badge-delete';
    return 'badge-default';
  };

  useEffect(() => {
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
      <Sidebar />

      {/* Main Content */}
      <main className="main-content">
        <header className="dashboard-header">
          <h1>Welcome back, {userInfo.role || 'Admin'}!</h1>
          <p className="header-date">{formatDashboardDate()}</p>
        </header>

        {loading && <div className="loading">Loading dashboard data...</div>}
        {error && <div className="error">Error: {error}</div>}

        {!loading && !error && (
          <>
            {/* Stats */}
            <section className="stats-row">
              <div className="stat-card">
                <div className="stat-card-head">
                  <span className="stat-label">Total Users</span>
                  <span className="stat-icon icon-users">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </span>
                </div>
                <div className="stat-value">{stats.totalUsers ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-head">
                  <span className="stat-label">Active Sessions</span>
                  <span className="stat-dot"></span>
                </div>
                <div className="stat-value">{stats.activeUsers ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-head">
                  <span className="stat-label">Roles Defined</span>
                  <span className="stat-icon icon-roles">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </span>
                </div>
                <div className="stat-value">{stats.rolesDefined ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-head">
                  <span className="stat-label">Audit Events</span>
                  <span className="stat-icon icon-audit">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
                  </span>
                </div>
                <div className="stat-value">{stats.auditEvents ?? 0}</div>
              </div>
            </section>

            {/* Activities + Alerts */}
            <section className="bottom-row">
              <div className="activity-section">
                <h3>Recent Activity</h3>
                <p className="panel-subtitle">Last actions performed in the system</p>
                {activities.length === 0 ? (
                  <p className="empty">No recent activity found.</p>
                ) : (
                  <div className="activity-list">
                    {activities.map((act) => (
                      <div key={act.log_id} className="activity-item">
                        <div className="activity-avatar">{getInitials(getActivityName(act))}</div>
                        <div className="activity-copy">
                          <div className="activity-title-row">
                            <span className="activity-user">{getActivityName(act)}</span>
                            <span className={`activity-badge ${getBadgeClass(act.action_type)}`}>{getActionLabel(act.action_type)}</span>
                          </div>
                          <div className="activity-description">{getActivityDetails(act)}</div>
                          <div className="activity-time">{formatRelativeTime(act.created_at)}</div>
                        </div>
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
                        <div className="alert-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                        </div>
                        <div className="alert-copy">
                          <span className="alert-message">{alert.message || alert.type || 'Alert detected'}</span>
                          <div className="alert-meta">
                            <span>{getAlertSource(alert)}</span>
                            <span>{formatAlertTimestamp(alert.created_at)}</span>
                          </div>
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
