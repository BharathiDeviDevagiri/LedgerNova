# LedgerLine - Development & Engineering Prompts Log
> Snovasys Fresher Hiring Challenge 2026

This document records the user instructions, architectural requirements, and development prompts executed during the development of LedgerLine.

---

### Interaction 1: Initial System Validation & Project Scaffold
* **User Directive**: Initialize the core project structure for LedgerLine using React, Vite, Node.js, Express, PostgreSQL, and Prisma.
* **Scope**:
  - Establish frontend and backend directories.
  - Configure PostgreSQL 16 container via Docker Compose.
  - Define initial Prisma schema for users, accounts, account permissions, transactions, ledger entries, idempotency keys, and audit logs.
  - Implement integer paise monetary conventions and double-entry foundations.
* **Outcome**: Established project layout, `docker-compose.yml`, `schema.prisma`, Express application skeleton, and initial Vite React dashboard.

---

### Interaction 2: Architectural Audit & Invariant Hardening
* **User Directive**: Audit and correct database schema, double-entry triggers, concurrency, idempotency, security, and test readiness before running migrations.
* **Key Technical Revisions**:
  - Added `actorId` initiator relation to `Transaction` and `User`.
  - Added PostgreSQL DDL triggers for deferred double-entry balancing (`Sum(Debits) == Sum(Credits)`) and append-only table immutability.
  - Scoped idempotency keys to `(userId, key, requestPath)` with SHA-256 request payload hashing.
  - Formalized deterministic row locking (`SELECT FOR UPDATE` in sorted order) to eliminate race conditions and deadlocks.
  - Formulated normal balance formulas for all 5 account types and proved money conservation across transfers.

---

### Interaction 3: Idempotency Coordination & Complete Trigger Verification
* **User Directive**: Upgrade idempotency design to wait on concurrent requests rather than returning 409 immediately; fix deferred triggers to reject 0-entry transactions; handle failed transactions; and document superuser privilege risks.
* **Key Technical Revisions**:
  - Rebuilt idempotency middleware with PostgreSQL-backed polling coordination loop and 30-second stale lock takeover for crash recovery.
  - Upgraded trigger validation function to assert $\text{entry\_count} \ge 2$, at least one debit and credit, positive amounts, and dual deferred triggers on both `transactions` and `ledger_entries`.
  - Documented two-phase audit logging pattern (refused attempts recorded without creating partial financial entries).
  - Defined least-privilege `ledgerline_app` role guidelines.

---

### Interaction 4: Full-Stack Project Completion
* **User Directive**: Inspect entire codebase, resolve statement API routing error, complete account statements with pagination, complete all 14 required frontend pages, build comprehensive test suite, create master startup script, and prepare challenge submission.
* **Key Technical Revisions**:
  - Investigated and resolved `/api/accounts/:accountId/statement` routing, added missing `GET /api/accounts/:accountId` endpoint, and enhanced `statement.service.js` with database counts and bounded pagination.
  - Added missing transaction history endpoints (`GET /api/transactions`, `GET /api/transactions/:id`).
  - Added executive Admin endpoints (`/api/admin/metrics`, `/api/admin/users`) and regulatory Auditor endpoints (`/api/audit-logs`).
  - Created complete 14-page React banking application with authentication, accounts, statements, deposits, withdrawals, transfers, transaction history, admin/auditor views, and confirmation modals.
  - Implemented automated Node.js test suite (`backend/test/`).
  - Created `start-ledgerline.ps1` master startup script.

---

*Note: All git commit hashes and external deployment links are marked as pending user repository initialization and deployment authorization.*
