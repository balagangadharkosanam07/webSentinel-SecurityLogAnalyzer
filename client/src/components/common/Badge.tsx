import React from 'react';
import { AlertSeverity } from '../../types/alerts';

interface BadgeProps {
  severity: AlertSeverity;
  showDot?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

const severityConfig: Record<
  AlertSeverity,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  critical: {
    bg: 'bg-red-950/40',
    text: 'text-red-400',
    border: 'border-red-500/40',
    dot: 'bg-red-500',
    label: 'CRITICAL',
  },
  high: {
    bg: 'bg-orange-950/40',
    text: 'text-orange-400',
    border: 'border-orange-500/40',
    dot: 'bg-orange-500',
    label: 'HIGH',
  },
  medium: {
    bg: 'bg-amber-950/40',
    text: 'text-amber-400',
    border: 'border-amber-500/40',
    dot: 'bg-amber-500',
    label: 'MEDIUM',
  },
  low: {
    bg: 'bg-blue-950/40',
    text: 'text-blue-400',
    border: 'border-blue-500/40',
    dot: 'bg-blue-500',
    label: 'LOW',
  },
  info: {
    bg: 'bg-slate-800/50',
    text: 'text-slate-400',
    border: 'border-slate-700/60',
    dot: 'bg-slate-400',
    label: 'INFO',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  severity,
  showDot = true,
  className = '',
  size = 'md',
}) => {
  const config = severityConfig[severity] || severityConfig.info;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-mono tracking-wider uppercase transition-colors ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${config.dot} ${
            severity === 'critical' ? 'animate-pulse' : ''
          }`}
        />
      )}
      {config.label}
    </span>
  );
};
