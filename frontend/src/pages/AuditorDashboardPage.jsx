import React, { useState, useEffect } from 'react';
import { auditService } from '../services/api';
import {
  FileSearch,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
  Clock,
  Lock,
} from 'lucide-react';

export default function AuditorDashboardPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchAuditData = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: targetPage,
        limit,
        ...(actionFilter && { action: actionFilter }),
      };

      const logRes = await auditService.getAuditLogs(params);

      if (logRes.data.success) {
        setLogs(logRes.data.logs || []);
        setPagination(logRes.data.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch audit records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData(1);
    setPage(1);
  }, [actionFilter]);

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="page-title">Regulatory &amp; Compliance Audit</h1>
            <span className="badge-tag" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
              <Lock size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Read-Only Regulatory Mode
            </span>
          </div>
          <p className="page-description">
            Read-only access to assigned account and transaction records, with system-wide audit-log search
          </p>
        </div>

        <button onClick={() => fetchAuditData(page)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh Audit Trail
        </button>
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Access scope matches the read permissions granted to this auditor. */}
      <div className="reconciliation-card" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="recon-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f3f4f6' }}>
              Read-only audit access
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Account and transaction details are limited to accounts assigned to you. Audit-log search is system-wide and read-only; it is not a cryptographic attestation or an independent live solvency calculation.
            </p>
          </div>
        </div>
      </div>

      {/* Audit Log Filters */}
      <div className="filter-card">
        <div className="filter-inputs-row">
          <div className="filter-field" style={{ flex: '1 1 300px' }}>
            <label className="filter-label">Filter Audit Action</label>
            <select
              className="form-select"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All System Actions</option>
              <option value="REFUSED">Refused Transaction Attempts (*_REFUSED)</option>
              <option value="POSTED">Posted Transactions (*_POSTED)</option>
              <option value="ACCOUNT">Account Events (ACCOUNT_*)</option>
              <option value="USER">User Events (USER_*)</option>
            </select>
          </div>

          <div className="filter-actions">
            {actionFilter && (
              <button onClick={() => setActionFilter('')} className="btn-secondary btn-sm">
                Clear Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="card-panel">
        <div className="card-panel-header">
          <div>
            <h3 className="panel-title">Immutable Audit Trail</h3>
            <p className="panel-subtitle">Protected from modification and deletion by PostgreSQL triggers</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state-box">
            <FileSearch size={36} color="#6b7280" />
            <p>No audit log records found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Entity ID</th>
                  <th>Actor / User</th>
                  <th>IP Address</th>
                  <th style={{ textAlign: 'center' }}>Payload</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isRefusal = log.action.includes('REFUSED');

                  return (
                    <tr key={log.id} className={isRefusal ? 'row-refused' : ''}>
                      <td style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                        {new Date(log.createdAt).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                      <td>
                        <span className={`status-pill ${isRefusal ? 'pill-failed' : 'pill-posted'}`}>
                          {isRefusal ? <AlertOctagon size={12} /> : <CheckCircle2 size={12} />}
                          {log.action}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.85rem', color: '#f3f4f6' }}>{log.entityType}</span>
                      </td>

                      <td>
                        <code className="reference-code" style={{ fontSize: '0.75rem' }}>
                          {log.entityId}
                        </code>
                      </td>

                      <td style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                        {log.user ? `${log.user.fullName} (${log.user.role})` : 'System Daemon'}
                      </td>

                      <td style={{ fontSize: '0.8rem', color: '#6b7280', fontFamily: 'monospace' }}>
                        {log.ipAddress || 'internal'}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="btn-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <Eye size={12} />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
                  fetchAuditData(page - 1);
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
                  fetchAuditData(page + 1);
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

      {/* Audit Detail Modal */}
      {selectedLog && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f3f4f6' }}>Audit Record Inspection</h3>
                <span className="status-pill pill-posted" style={{ marginTop: '0.25rem' }}>
                  {selectedLog.action}
                </span>
              </div>
              <button onClick={() => setSelectedLog(null)} className="modal-close-btn">
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="summary-row">
                <span className="summary-label">Audit Record ID:</span>
                <code className="info-code">{selectedLog.id}</code>
              </div>
              <div className="summary-row">
                <span className="summary-label">Target Entity:</span>
                <span className="summary-value">{selectedLog.entityType} ({selectedLog.entityId})</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Actor / Originator:</span>
                <span className="summary-value">{selectedLog.user?.fullName || 'System Event'}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Timestamp:</span>
                <span className="summary-value">{new Date(selectedLog.createdAt).toISOString()}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Client User-Agent:</span>
                <span className="summary-value" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  {selectedLog.userAgent || 'N/A'}
                </span>
              </div>

              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f3f4f6', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                Event Payload Snapshots (JSON)
              </h4>

              <div style={{ background: '#0a0e17', borderRadius: '8px', padding: '1rem', border: '1px solid #1f2937' }}>
                <pre style={{ fontSize: '0.8rem', color: '#34d399', overflowX: 'auto' }}>
                  {JSON.stringify(
                    {
                      oldValues: selectedLog.oldValues,
                      newValues: selectedLog.newValues,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setSelectedLog(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
