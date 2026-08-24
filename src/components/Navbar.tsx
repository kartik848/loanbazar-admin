import React from 'react';
import { Bell, Search, UserCircle } from 'lucide-react';

interface NavbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  pendingCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ searchQuery, setSearchQuery, pendingCount }) => {
  return (
    <header
      style={{
        height: '64px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ position: 'relative', width: '320px' }}>
        <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '10px' }} />
        <input
          type="text"
          placeholder="Search by applicant name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ position: 'relative', cursor: 'pointer' }}>
          <Bell size={20} color="#64748B" />
          {pendingCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                fontSize: '10px',
                fontWeight: 700,
                borderRadius: '9999px',
                padding: '1px 5px',
              }}
            >
              {pendingCount}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserCircle size={32} color="#475569" />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Kartik Kale</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>Chief Credit Officer</div>
          </div>
        </div>
      </div>
    </header>
  );
};
