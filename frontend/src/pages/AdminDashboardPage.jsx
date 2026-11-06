import React, { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import StatCard from '../components/StatCard';
import {
  ShieldCheck,
  Users,
  Wallet,
  Scale,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricRes, userRes] = await Promise.all([
        adminService.getMetrics(),
        adminService.getUsers(),
      ]);

      if (metricRes.data.success) {
        setMetrics(metricRes.data.metrics);
      }
      if (userRes.data.success) {
        setUsers(userRes.data.users || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load administrator metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleUserStatus = async (user) => {
    try {
      const newStatus = !user.isActive;
      const res = await adminService.updateUserStatus(user.id, newStatus);
      if (res.data.success) {
        setActionSuccess(`User ${user.email} is now ${newStatus ? 'ACTIVE' : 'DEACTIVATED'}.`);
        setUsers(users.map((u) => (u.id === user.id ? { ...u, isActive: newStatus } : u)));
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update user status.');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Executive Administration</h1>
          <p className="page-description">Core system solvency, user provisioning, and reserve bank cash health</p>
        </div>

        <button onClick={fetchAdminData} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh Metrics
        </button>
      </div>

      {actionSuccess && (
        <div className="alert-success" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="alert-error" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="stats-grid">
        <StatCard
          title="Total Registered Users"
          value={metrics?.totalUsers?.toString() || '0'}
          subtext="Admins, Auditors &amp; Holders"
          icon={Users}
          color="blue"
        />

        <StatCard
          title="Total Customer Accounts"
          value={metrics?.totalCustomerAccounts?.toString() || '0'}
          subtext="Liability Wallets &amp; Checking"
          icon={Wallet}
          color="purple"
        />

        <StatCard
          title="System Cash Reserve"
          value={`₹${metrics?.systemCashAccount?.balanceRupees || '0.00'}`}
          subtext={metrics?.systemCashAccount?.accountNumber}
          icon={Scale}
          color="emerald"
        />

        <StatCard
          title="Customer Liabilities"
          value={`₹${metrics?.totalCustomerLiabilities?.balanceRupees || '0.00'}`}
          subtext="Total Deposited Customer Wealth"
          icon={Activity}
          color="amber"
        />
      </div>

      {/* Solvency / Reconciliation Banner */}
      <div className="reconciliation-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="recon-icon">
            {metrics?.reconciliationBalanced ? (
              <CheckCircle2 size={24} color="#10b981" />
            ) : (
              <AlertTriangle size={24} color="#f59e0b" />
            )}
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f3f4f6' }}>
              System Solvency &amp; Reconciliation Status:{' '}
              <span style={{ color: metrics?.reconciliationBalanced ? '#10b981' : '#f59e0b' }}>
                {metrics?.reconciliationBalanced ? 'PERFECTLY BALANCED' : 'RECONCILIATION IN PROGRESS'}
              </span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Central Bank Cash (Asset) = ₹{metrics?.systemCashAccount?.balanceRupees} &bull; Total Customer Deposits (Liability) = ₹{metrics?.totalCustomerLiabilities?.balanceRupees}
            </p>
          </div>
        </div>
      </div>

      {/* Users Management Table */}
      <div className="card-panel" style={{ marginTop: '1.75rem' }}>
        <div className="card-panel-header">
          <div>
            <h3 className="panel-title">User Directory &amp; Status Controls</h3>
            <p className="panel-subtitle">Manage user activation, assigned roles, and account permissions</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading user registry...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state-box">
            <Users size={36} color="#6b7280" />
            <p>No users found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Accounts</th>
                  <th>Transactions</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600, color: '#f3f4f6' }}>{u.fullName}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`role-badge role-${u.role.toLowerCase()}`}>{u.role}</span>
                    </td>
                    <td>{u.accountsCount}</td>
                    <td>{u.transactionsCount}</td>
                    <td>
                      <span className={`status-pill ${u.isActive ? 'pill-posted' : 'pill-failed'}`}>
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleToggleUserStatus(u)}
                        className="btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        {u.isActive ? (
                          <>
                            <ToggleRight size={16} color="#10b981" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={16} color="#ef4444" />
                            Activate
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
