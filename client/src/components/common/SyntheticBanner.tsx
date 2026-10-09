import React from 'react';
import { Database, AlertTriangle } from 'lucide-react';

interface SyntheticBannerProps {
  message?: string;
  className?: string;
}

export const SyntheticBanner: React.FC<SyntheticBannerProps> = ({
  message = 'PHASE 1 SIMULATION DATASET: All displayed log events, detection alerts, IP telemetry, and risk scores are synthetic fixtures generated for interface prototyping.',
  className = '',
}) => {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 bg-cyan-950/20 border-b border-cyan-500/20 text-xs text-cyan-300/90 font-mono ${className}`}
    >
      <div className="flex items-center gap-1.5 flex-shrink-0 font-semibold uppercase tracking-wider text-cyan-400">
        <Database className="w-3.5 h-3.5 text-cyan-400" />
        <span>Synthetic Mock Data</span>
      </div>
      <span className="text-cyan-600">|</span>
      <div className="flex items-center gap-1.5 truncate">
        <AlertTriangle className="w-3 h-3 text-cyan-400 flex-shrink-0" />
        <span className="truncate">{message}</span>
      </div>
      <span className="ml-auto text-[10px] text-cyan-500/70 uppercase tracking-widest hidden sm:inline flex-shrink-0">
        Contract: RFC-2026-SYN
      </span>
    </div>
  );
};
