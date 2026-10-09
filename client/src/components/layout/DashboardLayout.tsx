import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { SyntheticBanner } from '../common/SyntheticBanner';

export const DashboardLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />

      {/* Topbar */}
      <Topbar sidebarCollapsed={sidebarCollapsed} />

      {/* Main Content Area */}
      <div
        className={`pt-16 transition-all duration-300 min-h-screen flex flex-col ${
          sidebarCollapsed ? 'pl-16' : 'pl-64'
        }`}
      >
        {/* Synthetic Data Disclaimer Banner */}
        <SyntheticBanner />

        {/* Dynamic Route Content */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/80 px-6 py-4 bg-[#090f1d] text-center text-xs text-slate-400 font-mono">
          WebSentinel &copy; 2026 &mdash; PERN Defensive Security Log &amp; Risk Platform &mdash; Phase 1 Dashboard Shell
        </footer>
      </div>
    </div>
  );
};
