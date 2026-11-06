import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  History,
  User,
  ShieldCheck,
  FileSearch,
  Scale,
  LogOut,
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  if (!user) return null;

  const role = user.role;

  return (
    <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon-small">
          <Scale size={20} />
        </div>
        <div>
          <div className="brand-name">LedgerLine</div>
          <div className="brand-tag">Core Banking Ledger</div>
        </div>
      </div>

      <div className="sidebar-user-pill">
        <div className="user-avatar-circle">
          {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div className="user-pill-name">{user.fullName}</div>
          <div className={`role-badge role-${role.toLowerCase()}`}>{role}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Account Holder Navigation */}
        {role === 'ACCOUNT_HOLDER' && (
          <>
            <div className="nav-section-title">BANKING</div>
            <NavLink to="/dashboard" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>

            <NavLink to="/accounts" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Wallet size={18} />
              <span>My Accounts</span>
            </NavLink>

            <div className="nav-section-title">MONEY MOVEMENT</div>
            <NavLink to="/deposit" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ArrowDownLeft size={18} />
              <span>Deposit Funds</span>
            </NavLink>

            <NavLink to="/withdraw" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ArrowUpRight size={18} />
              <span>Withdraw Funds</span>
            </NavLink>

            <NavLink to="/transfer" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ArrowLeftRight size={18} />
              <span>Transfer Funds</span>
            </NavLink>

            <div className="nav-section-title">RECORDS</div>
            <NavLink to="/transactions" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <History size={18} />
              <span>Transaction History</span>
            </NavLink>
          </>
        )}

        {/* Administrator Navigation */}
        {role === 'ADMIN' && (
          <>
            <div className="nav-section-title">ADMINISTRATION</div>
            <NavLink to="/admin" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ShieldCheck size={18} />
              <span>Admin Overview</span>
            </NavLink>

            <NavLink to="/accounts" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Wallet size={18} />
              <span>All Accounts</span>
            </NavLink>

            <NavLink to="/transactions" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <History size={18} />
              <span>Global Ledger Log</span>
            </NavLink>

            <NavLink to="/auditor" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <FileSearch size={18} />
              <span>System Audit Trail</span>
            </NavLink>
          </>
        )}

        {/* Auditor Navigation */}
        {role === 'AUDITOR' && (
          <>
            <div className="nav-section-title">REGULATORY AUDIT</div>
            <NavLink to="/auditor" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <FileSearch size={18} />
              <span>Auditor Dashboard</span>
            </NavLink>

            <NavLink to="/accounts" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Wallet size={18} />
              <span>Accounts Audit</span>
            </NavLink>

            <NavLink to="/transactions" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <History size={18} />
              <span>Assigned Transactions</span>
            </NavLink>
          </>
        )}

        <div className="nav-section-title">ACCOUNT</div>
        <NavLink to="/profile" onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <User size={18} />
          <span>Profile &amp; Security</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button onClick={logout} className="logout-btn">
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
