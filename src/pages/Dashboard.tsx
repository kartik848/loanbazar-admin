import React, { useState } from 'react';
import type { LoanApplication, ApplicationStatus } from '../types/loan';
import { updateApplicationStatus } from '../services/firebase';
import { StatusBadge } from '../components/StatusBadge';
import { StatCard } from '../components/StatCard';
import { DocumentModal } from '../components/DocumentModal';
import { 
  FileText, 
  Clock, 
  Wallet, 
  Image as ImageIcon,
  Check,
  X,
  Send,
  CreditCard
} from 'lucide-react';

interface DashboardProps {
  applications: LoanApplication[];
  searchQuery: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ applications, searchQuery }) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; imageUrl?: string }>({
    isOpen: false,
    title: '',
  });

  // Calculate Metrics
  const totalApps = applications.length;
  const underReviewApps = applications.filter((a) => a.status === 'under_review').length;
  const autoPayRegisteredApps = applications.filter((a) => a.status === 'autopay_done').length;
  const totalDisbursed = applications
    .filter((a) => a.status === 'disbursed')
    .reduce((sum, a) => sum + (a.amount || 0), 0);

  // Filter applications
  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      (app.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.userPhone || '').includes(searchQuery) ||
      (app.razorpayPaymentId || '').includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (id: string, status: ApplicationStatus) => {
    try {
      await updateApplicationStatus(id, status);
    } catch (err) {
      alert('Error updating status: ' + err);
    }
  };

  const openDoc = (title: string, imageUrl?: string) => {
    if (!imageUrl) {
      alert('No document uploaded for this applicant.');
      return;
    }
    setModalState({ isOpen: true, title, imageUrl });
  };

  return (
    <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>
          Credit Operations & Loan Portfolio
        </h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748B' }}>
          Real-time underwriting, Razorpay AutoPay mandate verification, and instant disbursal.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <StatCard
          title="Total Applications"
          value={totalApps}
          subtitle="All received requests"
          icon={<FileText size={24} />}
          color="#3B82F6"
        />
        <StatCard
          title="Under Review"
          value={underReviewApps}
          subtitle="Action required"
          icon={<Clock size={24} />}
          color="#F59E0B"
        />
        <StatCard
          title="AutoPay Active"
          value={autoPayRegisteredApps}
          subtitle="Ready for Disbursal"
          icon={<CreditCard size={24} />}
          color="#10B981"
        />
        <StatCard
          title="Total Disbursed"
          value={`₹${totalDisbursed.toLocaleString('en-IN')}`}
          subtitle="Disbursed capital"
          icon={<Wallet size={24} />}
          color="#8B5CF6"
        />
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'under_review', label: 'Under Review' },
              { id: 'approved', label: 'Approved' },
              { id: 'autopay_done', label: 'AutoPay Registered' },
              { id: 'disbursed', label: 'Disbursed' },
              { id: 'rejected', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  backgroundColor: statusFilter === tab.id ? '#1E293B' : '#F1F5F9',
                  color: statusFilter === tab.id ? '#FFFFFF' : '#475569',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '13px', color: '#64748B' }}>
            Showing <b>{filteredApps.length}</b> applications
          </span>
        </div>

        {/* Applications Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Applicant</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Phone</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Loan Amount</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>EMI / Tenure</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Razorpay Mandate</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>KYC Documents</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                    No loan applications found matching this criteria.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <tr
                    key={app.id}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0F172A' }}>
                      {app.fullName || 'Unnamed Applicant'}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#475569' }}>{app.userPhone || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          textTransform: 'capitalize',
                          backgroundColor: '#F1F5F9',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        {app.employmentType || 'Salaried'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0F172A' }}>
                      ₹{app.amount ? Number(app.amount).toLocaleString('en-IN') : '0'}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#475569' }}>
                      ₹{app.monthlyEmi ? app.monthlyEmi.toFixed(2) : '0'}/mo
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>{app.tenureMonths || 6} Mos @ {app.interestRate || 14}%</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {app.razorpayPaymentId ? (
                        <code
                          style={{
                            backgroundColor: '#F1F5F9',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: '#1E293B',
                            fontWeight: 600,
                          }}
                        >
                          {app.razorpayPaymentId}
                        </code>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: '12px' }}>Not Registered</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => openDoc(`${app.fullName} - PAN Card`, app.panUrl)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            fontSize: '11px',
                            cursor: 'pointer',
                            color: app.panUrl ? '#2563EB' : '#94A3B8',
                          }}
                        >
                          <ImageIcon size={12} /> PAN
                        </button>
                        <button
                          onClick={() => openDoc(`${app.fullName} - Income Proof`, app.proofUrl)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            fontSize: '11px',
                            cursor: 'pointer',
                            color: app.proofUrl ? '#2563EB' : '#94A3B8',
                          }}
                        >
                          <ImageIcon size={12} /> Proof
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={app.status} />
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {app.status === 'under_review' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(app.id, 'approved')}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                backgroundColor: '#10B981',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button
                              onClick={() => handleStatusChange(app.id, 'rejected')}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                backgroundColor: '#EF4444',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <X size={14} /> Reject
                            </button>
                          </>
                        )}
                        {app.status === 'autopay_done' && (
                          <button
                            onClick={() => handleStatusChange(app.id, 'disbursed')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 14px',
                              backgroundColor: '#2563EB',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <Send size={14} /> Disburse Loan
                          </button>
                        )}
                        {app.status === 'disbursed' && (
                          <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>
                            ✓ Disbursed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Inspection Lightbox Modal */}
      <DocumentModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        imageUrl={modalState.imageUrl}
        onClose={() => setModalState({ isOpen: false, title: '' })}
      />
    </div>
  );
};
