import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { transactionService } from '../services/api';
import {
  History,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Eye,
  ArrowRight,
} from 'lucide-react';

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Selected Transaction for Detail Modal / Drawer
  const [selectedTx, setSelectedTx] = useState(null);

  const fetchTransactions = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: targetPage,
        limit,
        ...(status && { status }),
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate }),
      };

      const res = await transactionService.getTransactions(params);
      if (res.data.success) {
        setTransactions(res.data.transactions || []);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load transaction history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(1);
    setPage(1);
  }, [status]);

  const handleApplyFilter = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions(1);
  };

  const handleClearFilters = () => {
    setStatus('');
    setFromDate('');
    setToDate('');
    setPage(1);
    transactionService.getTransactions({ page: 1, limit }).then((res) => {
      if (res.data.success) {
        setTransactions(res.data.transactions || []);
        setPagination(res.data.pagination);
      }
    });
  };

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Transaction Ledger</h1>
          <p className="page-description">
            {user?.role === 'ADMIN' || user?.role === 'AUDITOR'
              ? 'Complete system transaction journal with verified double-entry debits and credits'
              : 'All financial postings involving your authorized accounts'}
          </p>
        </div>

        <button onClick={() => fetchTransactions(page)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh Journal
        </button>
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <form onSubmit={handleApplyFilter} className="filter-card">
        <div className="filter-inputs-row">
          <div className="filter-field">
            <label className="filter-label">Filter by Status</label>
            <select
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="POSTED">POSTED (Balanced)</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          <div className="filter-field">
            <label className="filter-label">From Date</label>
            <input
              type="date"
              className="form-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-field">
            <label className="filter-label">To Date</label>
            <input
              type="date"
              className="form-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="filter-actions">
            <button type="submit" className="btn-primary btn-sm">
              <Filter size={14} />
              Filter
            </button>
            {(status || fromDate || toDate) && (
              <button type="button" onClick={handleClearFilters} className="btn-secondary btn-sm">
                Clear
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Transactions Table */}
      <div className="card-panel">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading transaction journal...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state-box">
            <History size={40} color="#6b7280" />
            <p>No transactions found matching criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Reference Number</th>
                  <th>Description</th>
                  <th>Initiator</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Volume (₹)</th>
                  <th style={{ textAlign: 'center' }}>Ledger Legs</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                      {new Date(tx.createdAt).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <code className="reference-code">{tx.referenceNumber}</code>
                    </td>
                    <td style={{ fontWeight: 500, color: '#f3f4f6' }}>{tx.description}</td>
                    <td style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                      {tx.initiator?.fullName || tx.initiator?.email || 'System'}
                    </td>
                    <td>
                      <span className={`status-pill pill-${tx.status.toLowerCase()}`}>
                        {tx.status === 'POSTED' && <CheckCircle2 size={12} />}
                        {tx.status === 'FAILED' && <AlertOctagon size={12} />}
                        {tx.status === 'PENDING' && <Clock size={12} />}
                        {tx.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                      ₹{tx.totalAmountRupees}
                      <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                        {tx.totalAmountPaise} paise
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Eye size={12} />
                        Inspect ({tx.entriesCount || tx.entries?.length || 2})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination && (
          <div className="pagination-bar">
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Page <strong style={{ color: '#f3f4f6' }}>{pagination.page}</strong> of{' '}
              <strong style={{ color: '#f3f4f6' }}>{pagination.totalPages}</strong> ({pagination.totalItems} entries)
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setPage(page - 1);
                  fetchTransactions(page - 1);
                }}
                disabled={page <= 1 || loading}
                className="btn-secondary btn-sm"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <button
                onClick={() => {
                  setPage(page + 1);
                  fetchTransactions(page + 1);
                }}
                disabled={!pagination.hasMore || loading}
                className="btn-secondary btn-sm"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Details Inspector Modal */}
      {selectedTx && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f3f4f6' }}>Transaction Inspection</h3>
                <code className="reference-code" style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                  {selectedTx.referenceNumber}
                </code>
              </div>
              <button onClick={() => setSelectedTx(null)} className="modal-close-btn">
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="summary-row">
                <span className="summary-label">Status:</span>
                <span className={`status-pill pill-${selectedTx.status.toLowerCase()}`}>{selectedTx.status}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Volume:</span>
                <span className="summary-value" style={{ color: '#10b981', fontWeight: 700 }}>
                  ₹{selectedTx.totalAmountRupees} ({selectedTx.totalAmountPaise} paise)
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Initiator:</span>
                <span className="summary-value">{selectedTx.initiator?.fullName} ({selectedTx.initiator?.email})</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Timestamp:</span>
                <span className="summary-value">{new Date(selectedTx.createdAt).toLocaleString('en-IN')}</span>
              </div>

              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f3f4f6', marginTop: '1.5rem', marginBottom: '0.75rem' }}>
                Double-Entry Balanced Postings (&Sigma; Debits = &Sigma; Credits)
              </h4>

              <div className="table-responsive">
                <table className="ledger-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Leg / Type</th>
                      <th>Account</th>
                      <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                      <th style={{ textAlign: 'right' }}>Post-Entry Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedTx.entries || []).map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <span className={`status-pill pill-${entry.type.toLowerCase()}`}>
                            {entry.type}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{entry.accountName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{entry.accountNumber} ({entry.accountType})</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: entry.type === 'DEBIT' ? '#ef4444' : '#10b981' }}>
                          ₹{entry.amountRupees}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#f3f4f6' }}>
                          ₹{entry.runningBalanceRupees}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setSelectedTx(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
