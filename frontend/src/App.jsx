import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import RolesManagement from './pages/RolesManagement';
import ServiceCatalog from './pages/ServiceCatalog';
import AuditLogs from './pages/AuditLogs';
import ProtectedRoute from './routes/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/users"     element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
        <Route path="/roles"     element={<ProtectedRoute><RolesManagement /></ProtectedRoute>} />
        <Route path="/services"  element={<ProtectedRoute><ServiceCatalog /></ProtectedRoute>} />
        <Route path="/audit"     element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
