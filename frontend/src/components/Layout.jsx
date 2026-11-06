import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { systemService } from '../services/api';
import { Menu, Activity, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await systemService.getHealth();
        setSystemHealth(res.data.status === 'healthy');
      } catch {
        setSystemHealth(false);
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-shell">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Persistent Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="app-main-viewport">
        {/* Top Header */}
        <header className="app-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="mobile-menu-btn"
              aria-label="Toggle Navigation"
            >
              <Menu size={20} />
            </button>
            <div className="topbar-breadcrumb">
              <span style={{ color: '#6b7280' }}>LedgerLine</span>
              <span style={{ color: '#4b5563' }}>/</span>
              <span style={{ color: '#f3f4f6', fontWeight: 600, textTransform: 'capitalize' }}>
                {location.pathname.replace('/', '').replace(/-/g, ' ') || 'Dashboard'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Live System Health Badge */}
            <div className={`health-badge ${systemHealth === true ? 'health-ok' : systemHealth === false ? 'health-down' : 'health-probing'}`}>
              <div className="health-dot"></div>
              <span>{systemHealth === true ? 'System Healthy' : systemHealth === false ? 'DB Disconnected' : 'Checking...'}</span>
            </div>

            {/* Quick Profile preview */}
            {user && (
              <Link to="/profile" className="topbar-user-link">
                <span className="user-initial">{user.fullName?.[0]?.toUpperCase() || 'U'}</span>
                <span className="user-shortname">{user.fullName?.split(' ')[0]}</span>
              </Link>
            )}
          </div>
        </header>

        {/* Viewport page container */}
        <main className="app-content-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
