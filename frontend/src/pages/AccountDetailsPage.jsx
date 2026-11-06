import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { accountService } from '../services/api';
import {
  Wallet,
  ArrowLeft,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function AccountDetailsPage() {
  const { accountId } = useParams();
  const { user } = useAuth();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAccountDetails() {
      setLoading(true);
      setError(null);
      try {
        const res = await accountService.getAccount(accountId);
        if (res.data.success) {
          setAccount(res.data.account);
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to load account details.');
      } finally {
        setLoading(false);
      }
    }
    fetchAccountDetails();
  }, [accountId]);

  if (loading) {
    return (
      <div className="page-container loading-state">
        <div className="spinner"></div>
        <p>Loading account details...</p>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="page-container">
        <div className="alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} />
          <span>{error || 'Account could not be found.'}</span>
        </div>
        <Link to="/accounts" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={16} />
          Back to Accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/accounts" className="back-nav-link">
          <ArrowLeft size={16} />
          <span>Back to All Accounts</span>
        </Link>
      </div>

      <div className="account-details-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div className="account-avatar-box">
            <Wallet size={32} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 className="account-title">{account.name}</h1>
              <span className={`status-pill pill-${account.status.toLowerCase()}`}>
                {account.status}
              </span>
            </div>
            <code className="account-number-large">{account.accountNumber}</code>
          </div>
        </div>

        <div className="account-balance-card">
          <div className="balance-card-label">Verified Ledger Balance</div>
          <div className="balance-card-value">₹{account.balanceRupees}</div>
          <div className="balance-card-subtext">{account.balancePaise} integer paise</div>
        </div>
      </div>

      {/* Action shortcuts */}
      <div className="details-actions-bar">
        <Link to={`/accounts/${account.id}/statement`} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={16} />
          View Full Statement
        </Link>

        {user?.role !== 'AUDITOR' && (
          <>
            <Link to={`/deposit?accountId=${account.id}`} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowDownLeft size={16} color="#10b981" />
              Deposit
            </Link>

            <Link to={`/withdraw?accountId=${account.id}`} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowUpRight size={16} color="#ef4444" />
              Withdraw
            </Link>

            <Link to={`/transfer?fromAccountId=${account.id}`} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowLeftRight size={16} color="#3b82f6" />
              Transfer
            </Link>
          </>
        )}
      </div>

      {/* Information Grid */}
      <div className="details-grid">
        <div className="card-panel">
          <h3 className="panel-title" style={{ marginBottom: '1.25rem' }}>Account Metadata</h3>
          <div className="info-list">
            <div className="info-row">
              <span className="info-label">Internal UUID:</span>
              <code className="info-code">{account.id}</code>
            </div>
            <div className="info-row">
              <span className="info-label">Accounting Type:</span>
              <span className="info-value">{account.type} (Normal Credit)</span>
            </div>
            <div className="info-row">
              <span className="info-label">Currency:</span>
              <span className="info-value">{account.currency} (Indian Rupee)</span>
            </div>
            <div className="info-row">
              <span className="info-label">Created At:</span>
              <span className="info-value">{new Date(account.createdAt).toLocaleString('en-IN')}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Your Permission:</span>
              <span className="info-value permission-badge">{account.permission || 'OWNER'}</span>
            </div>
          </div>
        </div>

        {/* Assigned Users / Permissions (If present or Admin) */}
        {account.permissions && account.permissions.length > 0 && (
          <div className="card-panel">
            <h3 className="panel-title" style={{ marginBottom: '1.25rem' }}>Authorized Signatories &amp; Viewers</h3>
            <div className="permissions-list">
              {account.permissions.map((p) => (
                <div key={p.id || p.userId} className="permission-item">
                  <div>
                    <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{p.user?.fullName || 'Authorized User'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{p.user?.email}</div>
                  </div>
                  <span className="permission-badge">{p.permission}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
