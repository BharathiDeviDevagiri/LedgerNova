import React from 'react';

function formatCompactPaise(value) {
  const rupees = value / 100n;
  if (rupees >= 1_000_000n) return `${rupees / 1_000_000n}m`;
  if (rupees >= 1_000n) return `${rupees / 1_000n}k`;
  return rupees.toString();
}

export default function ActivityChart({ transactions = [] }) {
  // Aggregate transactions by date
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const dataMap = {};
  last7Days.forEach((day) => {
    dataMap[day] = { date: day, inflow: 0n, outflow: 0n };
  });

  transactions.forEach((tx) => {
    const day = (tx.createdAt || tx.date || '').split('T')[0];
    if (dataMap[day]) {
      const amountPaise = BigInt(tx.totalAmountPaise || tx.amountPaise || 0);
      const desc = (tx.description || tx.operation || '').toLowerCase();

      if (desc.includes('deposit')) {
        dataMap[day].inflow += amountPaise;
      } else if (desc.includes('withdraw')) {
        dataMap[day].outflow += amountPaise;
      } else {
        // Transfer
        dataMap[day].outflow += amountPaise;
      }
    }
  });

  const chartData = last7Days.map((day) => dataMap[day]);
  const maxVal = chartData.reduce(
    (max, day) => [
      max[0] > day.inflow ? max[0] : day.inflow,
      max[1] > day.outflow ? max[1] : day.outflow,
    ],
    [100_000n, 0n]
  ).reduce((max, value) => (value > max ? value : max), 0n);
  const plotRatio = (value) => Number((value * 1_000_000n) / maxVal) / 1_000_000;

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 30;
  const plotWidth = svgWidth - paddingX * 2;
  const plotHeight = svgHeight - paddingY * 2;

  const pointsInflow = chartData.map((d, index) => {
    const x = paddingX + (index / (chartData.length - 1)) * plotWidth;
    const y = svgHeight - paddingY - plotRatio(d.inflow) * plotHeight;
    return `${x},${y}`;
  }).join(' ');

  const pointsOutflow = chartData.map((d, index) => {
    const x = paddingX + (index / (chartData.length - 1)) * plotWidth;
    const y = svgHeight - paddingY - plotRatio(d.outflow) * plotHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="activity-chart-card">
      <div className="chart-header">
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f3f4f6' }}>Account Activity</h3>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>7-Day Inflow vs. Outflow (₹)</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></span>
            <span style={{ color: '#9ca3af' }}>Inflow (Credits)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></span>
            <span style={{ color: '#9ca3af' }}>Outflow (Debits)</span>
          </div>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', minWidth: '450px' }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = svgHeight - paddingY - ratio * plotHeight;
            const val = (maxVal * BigInt(Math.round(ratio * 100))) / 100n;
            return (
              <g key={i}>
                <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="#1f2937" strokeDasharray="4 4" />
                <text x={paddingX - 8} y={y + 4} fill="#6b7280" fontSize="10" textAnchor="end">
                  ₹{formatCompactPaise(val)}
                </text>
              </g>
            );
          })}

          {/* Lines */}
          <polyline fill="none" stroke="#10b981" strokeWidth="3" points={pointsInflow} strokeLinecap="round" strokeLinejoin="round" />
          <polyline fill="none" stroke="#ef4444" strokeWidth="3" points={pointsOutflow} strokeLinecap="round" strokeLinejoin="round" />

          {/* Dots and Labels */}
          {chartData.map((d, index) => {
            const x = paddingX + (index / (chartData.length - 1)) * plotWidth;
            const yIn = svgHeight - paddingY - plotRatio(d.inflow) * plotHeight;
            const yOut = svgHeight - paddingY - plotRatio(d.outflow) * plotHeight;
            const dayLabel = d.date.split('-').slice(1).join('/');

            return (
              <g key={index}>
                <circle cx={x} cy={yIn} r="4" fill="#10b981" />
                <circle cx={x} cy={yOut} r="4" fill="#ef4444" />
                <text x={x} y={svgHeight - 10} fill="#9ca3af" fontSize="11" textAnchor="middle">
                  {dayLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
