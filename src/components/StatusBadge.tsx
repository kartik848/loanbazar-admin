import React from 'react';
import type { ApplicationStatus } from '../types/loan';
import { Clock, CheckCircle2, ShieldCheck, Wallet, XCircle, CheckSquare } from 'lucide-react';

interface StatusBadgeProps {
  status: ApplicationStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const configs: Record<ApplicationStatus, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
    under_review: {
      label: 'Under Review',
      bg: '#FFFBEB',
      text: '#B45309',
      border: '#FDE68A',
      icon: <Clock size={13} />,
    },
    approved: {
      label: 'Approved (Waiting ₹1)',
      bg: '#FEF9C3',
      text: '#A16207',
      border: '#FDE047',
      icon: <CheckCircle2 size={13} />,
    },
    acceptance_submitted: {
      label: '⚡ ₹1 Submitted (Verify)',
      bg: '#FEF3C7',
      text: '#D97706',
      border: '#FDE68A',
      icon: <Clock size={13} />,
    },
    acceptance_done: {
      label: '₹1 Verified (Accepted)',
      bg: '#EFF6FF',
      text: '#1D4ED8',
      border: '#BFDBFE',
      icon: <ShieldCheck size={13} />,
    },
    autopay_done: {
      label: '₹1 Verified (Accepted)',
      bg: '#EFF6FF',
      text: '#1D4ED8',
      border: '#BFDBFE',
      icon: <ShieldCheck size={13} />,
    },
    disbursed: {
      label: 'Disbursed (Active)',
      bg: '#DCFCE7',
      text: '#15803D',
      border: '#86EFAC',
      icon: <Wallet size={13} />,
    },
    repaid: {
      label: 'Loan Repaid ✓',
      bg: '#ECFDF5',
      text: '#047857',
      border: '#6EE7B7',
      icon: <CheckSquare size={13} />,
    },
    rejected: {
      label: 'Rejected',
      bg: '#FEF2F2',
      text: '#B91C1C',
      border: '#FECACA',
      icon: <XCircle size={13} />,
    },
  };

  const config = configs[status] || configs.under_review;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
      }}
    >
      {config.icon}
      {config.label}
    </span>
  );
};
