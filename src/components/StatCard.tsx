import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color }) => {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748B', fontWeight: 500 }}>{title}</p>
        <h3 style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>{value}</h3>
        {subtitle && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>{subtitle}</p>}
      </div>
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '10px',
          backgroundColor: `${color}15`,
          color: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
    </div>
  );
};
