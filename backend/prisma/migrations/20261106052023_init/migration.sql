-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ACCOUNT_HOLDER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('OWNER', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ACCOUNT_HOLDER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountNumber" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "AccountType" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "balance" BIGINT NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "permission" "PermissionLevel" NOT NULL DEFAULT 'VIEWER',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "referenceNumber" VARCHAR(64) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" BIGINT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "EntryType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "runningBalance" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "userId" TEXT NOT NULL,
    "requestPath" VARCHAR(200) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PENDING',
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "lockedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(100) NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_accountNumber_key" ON "accounts"("accountNumber");

-- CreateIndex
CREATE INDEX "accounts_status_idx" ON "accounts"("status");

-- CreateIndex
CREATE INDEX "accounts_type_idx" ON "accounts"("type");

-- CreateIndex
CREATE INDEX "account_permissions_userId_idx" ON "account_permissions"("userId");

-- CreateIndex
CREATE INDEX "account_permissions_accountId_idx" ON "account_permissions"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "account_permissions_userId_accountId_key" ON "account_permissions"("userId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_referenceNumber_key" ON "transactions"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reversalOfId_key" ON "transactions"("reversalOfId");

-- CreateIndex
CREATE INDEX "transactions_actorId_createdAt_idx" ON "transactions"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_status_createdAt_idx" ON "transactions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_accountId_createdAt_id_idx" ON "ledger_entries"("accountId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ledger_entries_transactionId_idx" ON "ledger_entries"("transactionId");

-- CreateIndex
CREATE INDEX "idempotency_keys_userId_status_idx" ON "idempotency_keys"("userId", "status");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_userId_key_requestPath_key" ON "idempotency_keys"("userId", "key", "requestPath");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "account_permissions" ADD CONSTRAINT "account_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_permissions" ADD CONSTRAINT "account_permissions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;



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
-- 6. Account balances match their ledger entries.
-- 7. Non-negative account balances.
-- 8. Posted transactions cannot be modified or deleted.
-- 9. Ledger entries and audit logs are append-only.
--
-- IMPORTANT:
-- These triggers supplement application-level authorization,
-- row locking, idempotency and atomic transaction handling.
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
-- 2. TRANSACTION STATUS TRANSITION PROTECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_invalid_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'Transactions cannot be deleted. Use a separate reversal transaction.';
  END IF;

  -- A terminal transaction cannot be changed.
  IF OLD."status" IN ('POSTED', 'FAILED') THEN
    RAISE EXCEPTION
      'A % transaction cannot be modified.',
      OLD."status";
  END IF;

  -- PENDING may remain PENDING or transition to POSTED/FAILED.
  IF NEW."status" NOT IN ('PENDING', 'POSTED', 'FAILED') THEN
    RAISE EXCEPTION 'Invalid transaction status.';
  END IF;

  -- The transaction identity and financial amount are immutable.
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."actorId" IS DISTINCT FROM OLD."actorId"
     OR NEW."totalAmount" IS DISTINCT FROM OLD."totalAmount"
     OR NEW."referenceNumber" IS DISTINCT FROM OLD."referenceNumber"
     OR NEW."reversalOfId" IS DISTINCT FROM OLD."reversalOfId" THEN
    RAISE EXCEPTION
      'Transaction identity and financial fields cannot be changed.';
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
  v_expected_amount NUMERIC;
  v_entry_count BIGINT;
  v_debit_count BIGINT;
  v_credit_count BIGINT;
  v_total_debits NUMERIC;
  v_total_credits NUMERIC;
BEGIN

  SELECT
    "status"::TEXT,
    "totalAmount"::NUMERIC
  INTO
    v_status,
    v_expected_amount
  FROM "transactions"
  WHERE "id" = p_transaction_id;

  -- Transaction may have been removed only by an administrator
  -- outside the normal application flow.
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

  -- A PENDING transaction must not survive the commit.
  IF v_status = 'PENDING' THEN
    RAISE EXCEPTION
      'Transaction % cannot be committed while PENDING.',
      p_transaction_id;
  END IF;

  -- Failed operations must not have financial ledger entries.
  IF v_status = 'FAILED' THEN
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

  -- Every posted transaction must have both sides.
  IF v_entry_count < 2
     OR v_debit_count < 1
     OR v_credit_count < 1 THEN
    RAISE EXCEPTION
      'Transaction % must have at least one debit and one credit.',
      p_transaction_id;
  END IF;

  -- Debit and credit totals must be positive.
  IF v_total_debits <= 0 OR v_total_credits <= 0 THEN
    RAISE EXCEPTION
      'Transaction % must have positive debit and credit totals.',
      p_transaction_id;
  END IF;

  -- Double-entry accounting invariant.
  IF v_total_debits <> v_total_credits THEN
    RAISE EXCEPTION
      'Transaction % is unbalanced: debits %, credits %.',
      p_transaction_id,
      v_total_debits,
      v_total_credits;
  END IF;

  -- The balanced amount must equal the transaction amount.
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

  -- Normal balance:
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


-- Deferred check after a ledger entry is inserted.
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


-- Deferred check after account creation or modification.
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


-- TRUNCATE is a statement-level operation, so it needs separate triggers.

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
-- 8. APPLICATION DATABASE ROLE - PRODUCTION GUIDANCE
-- ============================================================================
--
-- Do not use the PostgreSQL superuser as the application's production
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
-- The production application must also be granted only the minimum
-- privileges needed for its actual database operations.
--
-- A table owner or superuser can still disable triggers or alter constraints.
-- These database controls do not protect against a malicious database owner.
-- ============================================================================
