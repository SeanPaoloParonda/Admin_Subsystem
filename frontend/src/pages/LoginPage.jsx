import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

const LoginPage = () => {
  const [username, setUsername] = useState('');   // ✅ use username
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
      const data = await res.json();
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
            <img src="/profile.png" alt="User" className="input-icon" />
            <input
              type="text"
              placeholder="Username"                 // ✅ label matches DB
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="input-group">
            <img src="/lock.png" alt="Lock" className="input-icon" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="login-forgot">
            <a href="#" className="link-button"
              onClick={(e) => e.preventDefault()}>Forgot Password?</a>
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
