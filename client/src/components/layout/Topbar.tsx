import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, User, Search, Bell } from 'lucide-react';

interface TopbarProps {
  sidebarCollapsed: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ sidebarCollapsed }) => {
  const [timeUtc, setTimeUtc] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeUtc(now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className={`h-16 fixed top-0 right-0 z-20 bg-[#090f1d]/95 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'left-16' : 'left-64'
      }`}
    >
      {/* Left: Quick search / target application context */}
      <div className="flex items-center gap-4">
        <div className="relative w-64 md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search IP, endpoint, event type, rule... (Ctrl+K)"
            className="w-full bg-[#070b14] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
            readOnly
            onClick={() => {
              const el = document.getElementById('log-search-input');
              if (el) el.focus();
            }}
          />
        </div>

        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs">
          <span className="text-slate-400">Target App:</span>
          <span className="font-mono text-cyan-300 font-medium">attendance-portal</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
        </div>
      </div>

      {/* Right: SOC UTC Clock & Analyst Profile */}
      <div className="flex items-center gap-4">
        {/* UTC Clock */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#070b14] border border-slate-800 text-xs font-mono text-cyan-400">
          <Clock className="w-3.5 h-3.5 text-cyan-500" />
          <span>{timeUtc}</span>
        </div>

        {/* Ingestion status */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>LOG PIPELINE ACTIVE</span>
        </div>

        {/* Notifications preview */}
        <div className="relative">
          <button className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        </div>

        {/* User / Analyst Profile */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-mono text-xs font-bold">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-200 leading-tight">Analyst Balu</span>
            <span className="text-[10px] font-mono text-slate-400 leading-tight">SOC-L2 Incident Lead</span>
          </div>
        </div>
      </div>
    </header>
  );
};
