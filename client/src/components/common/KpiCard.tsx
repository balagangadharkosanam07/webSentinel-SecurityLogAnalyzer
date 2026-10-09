import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  subtext?: string;
  tone?: 'cyan' | 'red' | 'orange' | 'amber' | 'neutral';
}

const toneStyles = {
  cyan: {
    bg: 'bg-cyan-950/20',
    border: 'border-cyan-500/30',
    iconBg: 'bg-cyan-500/10 text-cyan-400',
    valColor: 'text-cyan-300',
  },
  red: {
    bg: 'bg-red-950/20',
    border: 'border-red-500/30',
    iconBg: 'bg-red-500/10 text-red-400',
    valColor: 'text-red-400',
  },
  orange: {
    bg: 'bg-orange-950/20',
    border: 'border-orange-500/30',
    iconBg: 'bg-orange-500/10 text-orange-400',
    valColor: 'text-orange-400',
  },
  amber: {
    bg: 'bg-amber-950/20',
    border: 'border-amber-500/30',
    iconBg: 'bg-amber-500/10 text-amber-400',
    valColor: 'text-amber-400',
  },
  neutral: {
    bg: 'bg-slate-900/60',
    border: 'border-slate-800',
    iconBg: 'bg-slate-800 text-slate-300',
    valColor: 'text-slate-100',
  },
};

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  subtext,
  tone = 'neutral',
}) => {
  const styles = toneStyles[tone];

  const changeColor = {
    positive: 'text-emerald-400',
    negative: 'text-rose-400',
    neutral: 'text-slate-400',
  }[changeType];

  return (
    <div
      className={`rounded-lg border p-4 transition-all duration-200 ${styles.bg} ${styles.border} flex flex-col justify-between`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold tracking-tight font-mono ${styles.valColor}`}>
              {value}
            </span>
            {change && (
              <span className={`text-xs font-semibold ${changeColor}`}>
                {change}
              </span>
            )}
          </div>
        </div>
        <div className={`p-2 rounded-lg ${styles.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {subtext && <p className="mt-2 text-[11px] text-slate-400 border-t border-slate-800/40 pt-2">{subtext}</p>}
    </div>
  );
};
