# LedgerLine Integration Test Suite Specifications
> Snovasys Fresher Hiring Challenge 2026

This document defines the formal integration test suite specifications covering concurrency, money conservation, idempotency, and authorization boundaries.

---

### Test Suite 1: Concurrent Withdrawals (Race Condition Stress Test)
- **Objective**: Verify that multiple simultaneous debit attempts on a shared balance cannot cause double-spending or negative balances.
- **Initial Setup**: Account A with a balance of ₹10,000 (1,000,000 paise).
- **Execution**: Spawn 10 simultaneous asynchronous HTTP POST requests attempting to withdraw ₹10,000 each using `Promise.all()`.
- **Expected Outcome**:
  - Exactly **1 request** receives HTTP 201 / Success.
  - Exactly **9 requests** fail with HTTP 400 / Insufficient Funds.
  - Final Account A balance must equal **0 paise** (₹0.00).
  - Exactly 1 DEBIT ledger entry and 1 CREDIT ledger entry are created.

---

### Test Suite 2: Duplicate Transfer Requests (Idempotency Test)
- **Objective**: Verify that identical requests with the same `Idempotency-Key` return identical results without duplicating ledger entries.
- **Initial Setup**: Account A (₹50,000) and Account B (₹10,000).
- **Execution**:
  1. Send Transfer Request 1: `Idempotency-Key: uuid-alpha`, amount: ₹5,000 (500,000 paise).
  2. Send Transfer Request 2: identical `Idempotency-Key: uuid-alpha`, identical body.
- **Expected Outcome**:
  - Request 1 returns HTTP 201 with `transactionId`.
  - Request 2 returns HTTP 201 with identical `transactionId` and header `Idempotent-Replay: true`.
  - Exactly 1 transaction record exists in the database.
  - Account A balance is ₹45,000; Account B balance is ₹15,000.
  - Sending Request 3 with `Idempotency-Key: uuid-alpha` but different amount (e.g. ₹6,000) returns **HTTP 409 Conflict**.

---

### Test Suite 3: Money Conservation (Zero-Sum Invariant Test)
- **Objective**: Verify that the global system monetary total is strictly conserved across transfers.
- **Initial Setup**: 5 accounts initialized with ₹100,000 (10,000,000 paise) each. Total system wealth: ₹500,000.
- **Execution**: Execute 50 concurrent transfers in randomized directions between the 5 accounts.
- **Expected Outcome**:
  - For every transaction, $\sum \text{Debits} == \sum \text{Credits}$.
  - The sum of all account balances after all 50 transfers finish must strictly equal **₹500,000 (50,000,000 paise)**.
  - Difference = **0 paise**.

---

### Test Suite 4: Negative Balance Prevention
- **Objective**: Verify that an account cannot be overdrawn beyond available funds.
- **Initial Setup**: Account A with ₹2,000 (200,000 paise).
- **Execution**: Attempt to transfer ₹5,000 (500,000 paise).
- **Expected Outcome**:
  - Application layer catches insufficient funds and returns HTTP 400.
  - Database constraint `check_account_balance_non_negative` blocks any negative updates.
  - No transaction or ledger entry is persisted.

---

### Test Suite 5: Unauthorized Account Access & Role Restrictions
- **Objective**: Enforce account-level authorization boundaries.
- **Test 5A**: Account Holder 1 attempts to initiate a transfer from Account 2 (where they have no `AccountPermission`).
  - *Expected*: **HTTP 403 Forbidden** (`Access denied: You do not have permission to access this account`).
- **Test 5B**: Auditor user attempts to issue an HTTP POST to transfer funds.
  - *Expected*: **HTTP 403 Forbidden** (`Auditors are strictly restricted to read-only access`).
- **Test 5C**: Frontend submits manipulated `userId` or `role` in the request body.
  - *Expected*: Server ignores body parameters and authenticates strictly via signed JWT.
