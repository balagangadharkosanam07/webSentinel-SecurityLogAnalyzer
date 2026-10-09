import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  glow?: 'cyan' | 'red' | 'amber' | 'none';
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  className = '',
  glow = 'none',
}) => {
  const glowClasses = {
    cyan: 'soc-glow-cyan border-cyan-500/30',
    red: 'soc-glow-red border-red-500/30',
    amber: 'soc-glow-amber border-amber-500/30',
    none: 'border-slate-800/80 hover:border-slate-700/80',
  }[glow];

  return (
    <div
      className={`bg-[#0d1527] border rounded-lg p-5 transition-all duration-200 ${glowClasses} ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-3">
          <div>
            {title && <h3 className="font-semibold text-slate-100 tracking-tight text-base">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
