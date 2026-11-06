import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { accountService, transactionService } from '../services/api';
import { formatPaiseToRupees, parseRupeesToPaise } from '../utils/money';
import ConfirmationModal from '../components/ConfirmationModal';
import {
  ArrowLeftRight,
  Wallet,
  AlertCircle,
  CheckCircle2,
  FileText,
  Repeat,
} from 'lucide-react';

export default function TransferPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [fromAccountId, setFromAccountId] = useState(searchParams.get('fromAccountId') || '');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  // Modal State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await accountService.getAccounts();
        if (res.data.success) {
          const list = res.data.accounts || [];
          setAccounts(list);
          if (!fromAccountId && list.length > 0) {
            setFromAccountId(list[0].id);
          }
          if (list.length > 1) {
            const second = list.find((a) => a.id !== (fromAccountId || list[0].id));
            if (second) setToAccountId(second.id);
          }
        }
      } catch (err) {
        setError('Failed to load accounts for transfer.');
      } finally {
        setFetching(false);
      }
    }
    loadAccounts();
  }, [fromAccountId]);

  const sourceAccount = accounts.find((a) => a.id === fromAccountId);
  const destinationAccount = accounts.find((a) => a.id === toAccountId);

  const getAmountPaise = () => {
    try {
      return parseRupeesToPaise(amount);
    } catch {
      return null;
    }
  };

  const amountPaise = getAmountPaise();
  const getPaisePreview = () => (amountPaise ?? 0n).toString();

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId) {
      setError('Please select both source and destination accounts.');
      return;
    }
    if (fromAccountId === toAccountId) {
      setError('Source and destination accounts must be different.');
      return;
    }
    if (amountPaise === null) {
      setError('Please enter a valid positive transfer amount.');
      return;
    }

    if (sourceAccount) {
      const requestedPaise = amountPaise;
      const availablePaise = BigInt(sourceAccount.balancePaise || 0);

      if (requestedPaise > availablePaise) {
        setError(
          `Insufficient funds: Source account only has ₹${sourceAccount.balanceRupees} available.`
        );
        return;
      }
    }

    setError(null);
    setIsConfirmOpen(true);
  };

  const handleExecuteTransfer = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        fromAccountId,
        toAccountId,
        amount: formatPaiseToRupees(parseRupeesToPaise(amount)),
        description: description.trim() || 'Internal account transfer',
      };

      const res = await transactionService.transfer(payload);
      if (res.data.success) {
        setSuccessData(res.data);
        setIsConfirmOpen(false);
      }
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Transfer failed.';
      setError(
        !err.response || err.response.status >= 500
          ? `${message} The outcome may be unknown; retry without changing the details to reuse the same request key.`
          : message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div className="form-page-header">
        <div className="form-page-icon transfer-icon-bg">
          <ArrowLeftRight size={28} />
        </div>
        <div>
          <h1 className="page-title">Transfer Funds</h1>
          <p className="page-description">Conserve money across accounts with deadlock-free row locking</p>
        </div>
      </div>

      {successData ? (
        <div className="success-receipt-card">
          <div className="receipt-badge">
            <CheckCircle2 size={32} color="#10b981" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f3f4f6', marginBottom: '0.5rem' }}>
            Transfer Completed Successfully!
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Reference Number: <code className="reference-code">{successData.transaction?.referenceNumber}</code>
          </p>

          <div className="receipt-details">
            <div className="summary-row">
              <span className="summary-label">Amount Transferred:</span>
              <span className="summary-value" style={{ color: '#10b981', fontWeight: 700 }}>
                ₹{formatPaiseToRupees(BigInt(successData.transaction.amountPaise))} ({successData.transaction.amountPaise} paise)
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Debited (From):</span>
              <span className="summary-value">{sourceAccount?.name} ({sourceAccount?.accountNumber})</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Credited (To):</span>
              <span className="summary-value">{destinationAccount?.name} ({destinationAccount?.accountNumber})</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Money Conservation Invariant:</span>
              <span className="summary-value" style={{ color: '#60a5fa' }}>
                &Delta; System Wealth = 0 paise (Strictly Preserved)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.75rem', justifyContent: 'center' }}>
            <Link to={`/accounts/${fromAccountId}/statement`} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} />
              Sender Statement
            </Link>
            <button
              onClick={() => {
                setSuccessData(null);
                setAmount('');
                setDescription('');
              }}
              className="btn-secondary"
            >
              Transfer Again
            </button>
          </div>
        </div>
      ) : (
        <div className="card-panel">
          {error && (
            <div className="alert-error" style={{ marginBottom: '1.25rem' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleOpenConfirm} className="financial-form">
            <div className="form-group">
              <label className="form-label">From Account (Debited)</label>
              <select
                className="form-select"
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                required
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.accountNumber}) &mdash; Balance: ₹{acc.balanceRupees}
                  </option>
                ))}
              </select>
            </div>

            {sourceAccount && (
              <div className="balance-indicator-box">
                <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Available in Source Account:</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>₹{sourceAccount.balanceRupees}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">To Account (Credited)</label>
              <select
                className="form-select"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                required
              >
                <option value="">-- Choose recipient account --</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id} disabled={acc.id === fromAccountId}>
                    {acc.name} ({acc.accountNumber}) {acc.id === fromAccountId ? '(Cannot select same account)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Transfer Amount (₹ INR)</label>
              <div className="currency-input-wrapper">
                <span className="currency-symbol">₹</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="(?:0|[1-9][0-9]*)(?:[.][0-9]{1,2})?"
                  required
                  placeholder="0.00"
                  className="currency-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <small style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.4rem', display: 'block' }}>
                Integer paise equivalent: <strong>{getPaisePreview()} paise</strong>
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Memo / Note (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Invoice settlement, Vault transfer"
                className="form-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading || fetching || accounts.length < 2}
              className="btn-primary form-submit-btn"
            >
              Review &amp; Confirm Transfer
            </button>

            {accounts.length < 2 && (
              <small style={{ color: '#f59e0b', display: 'block', textAlign: 'center', marginTop: '0.75rem' }}>
                You need at least two accounts to execute an internal transfer.{' '}
                <Link to="/accounts" style={{ color: '#60a5fa' }}>Create another account here</Link>.
              </small>
            )}
          </form>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleExecuteTransfer}
        title="Confirm Internal Transfer"
        operationType="TRANSFER"
        amountRupees={formatPaiseToRupees(amountPaise ?? 0n)}
        amountPaise={getPaisePreview()}
        fromAccount={sourceAccount}
        toAccount={destinationAccount}
        description={description || 'Account transfer'}
        loading={loading}
        errorMessage={error}
      />
    </div>
  );
}
