import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { accountService } from '../services/api';
import {
  Wallet,
  Plus,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Shield,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
} from 'lucide-react';

export default function AccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await accountService.getAccounts();
      if (res.data.success) {
        setAccounts(res.data.accounts || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!newAccountName.trim()) {
      setCreateError('Please enter an account name.');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const res = await accountService.createAccount(newAccountName.trim());
      if (res.data.success) {
        setIsModalOpen(false);
        setNewAccountName('');
        setSuccessMessage(`Account "${res.data.account.name}" created with Account Number ${res.data.account.accountNumber}`);
        fetchAccounts();
      }
    } catch (err) {
      setCreateError(err.response?.data?.error || err.message || 'Failed to create account.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Accounts Directory</h1>
          <p className="page-description">
            {user?.role === 'ADMIN' || user?.role === 'AUDITOR'
              ? 'Global registry of audited liability and asset accounts'
              : 'Your personal double-entry ledger accounts'}
          </p>
        </div>

        {user?.role !== 'AUDITOR' && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} />
            Open New Account
          </button>
        )}
      </div>

      {successMessage && (
        <div className="alert-success" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="alert-error" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Retrieving authorized accounts...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="empty-state-card">
          <Wallet size={48} color="#4b5563" />
          <h3 style={{ fontSize: '1.2rem', marginTop: '1rem', color: '#f3f4f6' }}>No Accounts Found</h3>
          <p style={{ color: '#9ca3af', maxWidth: '400px', margin: '0.5rem auto 1.5rem' }}>
            You do not currently have any accounts assigned. Create an account to begin depositing and moving funds.
          </p>
          {user?.role !== 'AUDITOR' && (
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">
              Create Your First Account
            </button>
          )}
        </div>
      ) : (
        <div className="accounts-grid">
          {accounts.map((acc) => (
            <div key={acc.id} className="account-card">
              <div className="account-card-top">
                <div>
                  <h3 className="acc-card-name">{acc.name}</h3>
                  <code className="acc-card-num">{acc.accountNumber}</code>
                </div>
                <span className={`status-pill pill-${acc.status.toLowerCase()}`}>
                  {acc.status}
                </span>
              </div>

              <div className="acc-balance-display">
                <div className="acc-balance-label">Current Balance</div>
                <div className="acc-balance-amount">₹{acc.balanceRupees || '0.00'}</div>
                <div className="acc-balance-paise">({acc.balancePaise || '0'} paise)</div>
              </div>

              <div className="acc-card-meta">
                <div className="meta-item">
                  <span className="meta-label">Type:</span>
                  <span className="meta-value">{acc.type}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Currency:</span>
                  <span className="meta-value">{acc.currency}</span>
                </div>
                {acc.permission && (
                  <div className="meta-item">
                    <span className="meta-label">Permission:</span>
                    <span className="meta-value permission-badge">{acc.permission}</span>
                  </div>
                )}
              </div>

              <div className="acc-card-actions">
                <Link to={`/accounts/${acc.id}`} className="acc-action-btn">
                  Details
                </Link>
                <Link to={`/accounts/${acc.id}/statement`} className="acc-action-btn">
                  <FileText size={14} />
                  Statement
                </Link>
                {user?.role !== 'AUDITOR' && (
                  <>
                    <Link to={`/deposit?accountId=${acc.id}`} className="acc-action-btn action-deposit-text">
                      <ArrowDownLeft size={14} />
                      Deposit
                    </Link>
                    <Link to={`/withdraw?accountId=${acc.id}`} className="acc-action-btn action-withdraw-text">
                      <ArrowUpRight size={14} />
                      Withdraw
                    </Link>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Account Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f3f4f6' }}>Create New Account</h3>
              <button onClick={() => setIsModalOpen(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAccount}>
              <div className="modal-body">
                {createError && (
                  <div className="alert-error" style={{ marginBottom: '1rem' }}>
                    <AlertCircle size={16} />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Account Name / Purpose</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Personal Savings, Project Reserve"
                    className="form-input"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                  />
                  <small style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.4rem', display: 'block' }}>
                    Creates an active liability account in INR with OWNER permission.
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={creating}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? 'Creating Account...' : 'Confirm & Open'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
