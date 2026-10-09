import React from 'react';
import { User } from '../types/index.js';
import { GraduationCap, Shield, LogOut, ExternalLink, Zap, UserCheck, BookOpen, Users } from 'lucide-react';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  onOpenSecurityConsole: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  onOpenSecurityConsole,
  activeTab,
  setActiveTab,
}) => {
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'teacher':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">EduTrack</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  Target App
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">Port 3001 | Protected by WebSentinel</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {user.role === 'student' && (
              <button
                onClick={() => setActiveTab('attendance')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                  activeTab === 'attendance'
                    ? 'bg-emerald-50 text-emerald-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>My Attendance</span>
              </button>
            )}

            {user.role === 'teacher' && (
              <button
                onClick={() => setActiveTab('roster')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                  activeTab === 'roster'
                    ? 'bg-emerald-50 text-emerald-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Class Roster</span>
              </button>
            )}

            {user.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                  activeTab === 'admin'
                    ? 'bg-emerald-50 text-emerald-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Admin Console</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('courses')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                activeTab === 'courses'
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Courses Catalog</span>
            </button>
          </nav>

          {/* Action buttons & User profile */}
          <div className="flex items-center space-x-3">
            {/* Attack Simulation Launcher */}
            <button
              onClick={onOpenSecurityConsole}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all shadow-sm"
              title="Launch SOC Attack Simulation"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5 text-rose-600 animate-pulse" />
              Security Sandbox
            </button>

            {/* Jump to WebSentinel SOC */}
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Shield className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              WebSentinel SOC
              <ExternalLink className="w-3 h-3 ml-1 text-slate-400" />
            </a>

            {/* User Info & Role Pill */}
            <div className="hidden sm:flex items-center pl-3 border-l border-slate-200 space-x-2">
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-900 leading-tight">{user.name}</p>
                <span
                  className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${getRoleBadge(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
