import React from 'react';
import type { ApplicationStatus } from '../types/loan';
import { Clock, CheckCircle2, ShieldCheck, Wallet, XCircle } from 'lucide-react';

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
      label: 'Approved',
      bg: '#ECFDF5',
      text: '#047857',
      border: '#A7F3D0',
      icon: <CheckCircle2 size={13} />,
    },
    autopay_done: {
      label: 'AutoPay Registered',
      bg: '#EFF6FF',
      text: '#1D4ED8',
      border: '#BFDBFE',
      icon: <ShieldCheck size={13} />,
    },
    disbursed: {
      label: 'Disbursed',
      bg: '#FAF5FF',
      text: '#7E22CE',
      border: '#E9D5FF',
      icon: <Wallet size={13} />,
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
