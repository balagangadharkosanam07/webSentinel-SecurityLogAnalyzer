import React from 'react';
import { AlertStatus } from '../../types/alerts';
import { IncidentStatus } from '../../types/incidents';

type StatusType = AlertStatus | IncidentStatus;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { bg: string; text: string; border: string; label: string }> = {
  open: {
    bg: 'bg-red-950/30',
    text: 'text-red-300',
    border: 'border-red-600/40',
    label: 'Open',
  },
  investigating: {
    bg: 'bg-amber-950/30',
    text: 'text-amber-300',
    border: 'border-amber-600/40',
    label: 'Investigating',
  },
  mitigated: {
    bg: 'bg-blue-950/30',
    text: 'text-blue-300',
    border: 'border-blue-600/40',
    label: 'Mitigated',
  },
  resolved: {
    bg: 'bg-emerald-950/30',
    text: 'text-emerald-300',
    border: 'border-emerald-600/40',
    label: 'Resolved',
  },
  closed: {
    bg: 'bg-slate-800/40',
    text: 'text-slate-400',
    border: 'border-slate-700/50',
    label: 'Closed',
  },
  false_positive: {
    bg: 'bg-purple-950/30',
    text: 'text-purple-300',
    border: 'border-purple-600/40',
    label: 'False Positive',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const config = statusConfig[status] || statusConfig.open;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      {config.label}
    </span>
  );
};
