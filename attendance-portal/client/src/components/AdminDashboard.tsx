import React, { useEffect, useState } from 'react';
import { portalApi, WEBSENTINEL_SOC_URL } from '../services/api.js';
import { User, AuditLogEvent } from '../types/index.js';
import { ShieldCheck, Users, Activity, RefreshCw, KeyRound, ExternalLink } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([
        portalApi.getAdminUsers().catch(() => []),
        portalApi.getAdminAuditLogs().catch(() => []),
      ]);
      setUsers(u || []);
      setAuditLogs(a || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Admin Hero */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-900 rounded-2xl p-6 text-white shadow-lg shadow-purple-900/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-purple-300 text-xs font-semibold uppercase tracking-wider">
              System Administration Console
            </span>
            <h1 className="text-2xl font-bold mt-1">RBAC & Security Telemetry Center</h1>
            <p className="text-purple-200 text-sm mt-1 max-w-xl">
              Inspect user privileges, review administrative audit trails, and verify security log ingestion into the WebSentinel SOC platform.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold backdrop-blur-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Feeds
            </button>
            <a
              href={WEBSENTINEL_SOC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-900 rounded-lg text-xs font-bold transition-all shadow-md"
            >
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              Open WebSentinel SOC
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
        </div>

        {/* Security Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-200">Registered Accounts</span>
              <Users className="w-4 h-4 text-purple-300" />
            </div>
            <p className="text-2xl font-bold mt-1">{users.length}</p>
            <span className="text-[10px] text-purple-200">Multi-tenant RBAC enforced</span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-200">Log Pipeline Mode</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl font-bold mt-1 text-emerald-300">Asynchronous HTTP</p>
            <span className="text-[10px] text-purple-200">Port 5000 -&gt; Port 4000</span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-200">Endpoint Protection</span>
              <KeyRound className="w-4 h-4 text-purple-300" />
            </div>
            <p className="text-xl font-bold mt-1 text-white">X-WebSentinel-Key</p>
            <span className="text-[10px] text-purple-200">Zero plain secrets policy</span>
          </div>
        </div>
      </div>

      {/* Grid: Users Directory & Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Directory */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">User Directory</h2>
            </div>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {users.length} Users
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {users.map((u) => (
              <div key={u.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-900">{u.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{u.email}</p>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-md uppercase border ${
                    u.role === 'admin'
                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                      : u.role === 'teacher'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Security Audit Feed */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Live Security Audit Feed</h2>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
              WebSentinel Sync
            </span>
          </div>

          <div className="p-4">
            <div className="bg-slate-900 text-slate-200 rounded-xl p-3.5 font-mono text-xs max-h-80 overflow-y-auto space-y-2">
              <div className="text-emerald-400 font-semibold">
                [CONNECTED] WebSentinel Ingestion Relay: Port 4000
              </div>
              <div className="text-slate-400">
                Logging target: http://localhost:4000/api/logs/import
              </div>
              <div className="text-slate-400">
                Classification: RFC-2026-WS Structured Security Schema
              </div>
              <div className="text-slate-400">
                Sanitizer: Deep recursive redaction of credentials &amp; auth tokens
              </div>
              <div className="pt-2 border-t border-slate-800">
                <span className="text-amber-400 font-semibold">Recent Monitored Events:</span>
                {auditLogs.length === 0 ? (
                  <p className="text-slate-500 mt-1 italic">
                    Streaming active. Trigger operations to view live ingestion.
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {auditLogs.slice(0, 8).map((evt, idx) => (
                      <div key={idx} className="text-[11px] text-slate-300">
                        <span className="text-emerald-400">[{evt.timestamp.slice(11, 19)}]</span>{' '}
                        <span className="text-blue-300 font-bold">{evt.eventType}</span>{' '}
                        <span className="text-slate-400">{evt.endpoint}</span> ({evt.statusCode})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
