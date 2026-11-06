# LedgerLine Threat Model & Security Architecture Review
> Snovasys Fresher Hiring Challenge 2026

---

## 1. Executive Summary & Security Philosophy

LedgerLine is designed around a **double-entry financial core**. Client input is validated, money amounts are stored as integer paise, balances are protected by row-level database locks, and financial ledger records are protected by database append-only triggers. The ledger is not cryptographically hash-chained or independently tamper-evident.

This document details the threat vectors analyzed, defenses implemented, and residual operational risks.

---

## 2. Threat Vector Analysis & Implemented Defenses

### A. Unauthorized Account Access & IDOR (Insecure Direct Object References)
* **Threat**: An attacker modifies the `accountId` in API requests (`GET /api/accounts/:id`, `GET /api/accounts/:id/statement`, `POST /api/transactions/withdraw`, etc.) to view balances, read statements, or drain funds from accounts belonging to another user.
* **Defense**:
  - `authenticateToken` resolves identity strictly from cryptographically signed JWTs (`req.user.id`). Client-supplied user IDs in headers or bodies are ignored.
  - Multi-tiered authorization:
    - **ADMIN**: Has system administration access.
    - **AUDITOR**: Has read-only access. Account and transaction details require an explicit account permission; audit logs are system-wide.
    - **ACCOUNT_HOLDER**: Scoped to the `AccountPermission` join table. Queries verify `userId_accountId` permissions (`OWNER` or `MANAGER` required for debits; `VIEWER` or higher for statements).
  - Inside financial transactions (`transaction.service.js`), `authorizeAccountDebit()` verifies account-level permission *inside the locked database transaction*, preventing race conditions between permission changes and money movement.

---

### B. Duplicate Payments & Replay Attacks
* **Threat**: A user clicks "Transfer" multiple times, or a network timeout causes a payment client to retry an HTTP POST, causing duplicate transfers or double-billing.
* **Defense**:
  - Every mutating endpoint (`/deposit`, `/withdraw`, `/transfer`) requires a non-empty `Idempotency-Key` HTTP header.
  - Idempotency keys are scoped to `(userId, key, requestPath)` via a composite unique constraint in PostgreSQL.
  - **Deterministic Payload Hashing**: The request body is hashed using SHA-256 (`requestHash`).
  - **Identical Replay**: If the same key and identical body arrive after completion, the server returns the stored response with `replayed: true` without creating duplicate ledger entries.
  - **Conflict Detection**: If the same key is reused with a *different* body, the server immediately rejects the request with **HTTP 409 Conflict**.
  - **Concurrent Request Coordination**: Duplicate requests serialize on a PostgreSQL transaction-scoped advisory lock. The idempotency record and financial posting commit atomically.
  - **Client Retry**: The browser reuses a saved key for an identical request after a timeout or server error. A new key is used for a changed payload.
  - **Retention limitation**: `expiresAt` is currently metadata only; no expiry check or cleanup job exists, so keys remain reserved and records accumulate.

---

### C. Concurrent Spending & Race Conditions (Double-Spend)
* **Threat**: Two simultaneous requests attempt to withdraw ₹10,000 from an account that only has ₹10,000 available. If balances are read before updating, both requests may approve the debit, creating an illegal overdraft of ₹10,000.
* **Defense**:
  - **Pessimistic Row Locking (`SELECT ... FOR UPDATE`)**: Before inspecting or modifying balances, LedgerLine acquires row-level exclusive locks on all involved accounts.
  - **Post-Lock Balance Verification**: Account balance is inspected *only after* acquiring the lock, eliminating Time-of-Check to Time-of-Use (TOCTOU) race conditions.
  - **Deadlock-Free Deterministic Ordering**: When transferring between two accounts (Account A and Account B), account IDs are sorted lexicographically (`[idA, idB].sort()`) before acquiring locks. Circular wait deadlocks are mathematically impossible.
  - Account-permission changes take the same account row lock as financial operations; active-user verification takes a shared user-row lock during posting.

---

### D. Negative Balances & Floating-Point Drift
* **Threat**:
  - Accounts drop below zero, creating uncollateralized credit risk.
  - IEEE 754 floating-point inaccuracies ($0.1 + 0.2 = 0.30000000000000004$) lead to fractional paise leakage.
* **Defense**:
  - **Integer Paise Storage**: All monetary values (`Account.balance`, `Transaction.totalAmount`, `LedgerEntry.amount`, `LedgerEntry.runningBalance`) use 64-bit `BigInt` storing paise ($₹1.00 = 100 \text{ paise}$).
  - **Application Guard**: `calculateNextBalance()` rejects any balance calculation resulting in $< 0\text{ paise}$ with `INSUFFICIENT_FUNDS`.
  - **Database Constraint**: PostgreSQL enforces `ALTER TABLE accounts ADD CONSTRAINT check_account_balance_non_negative CHECK (balance >= 0)`.
  - **Ledger Invariant**: `ALTER TABLE ledger_entries ADD CONSTRAINT check_ledger_entry_amount_positive CHECK (amount > 0)`.

---

### E. Ledger Tampering & History Rewriting
* **Threat**: A rogue developer, malicious script, or compromised application account attempts to modify historical ledger entries or delete audit logs to conceal fraudulent transfers.
* **Defense**:
  - **Append-Only Immutability Triggers**: PostgreSQL triggers (`trg_immutable_ledger_entries`, `trg_immutable_audit_logs`, `trg_no_truncate_ledger_entries`, `trg_no_truncate_audit_logs`) intercept `UPDATE`, `DELETE`, and `TRUNCATE` operations on ledger and audit tables and raise an exception.
  - **Terminal Transaction Protection**: Once a transaction is marked `POSTED` or `FAILED`, trigger `prevent_invalid_transaction_changes()` forbids any alteration to its status, amount, initiator, or ledger entries.
  - **Dual Deferred Balancing Triggers**: Evaluated at `COMMIT` time, asserting that $\sum \text{Debits} == \sum \text{Credits} > 0$ and $\text{entry\_count} \ge 2$.

---

### F. SQL Injection & Parameter Tampering
* **Threat**: Malicious SQL fragments supplied via user input manipulate query execution.
* **Defense**:
  - Prisma ORM uses parameterized queries for all relational operations.
  - Where raw SQL is used for row locking (`SELECT id FROM accounts WHERE id = ${accountId} FOR UPDATE`), tagged template literals (`tx.$queryRaw`) parameterize all variables as typed placeholders (`$1`), preventing SQL injection.

---

### G. Credential Theft & JWT Security
* **Threat**: Password brute-forcing, rainbow table lookups, token sniffing, or expired token reuse.
* **Defense**:
  - Passwords are salted and hashed using **bcrypt** with a work factor of 12 in the application and seed script.
  - JWTs are signed using HMAC-SHA256 with a minimum 32-character secret (`JWT_SECRET`).
  - Short token expiration (2 hours).
  - Active user verification: On every authenticated request, `authenticateToken` checks the live database to verify that `user.isActive === true`. Deactivated users are immediately locked out.
  - In-process IP-based limits are applied to login (10 per 15 minutes) and registration (5 per 15 minutes). These limits are per application process and need a shared store for multi-instance deployments.
  - Seed accounts require unique environment-supplied passwords; the seed command refuses to run with `NODE_ENV=production` and does not print passwords. This guard does not change pre-existing accounts.

---

## 3. Database Privilege Risks & Least-Privilege Recommendations

| Privilege Level | Capability | Risk | Mitigation |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Superuser (`postgres`)** | Full control; can disable triggers via `ALTER TABLE ... DISABLE TRIGGER ALL` | A compromised database superuser credential bypasses trigger immutability. | In production, **never connect the application as `postgres`**. Configure `ledgerline_app` with restricted privileges. |
| **Application Role (`ledgerline_app`)** | `SELECT, INSERT, UPDATE` on users, accounts, transactions; `SELECT, INSERT` on ledger | Cannot alter historical ledger entries even if code execution occurs. | Enforce `REVOKE UPDATE, DELETE, TRUNCATE ON ledger_entries, audit_logs FROM ledgerline_app;`. |

---

## 4. Residual Risks & Operational Limitations

1. **Database Owner/Superuser Integrity**:
   Database triggers enforce immutability within PostgreSQL, but a database owner or superuser can alter constraints or triggers. Production should use a least-privilege application role and protected backups.
2. **Idempotency Key Table Growth**:
   The active service does not expire or delete keys. Records remain unique indefinitely, so a carefully designed retention/cleanup policy is still required before long-term production use.
3. **Rate-limit scope**:
   The current in-memory limits reset on process restart and are not shared across instances. A shared rate-limit store is needed when running multiple backend instances.
4. **Seed account history**:
   The seed guard prevents creating demo users via the seed script in production, but does not rotate or disable demo credentials already present in an existing database. Do not promote a development database to production.
