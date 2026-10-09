import React, { useState } from 'react';
import { portalApi } from '../services/api.js';
import {
  ShieldAlert,
  Zap,
  Terminal,
  ExternalLink,
  X,
  AlertTriangle,
  Lock,
  Search,
  Database,
  UserX,
} from 'lucide-react';

interface SecurityConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityConsoleModal: React.FC<SecurityConsoleModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  if (!isOpen) return null;

  const triggerAttack = async (
    type: 'sqli' | 'scanner' | 'bruteforce' | 'privilege' | 'tampering'
  ) => {
    setRunning(type);
    try {
      const result = await portalApi.simulateAttack(type);
      setLogs((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          ...result,
        },
        ...prev,
      ]);
    } catch (err: any) {
      setLogs((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          attack: type,
          error: err.message,
        },
        ...prev,
      ]);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">Live Threat Simulation Sandbox</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Target: Attendance Portal
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Trigger security anomalies against this app. WebSentinel intercepts and correlates them live into SOC Incidents.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Attack Action Tiles */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Select Attack Vector to Execute
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* 1. SQL Injection */}
              <button
                onClick={() => triggerAttack('sqli')}
                disabled={running !== null}
                className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-rose-500/50 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <Database className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-mono text-slate-400">RULE-006</span>
                </div>
                <h4 className="text-sm font-semibold text-white group-hover:text-rose-300">
                  SQL Injection Probe
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Injects <code className="text-rose-400 font-mono text-[10px]">' OR '1'='1</code> into course search query.
                </p>
              </button>

              {/* 2. Reconnaissance Scanner */}
              <button
                onClick={() => triggerAttack('scanner')}
                disabled={running !== null}
                className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <Search className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-mono text-slate-400">RULE-005</span>
                </div>
                <h4 className="text-sm font-semibold text-white group-hover:text-amber-300">
                  Reconnaissance Scanner
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Probes sensitive 404 endpoints (<code className="text-amber-300 font-mono text-[10px]">/.env</code>, config leaks).
                </p>
              </button>

              {/* 3. Brute Force Login */}
              <button
                onClick={() => triggerAttack('bruteforce')}
                disabled={running !== null}
                className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-orange-500/50 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <Lock className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-mono text-slate-400">RULE-001/002</span>
                </div>
                <h4 className="text-sm font-semibold text-white group-hover:text-orange-300">
                  Credential Stuffing Burst
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Executes 5 rapid failed authentication calls to <code className="text-orange-300 font-mono text-[10px]">/api/auth/login</code>.
                </p>
              </button>

              {/* 4. Privilege Escalation */}
              <button
                onClick={() => triggerAttack('privilege')}
                disabled={running !== null}
                className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <UserX className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-mono text-slate-400">RULE-003</span>
                </div>
                <h4 className="text-sm font-semibold text-white group-hover:text-purple-300">
                  Privilege Escalation
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Attempts to read restricted <code className="text-purple-300 font-mono text-[10px]">/api/admin/audit-logs</code> with 403 Forbidden.
                </p>
              </button>

              {/* 5. Attendance Tampering */}
              <button
                onClick={() => triggerAttack('tampering')}
                disabled={running !== null}
                className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-mono text-slate-400">RULE-004</span>
                </div>
                <h4 className="text-sm font-semibold text-white group-hover:text-blue-300">
                  Attendance Tampering Burst
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Submits bulk modifications to historic attendance records via <code className="text-blue-300 font-mono text-[10px]">/bulk-update</code>.
                </p>
              </button>
            </div>
          </div>

          {/* Execution Terminal Feed */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Attack Output &amp; Ingestion Telemetry
                </h3>
              </div>
              {logs.length > 0 && (
                <button
                  onClick={() => setLogs([])}
                  className="text-[11px] text-slate-400 hover:text-white"
                >
                  Clear Feed
                </button>
              )}
            </div>

            <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs max-h-56 overflow-y-auto space-y-2">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic py-4 text-center">
                  Click any attack vector above to dispatch live simulation requests...
                </div>
              ) : (
                logs.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-rose-400 font-bold flex items-center">
                        <Zap className="w-3 h-3 mr-1" />
                        {item.attack}
                      </span>
                      <span className="text-slate-500 text-[10px]">{item.timestamp}</span>
                    </div>
                    {item.target && (
                      <div className="text-slate-300">
                        Target:{' '}
                        <span className="text-amber-300">{item.target}</span> (HTTP{' '}
                        {item.status})
                      </div>
                    )}
                    {item.expectedRule && (
                      <div className="text-emerald-400">
                        Triggered Rule: <strong>{item.expectedRule}</strong>
                      </div>
                    )}
                    {item.attempts && (
                      <div className="text-slate-400">
                        Dispatched {item.attempts} attempts with statuses: [{item.statuses.join(', ')}]
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/70">
          <p className="text-xs text-slate-400 text-center sm:text-left">
            Logs stream asynchronously to <code className="text-emerald-400">WebSentinel Port 4000</code> with secret sanitization.
          </p>

          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all"
          >
            Inspect in WebSentinel SOC
            <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
