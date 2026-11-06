import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { accountService, transactionService } from '../services/api';
import { formatPaiseToRupees, parseRupeesToPaise } from '../utils/money';
import ConfirmationModal from '../components/ConfirmationModal';
import {
  ArrowDownLeft,
  Wallet,
  AlertCircle,
  CheckCircle2,
  FileText,
  ShieldCheck,
} from 'lucide-react';

export default function DepositPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(searchParams.get('accountId') || '');
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
          if (!selectedAccountId && list.length > 0) {
            setSelectedAccountId(list[0].id);
          }
        }
      } catch (err) {
        setError('Failed to load accounts for deposit.');
      } finally {
        setFetching(false);
      }
    }
    loadAccounts();
  }, [selectedAccountId]);

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
    if (!selectedAccountId) {
      setError('Please select an account.');
      return;
    }
    if (amountPaise === null) {
      setError('Please enter a valid positive deposit amount.');
      return;
    }
    setError(null);
    setIsConfirmOpen(true);
  };

  const handleExecuteDeposit = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        accountId: selectedAccountId,
        amount: formatPaiseToRupees(parseRupeesToPaise(amount)),
        description: description.trim() || 'Customer cash deposit',
      };

      const res = await transactionService.deposit(payload);
      if (res.data.success) {
        setSuccessData(res.data);
        setIsConfirmOpen(false);
      }
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Deposit failed.';
      setError(
        !err.response || err.response.status >= 500
          ? `${message} The outcome may be unknown; retry without changing the details to reuse the same request key.`
          : message
      );
    } finally {
      setLoading(false);
    }
  };

  const targetAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="page-container" style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div className="form-page-header">
        <div className="form-page-icon deposit-icon-bg">
          <ArrowDownLeft size={28} />
        </div>
        <div>
          <h1 className="page-title">Deposit Money</h1>
          <p className="page-description">Inject funds via balanced double-entry cash deposit</p>
        </div>
      </div>

      {successData ? (
        <div className="success-receipt-card">
          <div className="receipt-badge">
            <CheckCircle2 size={32} color="#10b981" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f3f4f6', marginBottom: '0.5rem' }}>
            Deposit Successfully Posted!
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Reference Number: <code className="reference-code">{successData.transaction?.referenceNumber}</code>
          </p>

          <div className="receipt-details">
            <div className="summary-row">
              <span className="summary-label">Amount Deposited:</span>
              <span className="summary-value" style={{ color: '#10b981', fontWeight: 700 }}>
                ₹{formatPaiseToRupees(BigInt(successData.transaction.amountPaise))} ({successData.transaction.amountPaise} paise)
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Credited Account:</span>
              <span className="summary-value">{targetAccount?.name}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Ledger Entry Invariant:</span>
              <span className="summary-value" style={{ color: '#60a5fa' }}>
                Debit: Bank Cash &bull; Credit: {targetAccount?.accountNumber}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.75rem', justifyContent: 'center' }}>
            <Link to={`/accounts/${selectedAccountId}/statement`} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} />
              View Statement
            </Link>
            <button
              onClick={() => {
                setSuccessData(null);
                setAmount('');
                setDescription('');
              }}
              className="btn-secondary"
            >
              Deposit Again
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
              <label className="form-label">Select Destination Account</label>
              {fetching ? (
                <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Loading accounts...</p>
              ) : accounts.length === 0 ? (
                <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                  No accounts available. Please <Link to="/accounts" style={{ color: '#60a5fa' }}>create an account</Link> first.
                </div>
              ) : (
                <select
                  className="form-select"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  required
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.accountNumber}) &mdash; Balance: ₹{acc.balanceRupees}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Deposit Amount (₹ INR)</label>
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
              <label className="form-label">Memo / Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Salary deposit, Initial funding"
                className="form-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading || fetching || accounts.length === 0}
              className="btn-primary form-submit-btn"
            >
              Review &amp; Confirm Deposit
            </button>
          </form>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleExecuteDeposit}
        title="Confirm Cash Deposit"
        operationType="DEPOSIT"
        amountRupees={formatPaiseToRupees(amountPaise ?? 0n)}
        amountPaise={getPaisePreview()}
        toAccount={targetAccount}
        description={description || 'Cash deposit'}
        loading={loading}
        errorMessage={error}
      />
    </div>
  );
}
