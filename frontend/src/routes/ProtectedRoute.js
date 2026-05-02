import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

// Get API URL from environment or use default
const API_URL = process.env.REACT_APP_API_URL || '/admin/api';

const ProtectedRoute = ({ children }) => {
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    const checkToken = async () => {
      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      console.log('ProtectedRoute: Checking token...', { hasToken: !!token, hasRefreshToken: !!refreshToken });
      setDebugInfo(`Has token: ${!!token}, Has refreshToken: ${!!refreshToken}`);

      if (!token || !refreshToken) {
        console.log('ProtectedRoute: Missing tokens, redirecting to login');
        setValid(false);
        setLoading(false);
        return;
      }

      try {
        console.log('ProtectedRoute: Calling verify endpoint...');
        // Verify token by calling the protected endpoint
        const res = await fetch(`${API_URL}/auth/verify`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('ProtectedRoute: verify response status:', res.status);

        if (res.ok) {
          console.log('ProtectedRoute: Token is valid!');
          setValid(true);
        } else if (res.status === 401) {
          // Token invalid or expired - try refresh
          console.log('ProtectedRoute: Token invalid, trying refresh...');
          try {
            const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ refreshToken })
            });

            console.log('ProtectedRoute: refresh response status:', refreshRes.status);

            if (refreshRes.ok) {
              const data = await refreshRes.json();
              console.log('ProtectedRoute: refresh response data:', data);
              if (data.accessToken) {
                localStorage.setItem('accessToken', data.accessToken);
                console.log('ProtectedRoute: Token refreshed successfully!');
                setValid(true);
              } else {
                throw new Error('No access token in refresh response');
              }
            } else {
              // Refresh failed - clear tokens
              console.log('ProtectedRoute: Refresh failed, clearing tokens');
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('user');
              setValid(false);
            }
          } catch (refreshErr) {
            console.error('Token refresh error:', refreshErr);
            // Clear tokens on refresh error
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            setValid(false);
          }
        } else {
          // Other error status
          console.log('ProtectedRoute: Other error status:', res.status);
          setValid(false);
        }
      } catch (err) {
        console.error('Token check error:', err);
        // Clear tokens on network error
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setValid(false);
      } finally {
        setLoading(false);
      }
    };

    checkToken();
  }, [API_URL]);

  if (loading) {
    return <div>Checking session... {debugInfo}</div>;
  }

  if (!valid) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p>Session invalid or expired</p>
        <p style={{ fontSize: 12, color: '#666' }}>{debugInfo}</p>
        <Navigate to="/login" replace />
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
