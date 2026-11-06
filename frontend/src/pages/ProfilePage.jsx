import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, ShieldCheck, Mail, Key, Clock, CheckCircle2, LogOut } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="page-container" style={{ maxWidth: '680px', margin: '0 auto' }}>
      <div className="page-header-row" style={{ marginBottom: '1.75rem' }}>
        <div>
          <h1 className="page-title">Profile &amp; Credentials</h1>
          <p className="page-description">Security posture and role authorizations</p>
        </div>

        <button onClick={logout} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
          <LogOut size={16} />
          Sign Out
        </button>
      </div>

      <div className="card-panel" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid #1f2937' }}>
          <div className="user-avatar-circle" style={{ width: '56px', height: '56px', fontSize: '1.5rem' }}>
            {user.fullName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f3f4f6' }}>{user.fullName}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span className={`role-badge role-${user.role.toLowerCase()}`}>{user.role}</span>
              <span style={{ color: '#10b981', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 size={12} /> Active
              </span>
            </div>
          </div>
        </div>

        <div className="info-list" style={{ marginTop: '1.25rem' }}>
          <div className="info-row">
            <span className="info-label">User Identifier:</span>
            <code className="info-code">{user.id}</code>
          </div>

          <div className="info-row">
            <span className="info-label">Email Address:</span>
            <span className="info-value">{user.email}</span>
          </div>

          <div className="info-row">
            <span className="info-label">Assigned Role:</span>
            <span className="info-value" style={{ fontWeight: 600 }}>{user.role}</span>
          </div>

          <div className="info-row">
            <span className="info-label">Session Authentication:</span>
            <span className="info-value" style={{ color: '#60a5fa' }}>Signed JWT (HS256)</span>
          </div>
        </div>
      </div>

      <div className="card-panel">
        <h3 className="panel-title" style={{ marginBottom: '0.75rem' }}>Role Capability Summary</h3>
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '1rem' }}>
          Under LedgerLine's core security invariants, access is strictly governed at both the role and account levels.
        </p>

        <div className="capability-box">
          {user.role === 'ADMIN' && (
            <div>
              <strong style={{ color: '#f59e0b' }}>Administrator Privileges:</strong>
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.4rem', fontSize: '0.85rem', color: '#d1d5db' }}>
                <li>Global management of all customer accounts and liabilities.</li>
                <li>System executive metrics and central reserve bank cash oversight.</li>
                <li>User lifecycle management (activation and deactivation).</li>
                <li>Full audit trail visibility.</li>
              </ul>
            </div>
          )}

          {user.role === 'AUDITOR' && (
            <div>
              <strong style={{ color: '#3b82f6' }}>Compliance Auditor Privileges:</strong>
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.4rem', fontSize: '0.85rem', color: '#d1d5db' }}>
                <li>Read-only access to accounts and statements explicitly assigned by an administrator.</li>
                <li>Immutable audit log examination including refused attempts.</li>
                <li>System-wide read-only audit-log access.</li>
                <li>Strictly forbidden from initiating transfers, deposits, or withdrawals.</li>
                <li>Verification of double-entry equality (&Sigma; Debits = &Sigma; Credits).</li>
              </ul>
            </div>
          )}

          {user.role === 'ACCOUNT_HOLDER' && (
            <div>
              <strong style={{ color: '#10b981' }}>Account Holder Privileges:</strong>
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.4rem', fontSize: '0.85rem', color: '#d1d5db' }}>
                <li>Deposit, withdraw, and transfer funds across owned/authorized accounts.</li>
                <li>Scoped strictly to accounts where an AccountPermission record exists.</li>
                <li>Immutable statement view with date filters and running balance audit.</li>
                <li>No access to other customers' accounts or administrator utilities.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
