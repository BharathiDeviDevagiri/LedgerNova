# LedgerNova - Core Double-Entry Banking & Ledger Platform
> Snovasys Fresher Hiring Challenge 2026

LedgerNova is a secure, double-entry financial ledger and banking management platform built with **React**, **Node.js/Express**, **PostgreSQL**, and **Prisma**.

---

## ðŸ›ï¸ Architectural Core Principles

1. **Strict Double-Entry Accounting**:
   - Every transaction contains at least two ledger entries.
   - Sum of debits must strictly equal the sum of credits ($\sum \text{Debits} = \sum \text{Credits}$).
   - No direct balance manipulation: balances are driven by immutable ledger entries.

2. **Integer Paise Monetary Storage**:
   - All monetary values are stored as integers (`BigInt` in PostgreSQL / Prisma) in **paise** ($â‚¹1.00 = 100 \text{ paise}$).
   - Eliminates floating-point rounding errors ($0.1 + 0.2 \neq 0.3$).

3. **Account-Level Authorization & Role-Based Access**:
   - **ADMIN**: System administration, user onboarding, global audits, account creation.
   - **ACCOUNT_HOLDER**: Scoped strictly to accounts granted via `AccountPermission` (`OWNER`, `MANAGER`, `VIEWER`).
   - **AUDITOR**: Read-only access to assigned accounts and transaction details, plus system-wide audit-log access.

4. **Concurrency Safety & Idempotency**:
   - **Pessimistic Concurrency Control**: PostgreSQL account-row locks are acquired in deterministic ID order before balances are checked or updated. The account `version` is incremented but is not used as an optimistic concurrency check.
   - **Idempotency Keys**: Request deduplication table to eliminate double-spend risks during network retries.
   - **Append-Only Ledger**: Transactions and ledger entries are append-only and immutable.
   - **Audit Trail**: Every administrative and state-changing action is captured in `AuditLog`.

---

## ðŸ“ Repository Structure

```
LedgerNova/
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ prisma/
â”‚   â”‚   â””â”€â”€ schema.prisma         # PostgreSQL schema (Users, Accounts, Ledger, etc.)
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ config/
â”‚   â”‚   â”‚   â””â”€â”€ prisma.js         # Prisma client instance + BigInt JSON serializer
â”‚   â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â”‚   â”œâ”€â”€ accountAuth.js    # Account-level permission check middleware
â”‚   â”‚   â”‚   â””â”€â”€ errorHandler.js   # Centralized HTTP error handling
â”‚   â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â”‚   â””â”€â”€ health.routes.js  # Database & server health probe
â”‚   â”‚   â”œâ”€â”€ app.js                # Express app configuration & middleware
â”‚   â”‚   â””â”€â”€ server.js             # HTTP server entrypoint
â”‚   â”œâ”€â”€ .env                      # Backend local environment config
â”‚   â”œâ”€â”€ .env.example              # Sample environment template
â”‚   â”œâ”€â”€ .gitignore
â”‚   â””â”€â”€ package.json              # Node.js backend dependencies & scripts
â”œâ”€â”€ frontend/
â”‚   â”œâ”€â”€ public/
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ App.jsx               # Initial LedgerLine overview dashboard
â”‚   â”‚   â”œâ”€â”€ App.css
â”‚   â”‚   â”œâ”€â”€ index.css             # Theme styling
â”‚   â”‚   â””â”€â”€ main.jsx              # React DOM entry point
â”‚   â”œâ”€â”€ index.html
â”‚   â”œâ”€â”€ vite.config.js            # Vite config with /api proxy to backend
â”‚   â”œâ”€â”€ .env.example
â”‚   â”œâ”€â”€ .gitignore
â”‚   â””â”€â”€ package.json              # Frontend dependencies
â”œâ”€â”€ docker-compose.yml            # PostgreSQL 16 container definition
â””â”€â”€ README.md
```

---

## ðŸš€ Setup & Execution Guide (PowerShell)

### Step 1: Start PostgreSQL via Docker Compose
In your root `LedgerNova` directory:
```powershell
docker compose up -d
```
Verify the container is healthy:
```powershell
docker compose ps
```

### Step 2: Set Up Backend & Run Prisma Migrations
Open a new PowerShell terminal:
```powershell
cd backend
npm install
npx prisma migrate dev --name init_ledgernova_schema
npx prisma generate
npm run dev
```
Backend will be live at: `http://localhost:5000`
Health endpoint: `http://localhost:5000/api/health`

To create local demo users, set unique values for `LEDGERNOVA_SEED_HOLDER_PASSWORD`,
`LEDGERNOVA_SEED_ADMIN_PASSWORD`, and `LEDGERNOVA_SEED_AUDITOR_PASSWORD` in
`backend/.env`, then run `npm run db:seed` from `backend`. Use passwords of at
least 12 characters. The seed script will not print passwords and refuses to
run when `NODE_ENV=production`. Seeded user emails are
`demouser@ledgernova.internal`, `admin@ledgernova.internal`, and
`auditor@ledgernova.internal`; use the values you set to sign in. The script
does not rotate passwords for accounts that already exist.

### Step 3: Set Up & Run Frontend
Open another PowerShell terminal:
```powershell
cd frontend
npm install
npm run dev
```
Frontend will be live at: `http://localhost:5173`
