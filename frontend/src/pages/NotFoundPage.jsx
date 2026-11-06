import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '480px', background: '#111827', padding: '3rem 2rem', borderRadius: '16px', border: '1px solid #374151' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <Scale size={32} />
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f3f4f6', marginBottom: '0.5rem' }}>404</h1>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#e5e7eb', marginBottom: '0.75rem' }}>
          Page Not Found
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '2rem' }}>
          The ledger record or navigation path you are attempting to access does not exist or has been relocated.
        </p>
        <Link to="/dashboard" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={16} />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
