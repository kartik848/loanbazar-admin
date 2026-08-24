import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  CheckCircle2, 
  Wallet, 
  Users, 
  Settings, 
  Building2 
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'applications', label: 'All Applications', icon: <FileText size={18} /> },
    { id: 'approvals', label: 'Pending Approvals', icon: <CheckCircle2 size={18} /> },
    { id: 'disbursals', label: 'Disbursals', icon: <Wallet size={18} /> },
    { id: 'customers', label: 'Customers', icon: <Users size={18} /> },
    { id: 'settings', label: 'System Settings', icon: <Settings size={18} /> },
  ];

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: '#0F172A',
        color: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <div style={{ padding: '24px 20px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ backgroundColor: '#2563EB', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Building2 size={20} color="#FFFFFF" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>Loan Bazar</h2>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Admin Console v1.0</span>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isActive ? '#1E293B' : 'transparent',
                color: isActive ? '#38BDF8' : '#94A3B8',
                fontWeight: isActive ? 600 : 500,
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.15s ease',
              }}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '16px 20px', borderTop: '1px solid #1E293B', fontSize: '12px', color: '#64748B' }}>
        Connected to Firebase Firestore
      </div>
    </aside>
  );
};
