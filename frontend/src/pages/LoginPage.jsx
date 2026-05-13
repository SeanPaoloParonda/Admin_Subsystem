import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

// SVG icon for the username field
const UserIcon = () => (
  <svg className="input-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// SVG icon for the password field
const LockIcon = () => (
  <svg className="input-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Clear the error message when the user starts typing again
  const clearError = () => {
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/admin/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      // Parse as text first to handle non-JSON responses (e.g. rate limit pages)
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          res.status === 429
            ? 'Too many login attempts. Please try again shortly.'
            : 'Login server is unavailable. Please make sure the backend is running.'
        );
      }

      if (!res.ok) throw new Error(data.message || 'Login failed');

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg" style={{ backgroundImage: 'url(/hospitalbg.png)' }}>
      <div className="login-card">
        <div className="login-logo">
          <img src="/hospitallogo.png" alt="VitalMed Logo" height={60} />
          <h2>VitalMed</h2>
          <div className="login-subtitle">Hospital System</div>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <UserIcon />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => { clearError(); setUsername(e.target.value); }}
              required
              autoFocus
            />
          </div>
          <div className="input-group">
            <LockIcon />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => { clearError(); setPassword(e.target.value); }}
              required
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="btn-spinner"></span>
                Signing In
              </>
            ) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
