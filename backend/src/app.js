import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import accountRoutes from './routes/account.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import adminRoutes from './routes/admin.routes.js';
import auditRoutes from './routes/audit.routes.js';

import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(morgan('dev'));

app.use(express.json({ limit: '100kb' }));

app.use(
  express.urlencoded({
    extended: true,
    limit: '100kb',
  })
);

// Health check endpoint
app.use('/api', healthRoutes);

// Authentication routes
app.use('/api/auth', authRoutes);

// Account routes (both plural and singular mounts)
app.use('/api/accounts', accountRoutes);
app.use('/api/account', accountRoutes);

// Transaction routes (both plural and singular mounts)
app.use('/api/transactions', transactionRoutes);
app.use('/api/transaction', transactionRoutes);

// Admin dashboard routes
app.use('/api/admin', adminRoutes);

// Audit trail routes (accessible to ADMIN and AUDITOR)
app.use('/api/audit-logs', auditRoutes);
app.use('/api/audit', auditRoutes);

app.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'LedgerLine API - Double-Entry Accounting Platform',
    version: '1.0.0',
    health: '/api/health',
  });
});

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: 'API endpoint not found.',
  });
});

app.use(errorHandler);

export default app;
