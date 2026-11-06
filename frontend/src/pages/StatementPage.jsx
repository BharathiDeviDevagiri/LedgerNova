import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { accountService } from '../services/api';
import {
  FileText,
  ArrowLeft,
  Calendar,
  Filter,
  CheckCircle2,
  AlertOctagon,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

export default function StatementPage() {
  const { accountId } = useParams();
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Pagination States
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchStatement = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: targetPage,
        limit,
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate }),
      };

      const res = await accountService.getStatement(accountId, params);
      if (res.data.success) {
        setStatement(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load statement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement(1);
    setPage(1);
  }, [accountId]);

  const handleApplyFilter = (e) => {
    e.preventDefault();
    setPage(1);
    fetchStatement(1);
  };

  const handleClearFilter = () => {
    setFromDate('');
    setToDate('');
    setPage(1);
    // Fetch statement without date filters
    accountService.getStatement(accountId, { page: 1, limit }).then((res) => {
      if (res.data.success) setStatement(res.data);
    });
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchStatement(newPage);
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.25rem' }}>
        <Link to={`/accounts/${accountId}`} className="back-nav-link">
          <ArrowLeft size={16} />
          <span>Back to Account Overview</span>
        </Link>
      </div>

      {statement?.account && (
        <div className="statement-header-banner">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 className="page-title">Account Statement</h1>
              <span className="badge-tag">Audited Source of Truth</span>
            </div>
            <p className="page-description">
              {statement.account.name} &bull; <code>{statement.account.accountNumber}</code>
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Current Reconciled Balance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>
              ₹{statement.account.currentBalance}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>
              ({statement.account.currentBalancePaise} paise)
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert-error" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Date Filter Bar */}
      <form onSubmit={handleApplyFilter} className="filter-card">
        <div className="filter-inputs-row">
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
              Apply Filter
            </button>
            {(fromDate || toDate) && (
              <button type="button" onClick={handleClearFilter} className="btn-secondary btn-sm">
                Clear
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Statement Entries Table */}
      <div className="card-panel">
        <div className="card-panel-header">
          <div>
            <h3 className="panel-title">Statement Entries &amp; Audit Rejections</h3>
            <p className="panel-subtitle">
              Chronological log of double-entry ledger entries and refused attempts
            </p>
          </div>
          <button onClick={() => fetchStatement(page)} className="btn-secondary btn-sm">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Fetching statement records...</p>
          </div>
        ) : !statement?.entries || statement.entries.length === 0 ? (
          <div className="empty-state-box">
            <FileText size={40} color="#6b7280" />
            <p>No activity recorded for this period.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Status / Type</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th>Initiator</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.entries.map((item) => {
                  const isRefused = item.status === 'REFUSED';
                  const isDebit = item.type === 'DEBIT';

                  return (
                    <tr key={item.id} className={isRefused ? 'row-refused' : ''}>
                      <td style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                        {new Date(item.date).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td>
                        {isRefused ? (
                          <span className="status-pill pill-failed">
                            <AlertOctagon size={12} />
                            Refused
                          </span>
                        ) : (
                          <span className={`status-pill pill-${isDebit ? 'debit' : 'credit'}`}>
                            {isDebit ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                            {item.type}
                          </span>
                        )}
                      </td>

                      <td>
                        {item.reference ? (
                          <code className="reference-code">{item.reference}</code>
                        ) : (
                          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>&mdash;</span>
                        )}
                      </td>

                      <td>
                        <div style={{ fontWeight: 500, color: '#f3f4f6' }}>{item.description}</div>
                        {item.refusalReason && (
                          <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                            Reason: {item.refusalReason}
                          </div>
                        )}
                      </td>

                      <td style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                        {item.initiator?.fullName || item.initiator?.email || 'System'}
                      </td>

                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: isRefused ? '#9ca3af' : isDebit ? '#ef4444' : '#10b981',
                        }}
                      >
                        {isDebit ? '-' : '+'}₹{item.amount}
                        <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                          {item.amountPaise} paise
                        </div>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {item.runningBalance ? (
                          <>
                            <div style={{ color: '#f3f4f6' }}>₹{item.runningBalance}</div>
                            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                              {item.runningBalancePaise} paise
                            </div>
                          </>
                        ) : (
                          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>&mdash;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {statement?.pagination && (
          <div className="pagination-bar">
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Showing Page <strong style={{ color: '#f3f4f6' }}>{statement.pagination.page}</strong> of{' '}
              <strong style={{ color: '#f3f4f6' }}>{statement.pagination.totalPages}</strong> (
              {statement.pagination.totalItems} total records)
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || loading}
                className="btn-secondary btn-sm"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={!statement.pagination.hasMore || loading}
                className="btn-secondary btn-sm"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
