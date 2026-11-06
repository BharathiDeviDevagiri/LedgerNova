import React from 'react';

export default function StatCard({ title, value, subtext, icon: Icon, color = 'emerald' }) {
  const colorMap = {
    emerald: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.25)' },
    blue: { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.25)' },
    purple: { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.25)' },
    amber: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
  };

  const currentTheme = colorMap[color] || colorMap.emerald;

  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span className="stat-title">{title}</span>
          <div className="stat-value">{value}</div>
          {subtext && <div className="stat-subtext">{subtext}</div>}
        </div>
        {Icon && (
          <div
            className="stat-icon-wrapper"
            style={{
              background: currentTheme.bg,
              color: currentTheme.text,
              border: `1px solid ${currentTheme.border}`,
            }}
          >
            <Icon size={22} />
          </div>
        )}
      </div>
    </div>
  );
}
