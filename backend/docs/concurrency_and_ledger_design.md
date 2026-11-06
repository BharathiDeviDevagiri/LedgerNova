# LedgerLine Technical Architecture & Core Invariants Specification
> Snovasys Fresher Hiring Challenge 2026

---

## 1. Concurrency Control: PostgreSQL `SELECT FOR UPDATE` & Deadlock Elimination

### A. The Race Condition Problem (Lost Updates & Overdrafts)
When two concurrent requests attempt to debit the same account (e.g., account balance is ₹10,000, Request A withdraws ₹8,000 and Request B withdraws ₹8,000 simultaneously):
- If the application reads both balances concurrently before updating, both see ₹10,000.
- Both approve the withdrawal, resulting in an illegal negative balance (-₹6,000) and an invariant violation.

### B. The Deadlock Problem
When two transfers occur simultaneously between the same two accounts in opposite directions:
- **Transaction 1**: Transfer from Account A to Account B.
- **Transaction 2**: Transfer from Account B to Account A.
- If Transaction 1 locks Account A and waits for Account B, while Transaction 2 locks Account B and waits for Account A, PostgreSQL encounters a **Deadlock** (`40P01`), causing one transaction to abort.

### C. LedgerLine's Deterministic Row Locking Solution
LedgerLine resolves both race conditions and deadlocks using **Deterministic Lexicographical Row Locking**:
1. **Sort Account IDs**:
   ```javascript
   const [firstAccountId, secondAccountId] = [fromAccountId, toAccountId].sort();
   ```
2. **Sequential Lock Acquisition**:
   Within a PostgreSQL transaction, acquire row-level exclusive locks in this exact sorted order:
   ```sql
   SELECT * FROM "accounts" WHERE id = $1 FOR UPDATE;
   SELECT * FROM "accounts" WHERE id = $2 FOR UPDATE;
   ```
3. **Mathematical Proof of Deadlock Impossibility**:
   Because every transaction locks accounts in the identical global order (e.g. `min(A, B)` then `max(A, B)`), a cycle of wait dependencies ($A \to B$ and $B \to A$) cannot form.
4. **Post-Lock Balance Verification**:
   Balance is verified **only after** both row locks are acquired. This guarantees reading the authoritative locked balance and eliminates Time-of-Check to Time-of-Use (TOCTOU) anomalies.

---

## 2. Double-Entry Accounting Invariant & Mathematical Equations

### A. The Fundamental Balancing Invariant
For every posted transaction $T$:
$$\sum_{i \in T} \text{Debit}_i = \sum_{j \in T} \text{Credit}_j \quad \text{where } \sum \text{Debit} > 0$$
- A transaction must have at least one DEBIT entry and at least one CREDIT entry ($\text{entry\_count} \ge 2$).
- Zero-entry transactions are strictly forbidden.
- No single-legged or unbalanced entries are ever permitted.

### B. Precise Balance Equations for Account Types
In financial accounting, accounts fall into 5 fundamental categories satisfying the Accounting Equation ($\text{Assets} = \text{Liabilities} + \text{Equity}$):

| Account Type | Normal Balance | Balance Calculation Formula | Debit Effect | Credit Effect | Examples in Banking |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **ASSET** | **Debit** | $\text{Balance} = \sum \text{Debits} - \sum \text{Credits}$ | **Increases** | **Decreases** | Central Reserve, Vault Cash, Settlement Receivables |
| **LIABILITY** | **Credit** | $\text{Balance} = \sum \text{Credits} - \sum \text{Debits}$ | **Decreases** | **Increases** | Customer Savings Deposits, Checking Accounts, Wallet Balances |
| **EQUITY** | **Credit** | $\text{Balance} = \sum \text{Credits} - \sum \text{Debits}$ | **Decreases** | **Increases** | Share Capital, Retained Earnings |
| **REVENUE** | **Credit** | $\text{Balance} = \sum \text{Credits} - \sum \text{Debits}$ | **Decreases** | **Increases** | Transaction Processing Fees, Interchange Fees, Interest Earned |
| **EXPENSE** | **Debit** | $\text{Balance} = \sum \text{Debits} - \sum \text{Credits}$ | **Increases** | **Decreases** | Server Infrastructure, SMS Gateway Fees, Interest Paid |

> [!IMPORTANT]
> In retail banking, customer accounts are **Liabilities** for the bank because the bank owes the money back to the customer. When a customer deposits money, their account is **CREDITED** (increasing the customer's balance). When a customer transfers out or withdraws money, their account is **DEBITED** (decreasing the customer's balance).

### C. Mathematical Proof of Money Conservation Across Transfers
For the implemented no-fee transfer of $X$ paise from Customer Account A to Customer Account B:
- Customer Account A (Liability): DEBIT $X$ paise $\implies \Delta \text{Balance}_A = -X$
- Customer Account B (Liability): CREDIT $X$ paise $\implies \Delta \text{Balance}_B = +X$

**Net Change in System Wealth:**
$$\Delta \text{Total} = \Delta \text{Balance}_A + \Delta \text{Balance}_B = -X + X = 0 \text{ paise}$$
Total money in the system is strictly invariant down to the integer paise.

Platform fees and fee-account postings are not implemented.

### D. PostgreSQL Dual Deferred Constraint Triggers
PostgreSQL validates the double-entry invariant using two deferred constraint triggers (`backend/prisma/sql/invariants_and_triggers.sql`):
1. **Trigger on `ledger_entries`**: Evaluates when ledger entries are inserted.
2. **Trigger on `transactions`**: Evaluates when a transaction is inserted or updated to status `POSTED`.
- Both triggers execute at SQL `COMMIT` time (`DEFERRABLE INITIALLY DEFERRED`).
- They invoke `validate_posted_transaction_balance(p_transaction_id)`, which asserts:
  - $\text{entry\_count} \ge 2$ (rejects 0-entry transactions).
  - $\text{debit\_count} \ge 1$ and $\text{credit\_count} \ge 1$.
  - $\sum \text{Debits} > 0$ and $\sum \text{Credits} > 0$.
  - $\sum \text{Debits} == \sum \text{Credits}$.
- Any violation causes PostgreSQL to raise an exception and **roll back the entire database transaction completely**.

---

## 3. Idempotency Architecture, Coordination & Crash Recovery

### A. Guarantees and Limitations (The "Exactly-Once" Reality)
In distributed systems, true end-to-end "exactly-once execution" across an unreliable network is theoretically impossible (Two Generals' Problem). What LedgerLine provides is **Effectively-Once Processing** via:
1. **Client retry**: Financial forms persist a pending key in `sessionStorage` and reuse it for the same payload after a network failure or timeout.
2. **Database-level coordination**: `runIdempotent()` takes a PostgreSQL transaction-scoped advisory lock derived from `(userId, key, requestPath)`.
3. **Atomic result**: The idempotency record, financial changes, audit log and saved response are committed in the same Prisma interactive transaction. An unexpected error rolls all of them back.
4. **Replay**: A retry with the same key and payload returns the saved result; a different payload returns HTTP 409.

**Limitations**:
- If the client times out and never retries, the transaction may have completed successfully on the server.
- `expiresAt` is set to 24 hours but the active service does not check it or prune records. The unique key therefore remains reserved indefinitely; database growth and key reuse are not currently managed.

### B. PostgreSQL Coordination for Concurrent Identical Requests
An identical concurrent request waits for the transaction-scoped advisory lock. The first request commits its terminal idempotency record and financial posting atomically; the waiting request then reads and replays that record. If the first transaction aborts, its uncommitted `PENDING` record and financial changes are rolled back, and the waiting request can perform the operation.

The active service does not poll, reclaim stale locks, or commit a visible `PENDING` record outside the financial transaction. The similarly named middleware in `src/middleware/idempotency.js` is deprecated and is not mounted by the routes.

The interactive transaction allows up to 10 seconds to acquire a connection and 15 seconds to complete. A longer wait fails rather than executing without the lock.

---

## 4. Handling Failed Transactions & Security Audit Logs

### A. Financial Invariant on Failed Transactions
- A rejected transaction (e.g., insufficient funds, frozen account, or permission failure) must **never produce any financial ledger entries**.
- Account balances must remain untouched.

### B. Two-Phase Audit Logging & Idempotency Recording
To capture refused attempts in the audit trail without risking partial financial postings:

```
+-----------------------------------------------------------------------------------+
|                        Client Request (Withdrawal / Transfer)                     |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 1. Acquire Account Locks (SELECT ... FOR UPDATE in Lexicographical Order)         |
+-----------------------------------------------------------------------------------+
                                          |
                        +-----------------+-----------------+
                        | Available Balance >= AmountPaise? |
                        +-----------------+-----------------+
                               /                     \
                             YES                      NO
                             /                         \
                            v                           v
+-----------------------------------------+   +-------------------------------------+
| 2A. COMMIT SUCCESSFUL TRANSACTION       |   | 2B. REFUSED TRANSACTION (NO LEDGER) |
| - Update Account balances               |   | - ZERO LedgerEntry records created  |
| - Create balanced LedgerEntry records   |   | - Balances remain untouched         |
| - Create Transaction (POSTED)           |   | - Create AuditLog:                  |
| - Create AuditLog (TRANSACTION_POSTED)  |   |   action: "TRANSACTION_REJECTED"    |
| - Mark IdempotencyKey: COMPLETED (201)  |   |   reason: "INSUFFICIENT_FUNDS"      |
+-----------------------------------------+   | - Mark IdempotencyKey: FAILED (400) |
                                              +-------------------------------------+
```

- **Business Logic Rejections (Controlled Failures)**:
  - Account balances are not changed.
  - Zero ledger entries are written.
  - The security `AuditLog` entry and the `IdempotencyKey` (marked `FAILED` with HTTP 400 response body) are committed.
  - Client receives HTTP 400 Bad Request.
- **System Crashes / Trigger Violations (Uncontrolled Failures)**:
  - PostgreSQL rolls back the entire transaction.
  - An independent application error-handler logs the failure to system logs and writes a standalone audit record in a fresh database connection.

---

## 5. Ledger Immutability & Defense-in-Depth Permissions

### A. Database Trigger Verification
- Triggers `trg_immutable_ledger_entries` and `trg_immutable_audit_logs` execute `BEFORE UPDATE OR DELETE` and unconditionally call `RAISE EXCEPTION`.
- Any application query attempting an `UPDATE` or `DELETE` on these tables is terminated immediately by PostgreSQL.

### B. Trigger Limitations Against Superusers
- Triggers execute within the database engine but **can be bypassed** by a database superuser (`postgres`) or table owner:
  - `ALTER TABLE ledger_entries DISABLE TRIGGER ALL;`
  - `SET session_replication_role = replica;` (disables all user triggers during the session)
  - Dropping the triggers or directly altering the database catalog.

### C. Recommended Least-Privilege Application Role (`ledgerline_app`)
To enforce immutable security in production, the application must **never connect as `postgres`**. A dedicated database user must be configured with explicit privilege revocation:

```sql
-- 1. Create dedicated application role
CREATE USER ledgerline_app WITH PASSWORD 'production_secure_vault_pass';
GRANT CONNECT ON DATABASE ledgerline TO ledgerline_app;
GRANT USAGE ON SCHEMA public TO ledgerline_app;

-- 2. Grant CRUD where necessary
GRANT SELECT, INSERT, UPDATE ON "users", "accounts", "account_permissions",
                                "transactions", "idempotency_keys" TO ledgerline_app;

-- 3. Grant STRICTLY APPEND-ONLY privileges on financial ledger and audit logs
GRANT SELECT, INSERT ON "ledger_entries", "audit_logs" TO ledgerline_app;

-- 4. Explicitly revoke destructive privileges
REVOKE UPDATE, DELETE, TRUNCATE ON "ledger_entries", "audit_logs" FROM ledgerline_app;
```

This defense-in-depth model ensures that even if an attacker achieved SQL injection or code execution within the Node.js application, the PostgreSQL engine itself would reject any attempt to alter or delete ledger entries.
