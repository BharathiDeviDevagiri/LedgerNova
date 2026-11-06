import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0e17', color: '#10b981' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p>Verifying secure session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div style={{ padding: '3rem 1.5rem', maxWidth: '600px', margin: '4rem auto', textAlign: 'center', background: '#111827', borderRadius: '16px', border: '1px solid #374151' }}>
        <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f9fafb' }}>Access Restricted</h2>
        <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
          Your account role (<strong style={{ color: '#60a5fa' }}>{user.role}</strong>) does not have authorization to view this area.
        </p>
        <a href="/dashboard" className="btn-primary" style={{ display: 'inline-block', padding: '0.6rem 1.25rem', borderRadius: '8px', textDecoration: 'none' }}>
          Return to Dashboard
        </a>
      </div>
    );
  }

  return children;
}
