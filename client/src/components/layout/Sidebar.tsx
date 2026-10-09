import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  ShieldAlert,
  Flame,
  BarChart3,
  FileCheck2,
  Shield,
  Radio,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/logs', label: 'Log Explorer', icon: FileText, badge: '15' },
    { to: '/alerts', label: 'Threat Alerts', icon: ShieldAlert, alertBadge: '6', badgeColor: 'bg-red-500/20 text-red-400 border border-red-500/30' },
    { to: '/incidents', label: 'Incidents', icon: Flame, alertBadge: '3', badgeColor: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
    { to: '/analytics', label: 'Risk Analytics', icon: BarChart3 },
    { to: '/reports', label: 'Reports', icon: FileCheck2 },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-[#090f1d] border-r border-slate-800/80 transition-all duration-300 select-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 bg-[#070b14]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center flex-shrink-0 soc-glow-cyan">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sm text-slate-100 tracking-wider">
                WEB<span className="text-cyan-400 font-extrabold">SENTINEL</span>
              </span>
              <span className="text-[10px] text-cyan-500/80 font-mono tracking-widest uppercase">
                SOC Defense Core
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Live Sentinel status */}
      {!collapsed ? (
        <div className="mx-3 my-3 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-slate-300">ENGINE STATUS</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-500/30">
            ONLINE
          </span>
        </div>
      ) : (
        <div className="py-3 flex justify-center" title="Engine Online">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
        </div>
      )}

      {/* Nav Menu */}
      <nav className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-500/40 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition-colors ${
                      isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {!collapsed && item.alertBadge && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${item.badgeColor}`}
                    >
                      {item.alertBadge}
                    </span>
                  )}
                  {!collapsed && item.badge && !item.alertBadge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 bg-[#070b14] text-[11px] font-mono text-slate-400">
        {!collapsed ? (
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Platform</span>
              <span className="text-cyan-400 font-semibold">v0.1-Phase 1</span>
            </div>
            <div className="text-slate-400 text-[10px]">
              PERN Security Core
            </div>
          </div>
        ) : (
          <div className="text-center text-[10px] text-cyan-500 font-bold">
            v0.1
          </div>
        )}
      </div>
    </aside>
  );
};
