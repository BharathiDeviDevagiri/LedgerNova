import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import AccountDetailsPage from './pages/AccountDetailsPage';
import StatementPage from './pages/StatementPage';
import DepositPage from './pages/DepositPage';
import WithdrawPage from './pages/WithdrawPage';
import TransferPage from './pages/TransferPage';
import TransactionsPage from './pages/TransactionsPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AuditorDashboardPage from './pages/AuditorDashboardPage';
import NotFoundPage from './pages/NotFoundPage';

import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Application Routes inside Layout Shell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Default root redirects to dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="accounts/:accountId" element={<AccountDetailsPage />} />
            <Route path="accounts/:accountId/statement" element={<StatementPage />} />
            <Route path="accounts/:accountId/statements" element={<StatementPage />} />

            {/* Money Movement (Restricted for Auditor) */}
            <Route
              path="deposit"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'ACCOUNT_HOLDER']}>
                  <DepositPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="withdraw"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'ACCOUNT_HOLDER']}>
                  <WithdrawPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="transfer"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'ACCOUNT_HOLDER']}>
                  <TransferPage />
                </ProtectedRoute>
              }
            />

            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="transactions/:id" element={<TransactionsPage />} />
            <Route path="profile" element={<ProfilePage />} />

            {/* Admin Management (Strictly ADMIN) */}
            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Auditor Dashboard (ADMIN & AUDITOR) */}
            <Route
              path="auditor"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'AUDITOR']}>
                  <AuditorDashboardPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* 404 Not Found Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
