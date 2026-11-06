-- ============================================================================
-- LedgerLine: PostgreSQL integrity constraints and triggers
-- Snovasys Fresher Hiring Challenge 2026
--
-- Monetary values: integer paise (BIGINT)
-- Supported currency: INR only
--
-- Enforces:
-- 1. Positive transaction and ledger amounts.
-- 2. Balanced double-entry transactions.
-- 3. Ledger totals equal transaction.totalAmount.
-- 4. Failed transactions contain no ledger entries.
-- 5. No pending transactions can be committed.
-- 6. POSTED transactions require postedAt.
-- 7. PENDING and FAILED transactions cannot have postedAt.
-- 8. Account balances match their ledger entries.
-- 9. Non-negative account balances.
-- 10. Terminal transactions cannot be changed or deleted.
-- 11. Ledger entries and audit logs are append-only.
--
-- These controls supplement application authorization, row locking,
-- idempotency and atomic transaction handling.
-- ============================================================================


-- ============================================================================
-- 1. BASIC TABLE CONSTRAINTS
-- ============================================================================

ALTER TABLE "accounts"
  DROP CONSTRAINT IF EXISTS check_account_balance_non_negative;

ALTER TABLE "accounts"
  ADD CONSTRAINT check_account_balance_non_negative
  CHECK ("balance" >= 0);


ALTER TABLE "accounts"
  DROP CONSTRAINT IF EXISTS check_account_currency_inr;

ALTER TABLE "accounts"
  ADD CONSTRAINT check_account_currency_inr
  CHECK ("currency" = 'INR');


ALTER TABLE "ledger_entries"
  DROP CONSTRAINT IF EXISTS check_ledger_entry_amount_positive;

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT check_ledger_entry_amount_positive
  CHECK ("amount" > 0);


ALTER TABLE "transactions"
  DROP CONSTRAINT IF EXISTS check_transaction_amount_positive;

ALTER TABLE "transactions"
  ADD CONSTRAINT check_transaction_amount_positive
  CHECK ("totalAmount" > 0);


-- ============================================================================
-- 2. TRANSACTION STATUS AND IMMUTABILITY PROTECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_invalid_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'Transactions cannot be deleted. Use a separate reversal transaction.';
  END IF;

  -- Once POSTED or FAILED, no field can be changed.
  IF OLD."status" IN ('POSTED', 'FAILED') THEN
    RAISE EXCEPTION
      'A % transaction cannot be modified.',
      OLD."status";
  END IF;

  -- Only supported statuses are allowed.
  IF NEW."status" NOT IN ('PENDING', 'POSTED', 'FAILED') THEN
    RAISE EXCEPTION 'Invalid transaction status.';
  END IF;

  -- Financial identity and descriptive fields are immutable.
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."actorId" IS DISTINCT FROM OLD."actorId"
     OR NEW."totalAmount" IS DISTINCT FROM OLD."totalAmount"
     OR NEW."referenceNumber" IS DISTINCT FROM OLD."referenceNumber"
     OR NEW."reversalOfId" IS DISTINCT FROM OLD."reversalOfId"
     OR NEW."description" IS DISTINCT FROM OLD."description"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN

    RAISE EXCEPTION
      'Transaction identity, amount and descriptive fields cannot be changed.';
  END IF;

  -- A posted transaction must have a posting timestamp.
  IF NEW."status" = 'POSTED'
     AND NEW."postedAt" IS NULL THEN

    RAISE EXCEPTION
      'A POSTED transaction must have a postedAt timestamp.';
  END IF;

  -- Pending and failed transactions must not have a posting timestamp.
  IF NEW."status" IN ('PENDING', 'FAILED')
     AND NEW."postedAt" IS NOT NULL THEN

    RAISE EXCEPTION
      'A PENDING or FAILED transaction cannot have a postedAt timestamp.';
  END IF;

  -- A pending transaction cannot be assigned an earlier posting time.
  IF NEW."status" = 'PENDING'
     AND NEW."postedAt" IS NOT NULL THEN

    RAISE EXCEPTION
      'A PENDING transaction cannot have a posting timestamp.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_transaction_update_protection
ON "transactions";

CREATE TRIGGER trg_transaction_update_protection
BEFORE UPDATE ON "transactions"
FOR EACH ROW
EXECUTE FUNCTION prevent_invalid_transaction_changes();


DROP TRIGGER IF EXISTS trg_transaction_delete_protection
ON "transactions";

CREATE TRIGGER trg_transaction_delete_protection
BEFORE DELETE ON "transactions"
FOR EACH ROW
EXECUTE FUNCTION prevent_invalid_transaction_changes();


-- ============================================================================
-- 3. DOUBLE-ENTRY TRANSACTION VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_posted_transaction_balance(
  p_transaction_id TEXT
)
RETURNS VOID AS $$
DECLARE
  v_status TEXT;
  v_posted_at TIMESTAMP;
  v_expected_amount NUMERIC;
  v_entry_count BIGINT;
  v_debit_count BIGINT;
  v_credit_count BIGINT;
  v_total_debits NUMERIC;
  v_total_credits NUMERIC;
BEGIN

  SELECT
    "status"::TEXT,
    "postedAt",
    "totalAmount"::NUMERIC
  INTO
    v_status,
    v_posted_at,
    v_expected_amount
  FROM "transactions"
  WHERE "id" = p_transaction_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE "type" = 'DEBIT'),
    COUNT(*) FILTER (WHERE "type" = 'CREDIT'),
    COALESCE(
      SUM("amount") FILTER (WHERE "type" = 'DEBIT'),
      0
    ),
    COALESCE(
      SUM("amount") FILTER (WHERE "type" = 'CREDIT'),
      0
    )
  INTO
    v_entry_count,
    v_debit_count,
    v_credit_count,
    v_total_debits,
    v_total_credits
  FROM "ledger_entries"
  WHERE "transactionId" = p_transaction_id;

  -- Pending transactions cannot survive a commit.
  IF v_status = 'PENDING' THEN
    RAISE EXCEPTION
      'Transaction % cannot be committed while PENDING.',
      p_transaction_id;
  END IF;

  -- Failed transactions must have no posting timestamp or ledger entries.
  IF v_status = 'FAILED' THEN

    IF v_posted_at IS NOT NULL THEN
      RAISE EXCEPTION
        'Failed transaction % cannot have a postedAt timestamp.',
        p_transaction_id;
    END IF;

    IF v_entry_count <> 0 THEN
      RAISE EXCEPTION
        'Failed transaction % contains ledger entries.',
        p_transaction_id;
    END IF;

    RETURN;
  END IF;

  IF v_status <> 'POSTED' THEN
    RAISE EXCEPTION
      'Unsupported transaction status for transaction %.',
      p_transaction_id;
  END IF;

  -- Every posted transaction must have a posting timestamp.
  IF v_posted_at IS NULL THEN
    RAISE EXCEPTION
      'Posted transaction % has no postedAt timestamp.',
      p_transaction_id;
  END IF;

  -- Every posted transaction must have both sides.
  IF v_entry_count < 2
     OR v_debit_count < 1
     OR v_credit_count < 1 THEN

    RAISE EXCEPTION
      'Transaction % must have at least one debit and one credit.',
      p_transaction_id;
  END IF;

  IF v_total_debits <= 0 OR v_total_credits <= 0 THEN
    RAISE EXCEPTION
      'Transaction % must have positive debit and credit totals.',
      p_transaction_id;
  END IF;

  -- Debit and credit totals must match.
  IF v_total_debits <> v_total_credits THEN
    RAISE EXCEPTION
      'Transaction % is unbalanced: debits %, credits %.',
      p_transaction_id,
      v_total_debits,
      v_total_credits;
  END IF;

  -- Debit total must equal the transaction amount.
  IF v_total_debits <> v_expected_amount THEN
    RAISE EXCEPTION
      'Transaction % amount mismatch: expected %, actual %.',
      p_transaction_id,
      v_expected_amount,
      v_total_debits;
  END IF;

END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 4. DEFERRED TRANSACTION VALIDATION TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_fn_verify_transaction_from_ledger()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM validate_posted_transaction_balance(NEW."transactionId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_verify_double_entry_balance_entry
ON "ledger_entries";

CREATE CONSTRAINT TRIGGER trg_verify_double_entry_balance_entry
AFTER INSERT ON "ledger_entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION trg_fn_verify_transaction_from_ledger();


CREATE OR REPLACE FUNCTION trg_fn_verify_transaction_from_transaction()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM validate_posted_transaction_balance(NEW."id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_verify_double_entry_balance_tx
ON "transactions";

CREATE CONSTRAINT TRIGGER trg_verify_double_entry_balance_tx
AFTER INSERT OR UPDATE ON "transactions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION trg_fn_verify_transaction_from_transaction();


-- ============================================================================
-- 5. ACCOUNT BALANCE RECONCILIATION
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_account_ledger_balance(
  p_account_id TEXT
)
RETURNS VOID AS $$
DECLARE
  v_account_type TEXT;
  v_account_balance NUMERIC;
  v_debits NUMERIC;
  v_credits NUMERIC;
  v_expected_balance NUMERIC;
BEGIN

  SELECT
    "type"::TEXT,
    "balance"::NUMERIC
  INTO
    v_account_type,
    v_account_balance
  FROM "accounts"
  WHERE "id" = p_account_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(
      SUM("amount") FILTER (WHERE "type" = 'DEBIT'),
      0
    ),
    COALESCE(
      SUM("amount") FILTER (WHERE "type" = 'CREDIT'),
      0
    )
  INTO
    v_debits,
    v_credits
  FROM "ledger_entries"
  WHERE "accountId" = p_account_id;

  -- Normal balances:
  -- ASSET / EXPENSE = DEBIT - CREDIT
  -- LIABILITY / EQUITY / REVENUE = CREDIT - DEBIT

  IF v_account_type IN ('ASSET', 'EXPENSE') THEN
    v_expected_balance := v_debits - v_credits;
  ELSE
    v_expected_balance := v_credits - v_debits;
  END IF;

  IF v_expected_balance < 0 THEN
    RAISE EXCEPTION
      'Account % has a negative ledger balance: %.',
      p_account_id,
      v_expected_balance;
  END IF;

  IF v_account_balance <> v_expected_balance THEN
    RAISE EXCEPTION
      'Account % balance mismatch. Cached balance: %, ledger balance: %.',
      p_account_id,
      v_account_balance,
      v_expected_balance;
  END IF;

END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION trg_fn_verify_account_from_ledger()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM validate_account_ledger_balance(NEW."accountId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_verify_account_balance_from_ledger
ON "ledger_entries";

CREATE CONSTRAINT TRIGGER trg_verify_account_balance_from_ledger
AFTER INSERT ON "ledger_entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION trg_fn_verify_account_from_ledger();


CREATE OR REPLACE FUNCTION trg_fn_verify_account_from_account()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM validate_account_ledger_balance(NEW."id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_verify_account_balance_from_account
ON "accounts";

CREATE CONSTRAINT TRIGGER trg_verify_account_balance_from_account
AFTER INSERT OR UPDATE ON "accounts"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION trg_fn_verify_account_from_account();


-- ============================================================================
-- 6. PREVENT ACCOUNT TYPE / CURRENCY CHANGES AFTER LEDGER ACTIVITY
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_account_accounting_identity_change()
RETURNS TRIGGER AS $$
BEGIN

  IF (
    NEW."type" IS DISTINCT FROM OLD."type"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
  ) AND EXISTS (
    SELECT 1
    FROM "ledger_entries"
    WHERE "accountId" = OLD."id"
  ) THEN

    RAISE EXCEPTION
      'Account type and currency cannot change after ledger activity.';
  END IF;

  RETURN NEW;

END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_protect_account_accounting_identity
ON "accounts";

CREATE TRIGGER trg_protect_account_accounting_identity
BEFORE UPDATE ON "accounts"
FOR EACH ROW
EXECUTE FUNCTION prevent_account_accounting_identity_change();


-- ============================================================================
-- 7. APPEND-ONLY LEDGER AND AUDIT PROTECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_immutable_record_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'UPDATE, DELETE and TRUNCATE are forbidden on immutable table "%".',
    TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_immutable_ledger_entries
ON "ledger_entries";

CREATE TRIGGER trg_immutable_ledger_entries
BEFORE UPDATE OR DELETE ON "ledger_entries"
FOR EACH ROW
EXECUTE FUNCTION prevent_immutable_record_modification();


DROP TRIGGER IF EXISTS trg_immutable_audit_logs
ON "audit_logs";

CREATE TRIGGER trg_immutable_audit_logs
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION prevent_immutable_record_modification();


DROP TRIGGER IF EXISTS trg_no_truncate_ledger_entries
ON "ledger_entries";

CREATE TRIGGER trg_no_truncate_ledger_entries
BEFORE TRUNCATE ON "ledger_entries"
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_immutable_record_modification();


DROP TRIGGER IF EXISTS trg_no_truncate_audit_logs
ON "audit_logs";

CREATE TRIGGER trg_no_truncate_audit_logs
BEFORE TRUNCATE ON "audit_logs"
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_immutable_record_modification();


-- ============================================================================
-- 8. PRODUCTION DATABASE ROLE GUIDANCE
-- ============================================================================
--
-- Never use the PostgreSQL superuser as the application's production
-- connection account.
--
-- Create a dedicated restricted role using a securely managed password.
--
-- Example (run separately as a database administrator):
--
-- CREATE ROLE ledgerline_app LOGIN PASSWORD 'REPLACE_WITH_SECURE_PASSWORD';
--
-- GRANT CONNECT ON DATABASE ledgerline TO ledgerline_app;
-- GRANT USAGE ON SCHEMA public TO ledgerline_app;
--
-- GRANT SELECT, INSERT, UPDATE ON
--   "users",
--   "accounts",
--   "account_permissions",
--   "transactions",
--   "idempotency_keys"
-- TO ledgerline_app;
--
-- GRANT SELECT, INSERT ON
--   "ledger_entries",
--   "audit_logs"
-- TO ledgerline_app;
--
-- REVOKE UPDATE, DELETE, TRUNCATE ON
--   "ledger_entries",
--   "audit_logs"
-- FROM ledgerline_app;
--
-- IMPORTANT:
-- Verify all required Prisma operations and sequence privileges before
-- switching the production application to this role.
--
-- A database owner or superuser can still disable triggers or alter
-- constraints. These controls do not protect against a malicious owner.
-- ============================================================================