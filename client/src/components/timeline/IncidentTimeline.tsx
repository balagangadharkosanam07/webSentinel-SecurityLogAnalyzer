import React from 'react';
import { Badge } from '../common/Badge';
import { AlertSeverity } from '../../types/alerts';
import { Clock, ShieldAlert, Key, Edit3, Search, Terminal, Crosshair } from 'lucide-react';

export interface TimelineItem {
  id: string;
  timestamp: string;
  phase?: string;
  title?: string;
  description?: string;
  method?: string;
  endpoint?: string;
  statusCode?: number;
  sourceIp: string;
  actorId?: string | null;
  actorRole?: string | null;
  severity?: AlertSeverity;
  eventType?: string;
}

interface IncidentTimelineProps {
  events: TimelineItem[];
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({ events }) => {
  const getEventIcon = (phase?: string, eventType?: string) => {
    const key = (phase || eventType || '').toLowerCase();
    if (key.includes('recon') || key.includes('probe')) {
      return <Search className="w-3.5 h-3.5 text-blue-400" />;
    }
    if (key.includes('credential') || key.includes('login') || key.includes('initial')) {
      return <Key className="w-3.5 h-3.5 text-cyan-400" />;
    }
    if (key.includes('tamper') || key.includes('attendance') || key.includes('impact')) {
      return <Edit3 className="w-3.5 h-3.5 text-amber-400" />;
    }
    if (key.includes('injection') || key.includes('execution') || key.includes('privilege')) {
      return <ShieldAlert className="w-3.5 h-3.5 text-red-400" />;
    }
    return <Terminal className="w-3.5 h-3.5 text-slate-400" />;
  };

  const getPhaseBadgeColor = (phase?: string) => {
    switch (phase) {
      case 'Reconnaissance':
        return 'text-blue-400 border-blue-500/40 bg-blue-950/40';
      case 'Credential Access':
        return 'text-amber-400 border-amber-500/40 bg-amber-950/40';
      case 'Initial Access':
        return 'text-cyan-400 border-cyan-500/40 bg-cyan-950/40';
      case 'Privilege Escalation':
        return 'text-purple-400 border-purple-500/40 bg-purple-950/40';
      case 'Execution':
        return 'text-rose-400 border-rose-500/40 bg-rose-950/40';
      case 'Impact':
        return 'text-red-400 border-red-500/40 bg-red-950/40';
      default:
        return 'text-slate-400 border-slate-700 bg-slate-900/60';
    }
  };

  const getStatusBadge = (code?: number) => {
    if (!code) return null;
    let color = 'text-slate-400 border-slate-800 bg-slate-900';
    if (code >= 200 && code < 300) color = 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30';
    else if (code === 401) color = 'text-amber-400 border-amber-500/30 bg-amber-950/30';
    else if (code === 403) color = 'text-rose-400 border-rose-500/30 bg-rose-950/30';
    else if (code === 404) color = 'text-blue-400 border-blue-500/30 bg-blue-950/30';
    else if (code === 429) color = 'text-orange-400 border-orange-500/30 bg-orange-950/30';
    else if (code >= 500) color = 'text-red-400 border-red-500/30 bg-red-950/30';

    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${color}`}>
        HTTP {code}
      </span>
    );
  };

  if (events.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs">
        No chronological timeline events available for this incident.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
      {events.map((evt, idx) => (
        <div key={evt.id || idx} className="relative group">
          {/* Timeline node icon */}
          <div className="absolute -left-[27px] top-1.5 w-6 h-6 rounded-full bg-[#0d1629] border border-slate-700 group-hover:border-cyan-500/60 flex items-center justify-center transition-colors shadow-sm">
            {getEventIcon(evt.phase, evt.eventType)}
          </div>

          <div className="bg-[#0b1220] border border-slate-800/80 rounded-lg p-3.5 hover:border-slate-700 transition-colors space-y-2">
            {/* Header: Phase / Title & Time */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {evt.phase && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold border flex items-center gap-1 ${getPhaseBadgeColor(evt.phase)}`}>
                    <Crosshair className="w-2.5 h-2.5" />
                    {evt.phase}
                  </span>
                )}
                {evt.title && (
                  <span className="text-xs font-semibold text-slate-200">{evt.title}</span>
                )}
                {evt.severity && (
                  <Badge severity={evt.severity} size="sm" showDot={false} />
                )}
                {getStatusBadge(evt.statusCode)}
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>
                  {evt.timestamp.includes('T')
                    ? evt.timestamp.replace('T', ' ').slice(0, 19)
                    : evt.timestamp}{' '}
                  UTC
                </span>
              </div>
            </div>

            {/* HTTP Route telemetry if available */}
            {evt.method && evt.endpoint && (
              <div className="flex items-center gap-1.5 text-xs font-mono bg-[#070b14] px-2.5 py-1 rounded border border-slate-800/80 text-slate-300">
                <span className="font-bold text-cyan-400">{evt.method}</span>
                <span className="text-slate-400 truncate">{evt.endpoint}</span>
              </div>
            )}

            {/* Description / Message */}
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {evt.description || 'Raw security event recorded on target system.'}
            </p>

            {/* Footer telemetry */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/60">
              <div>
                <span className="text-slate-500">Source:</span>{' '}
                <span className="text-cyan-300 font-semibold">{evt.sourceIp}</span>
              </div>
              {evt.actorId && (
                <div>
                  <span className="text-slate-500">Actor:</span>{' '}
                  <span className="text-slate-300">{evt.actorId}</span>
                  {evt.actorRole && (
                    <span className="ml-1 text-[10px] uppercase px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                      {evt.actorRole}
                    </span>
                  )}
                </div>
              )}
              {evt.eventType && (
                <div className="ml-auto text-slate-500 flex items-center gap-1">
                  <span>Type:</span>
                  <span className="text-slate-400">{evt.eventType}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
