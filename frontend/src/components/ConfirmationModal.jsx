import React from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Transaction',
  operationType = 'TRANSFER', // 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER'
  amountRupees = '0.00',
  amountPaise = '0',
  fromAccount = null,
  toAccount = null,
  description = '',
  loading = false,
  errorMessage = null,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>{title}</h3>
          </div>
          <button onClick={onClose} disabled={loading} className="modal-close-btn">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {errorMessage && (
            <div className="alert-error" style={{ marginBottom: '1rem' }}>
              {errorMessage}
            </div>
          )}
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Please verify all details carefully. Double-entry financial transactions are posted to the immutable ledger and cannot be deleted.
          </p>

          <div className="confirm-summary-box">
            <div className="summary-row">
              <span className="summary-label">Operation Type:</span>
              <span className="summary-value" style={{ fontWeight: 600, color: '#60a5fa' }}>{operationType}</span>
            </div>

            {fromAccount && (
              <div className="summary-row">
                <span className="summary-label">Debiting Account:</span>
                <span className="summary-value">{fromAccount.name} ({fromAccount.accountNumber})</span>
              </div>
            )}

            {toAccount && (
              <div className="summary-row">
                <span className="summary-label">Crediting Account:</span>
                <span className="summary-value">{toAccount.name} ({toAccount.accountNumber})</span>
              </div>
            )}

            <div className="summary-row" style={{ borderTop: '1px solid #374151', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
              <span className="summary-label" style={{ fontWeight: 700, color: '#f9fafb' }}>Transaction Amount:</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>₹{amountRupees}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>({amountPaise} integer paise)</div>
              </div>
            </div>

            {description && (
              <div className="summary-row">
                <span className="summary-label">Memo / Description:</span>
                <span className="summary-value" style={{ fontStyle: 'italic' }}>{description}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {loading ? (
              <>
                <span className="button-spinner"></span>
                Posting to Ledger...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Confirm &amp; Post
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
