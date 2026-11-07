# LedgerNova – Digital Banking & Double-Entry Ledger System

LedgerNova is a full-stack digital banking and ledger management platform that supports secure account management, deposits, withdrawals, transfers, and double-entry financial transaction tracking.

The project demonstrates how financial transactions can be managed using authentication, role-based access control, database transactions, and audit logging.

## Project Overview

LedgerNova provides a platform where users can manage accounts and perform financial transactions while maintaining structured debit and credit records.

The application uses a React frontend, Node.js and Express backend, and PostgreSQL database to manage financial data.

## Features

### Authentication & Authorization
- User registration and login.
- JWT-based authentication.
- Role-based access control.
- Support for Admin, Account Holder, and Auditor roles.
- Protected API routes.

### Account Management
- Create and manage accounts.
- View account information.
- Track account balances.

### Financial Transactions
- Deposit money into accounts.
- Withdraw money from accounts.
- Transfer money between accounts.
- Maintain transaction records.
- Generate account statements.

### Ledger Management
- Double-entry bookkeeping with debit and credit records.
- Store monetary values using integer paise to avoid floating-point precision errors.
- Idempotency checks to help prevent duplicate transaction processing.
- PostgreSQL transactions and database locking for transaction consistency.
- Audit logging for important operations.

### Database Management
- PostgreSQL relational database.
- Prisma ORM.
- Database migrations.
- Database-level transaction constraints.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | JSON Web Tokens (JWT) |
| API | REST API |
| Testing | Node.js Test Runner |
| Deployment | Render |
| Version Control | Git and GitHub |

## Project Structure

```text
LedgerNova/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── utils/
│   ├── integration/
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Prerequisites

Install the following before running the application:

- Node.js (LTS version recommended).
- npm.
- Docker Desktop.
- Git.

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/BharathiDeviDevagiri/LedgerNova.git
```

Navigate into the project:

```bash
cd LedgerNova
```

### 2. Start the Database

Start the database service using Docker Compose:

```bash
docker compose up -d
```

### 3. Configure the Backend

Open a terminal:

```bash
cd backend
npm install
```

Create a `.env` file using `.env.example` as a reference.

Configure the required environment variables:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secure_random_secret
CORS_ORIGIN=http://localhost:5173
```

Do not commit your `.env` file or expose database credentials and JWT secrets.

### 4. Apply Database Migrations

Run:

```bash
npx prisma generate
npx prisma migrate deploy
```

### 5. Start the Backend

```bash
npm start
```

The backend API should be available at:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

### 6. Configure and Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create a `.env` file using the frontend `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

Open the application:

```text
http://localhost:5173
```

## Testing

The backend includes unit and integration tests.

Navigate to the backend directory:

```bash
cd backend
```

Run unit tests:

```bash
npm run test:unit
```

Run integration tests:

```bash
npm run test:integration
```

Run the complete test suite:

```bash
npm run test:all
```

The integration tests require a correctly configured test database.

## Deployment

The application is deployed using Render.

**Frontend:**  
https://ledgernova-frontend.onrender.com

**Backend API:**  
https://ledgernova.onrender.com

**Backend Health Check:**  
https://ledgernova.onrender.com/api/health

The frontend communicates with the backend through the configured `VITE_API_BASE_URL` environment variable.

The backend uses environment variables for database connectivity, authentication, and CORS configuration.

Note: The current deployment uses Render's free services. Free services may sleep after inactivity, and the free PostgreSQL database has an expiration period.

## Security and Reliability

LedgerNova implements several measures to improve transaction reliability and application security:

- JWT-based authentication.
- Role-based authorization.
- Input validation.
- Secure password handling.
- Helmet security middleware.
- CORS configuration.
- Idempotency checks.
- Database transactions and locking.
- Database-level constraints.
- Audit logging.

These measures improve application security and transaction consistency, but do not guarantee protection against every security threat.

## Current Limitations and Future Improvements

The following improvements are planned:

- Configure a dedicated least-privilege PostgreSQL application role.
- Improve transaction reversal validation.
- Implement cryptographic hash-chain verification for tamper-evident audit records.
- Introduce shared storage for rate limiting across multiple backend instances.
- Add additional end-to-end testing.
- Improve monitoring and production deployment reliability.

## Learning Outcomes

Through this project, I gained practical experience in:

- Full-stack application development.
- REST API development.
- Database design and PostgreSQL.
- Authentication and role-based authorization.
- Financial transaction processing.
- Double-entry bookkeeping concepts.
- Database transactions and concurrency handling.
- Unit and integration testing.
- Git, GitHub, and cloud deployment.

## Author

**Bharathi Devi Devagiri**

B.Tech – Artificial Intelligence and Data Science

GitHub: https://github.com/BharathiDeviDevagiri

LinkedIn: https://linkedin.com/in/bharathidevi-devagiri-116b08325

---

**LedgerNova – Secure Transactions. Reliable Records.**
