import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { accountService, transactionService } from '../services/api';
import StatCard from '../components/StatCard';
import ActivityChart from '../components/ActivityChart';
import { formatPaiseForDisplay } from '../utils/money';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  PlusCircle,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accRes, txRes] = await Promise.all([
        accountService.getAccounts(),
        transactionService.getTransactions({ limit: 8 }),
      ]);

      if (accRes.data.success) {
        setAccounts(accRes.data.accounts || []);
      }

      if (txRes.data.success) {
        setTransactions(txRes.data.transactions || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Compute total balance in paise and rupees
  const totalBalancePaise = accounts.reduce(
    (acc, cur) => acc + BigInt(cur.balancePaise || 0),
    0n
  );

  const totalBalanceRupees = formatPaiseForDisplay(totalBalancePaise);

  return (
    <div className="page-container">
      {/* Top Banner Greeting */}
      <div className="dashboard-welcome-banner">
        <div>
          <h1 className="welcome-title">Hello, {user?.fullName || 'Account Holder'} 👋</h1>
          <p className="welcome-subtext">
            Double-Entry Core Ledger System • Real-Time Proved Balances
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={fetchDashboardData} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <Link to="/transfer" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeftRight size={16} />
            Quick Transfer
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="stats-grid">
        <StatCard
          title="Total Liquidity"
          value={`₹${totalBalanceRupees}`}
          subtext={`${totalBalancePaise.toString()} integer paise`}
          icon={Wallet}
          color="emerald"
        />

        <StatCard
          title="Active Accounts"
          value={accounts.length.toString()}
          subtext="Audited Liabilities"
          icon={TrendingUp}
          color="blue"
        />

        <StatCard
          title="Recent Transactions"
          value={transactions.length.toString()}
          subtext="Double-Entry Balanced"
          icon={Clock}
          color="purple"
        />
      </div>

      {/* Quick Action Bar */}
      <div className="quick-actions-card">
        <div className="quick-actions-title">Core Operations</div>
        <div className="action-buttons-grid">
          <Link to="/deposit" className="action-tile action-deposit">
            <ArrowDownLeft size={22} className="tile-icon" />
            <div className="tile-title">Deposit Money</div>
            <div className="tile-desc">Cash injection into liability account</div>
          </Link>

          <Link to="/withdraw" className="action-tile action-withdraw">
            <ArrowUpRight size={22} className="tile-icon" />
            <div className="tile-title">Withdraw Funds</div>
            <div className="tile-desc">Debit account balance to cash</div>
          </Link>

          <Link to="/transfer" className="action-tile action-transfer">
            <ArrowLeftRight size={22} className="tile-icon" />
            <div className="tile-title">Internal Transfer</div>
            <div className="tile-desc">Conserve system money between accounts</div>
          </Link>

          <Link to="/accounts" className="action-tile action-accounts">
            <PlusCircle size={22} className="tile-icon" />
            <div className="tile-title">Manage Accounts</div>
            <div className="tile-desc">Open new account or view details</div>
          </Link>
        </div>
      </div>

      {/* Activity Chart & Account Overview */}
      <div className="dashboard-columns">
        <div className="column-left">
          <ActivityChart transactions={transactions} />
        </div>

        <div className="column-right">
          <div className="card-panel">
            <div className="card-panel-header">
              <h3 className="panel-title">My Accounts</h3>
              <Link to="/accounts" className="panel-link">View All ({accounts.length})</Link>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading accounts...</p>
              </div>
            ) : accounts.length === 0 ? (
              <div className="empty-state-box">
                <Wallet size={32} color="#6b7280" />
                <p>No active accounts found.</p>
                <Link to="/accounts" className="btn-secondary btn-sm" style={{ marginTop: '0.5rem' }}>
                  Open Account
                </Link>
              </div>
            ) : (
              <div className="account-list-stack">
                {accounts.slice(0, 4).map((acc) => (
                  <div key={acc.id} className="account-item-card">
                    <div>
                      <div className="acc-name">{acc.name}</div>
                      <div className="acc-number">{acc.accountNumber}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="acc-balance">₹{acc.balanceRupees || '0.00'}</div>
                      <Link to={`/accounts/${acc.id}/statement`} className="acc-statement-link">
                        <FileText size={12} />
                        Statement
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="card-panel" style={{ marginTop: '1.75rem' }}>
        <div className="card-panel-header">
          <div>
            <h3 className="panel-title">Recent Ledger Postings</h3>
            <p className="panel-subtitle">Append-only audit trail of financial activity</p>
          </div>
          <Link to="/transactions" className="panel-link">Full History &rarr;</Link>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Fetching ledger records...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state-box">
            <Clock size={32} color="#6b7280" />
            <p>No transactions have been recorded yet.</p>
            <Link to="/deposit" className="btn-primary btn-sm" style={{ marginTop: '0.75rem' }}>
              Make a First Deposit
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                      {new Date(tx.createdAt).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <code className="reference-code">{tx.referenceNumber}</code>
                    </td>
                    <td style={{ fontWeight: 500, color: '#f3f4f6' }}>{tx.description}</td>
                    <td>
                      <span className={`status-pill pill-${tx.status.toLowerCase()}`}>
                        {tx.status === 'POSTED' && <CheckCircle2 size={12} />}
                        {tx.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                      ₹{tx.totalAmountRupees}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Link to={`/transactions/${tx.id}`} className="view-detail-btn">
                        Inspect
                      </Link>
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
