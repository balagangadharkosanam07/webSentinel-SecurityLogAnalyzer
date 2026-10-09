import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  Layers,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  GitMerge,
  Filter,
  Database,
  Search,
} from 'lucide-react';
import { SYNTHETIC_INCIDENTS } from '../../data/mockData';
import { IncidentStatus } from '../../types/incidents';
import { Badge } from '../../components/common/Badge';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Card } from '../../components/common/Card';
import { IncidentTimeline, TimelineItem } from '../../components/timeline/IncidentTimeline';
import { api, DbIncident, DbIncidentWithDetails, DbAlert } from '../../services/api';

export const IncidentsPage: React.FC = () => {
  // State
  const [incidents, setIncidents] = useState<DbIncident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [activeDetails, setActiveDetails] = useState<DbIncidentWithDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [correlating, setCorrelating] = useState<boolean>(false);
  const [correlationMsg, setCorrelationMsg] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Transform synthetic incident to DbIncident format for fallback
  const adaptSyntheticIncident = (inc: typeof SYNTHETIC_INCIDENTS[0]): DbIncident => ({
    id: inc.id,
    title: inc.title,
    description: inc.description,
    severity: inc.severity,
    status: inc.status as any,
    primarySourceIp: inc.primary_source_ip,
    targetedAsset: inc.targeted_asset,
    riskScore: inc.risk_score.total_score,
    riskBreakdown: {
      base_score: inc.risk_score.base_score,
      frequency_multiplier: inc.risk_score.frequency_multiplier,
      criticality_weight: inc.risk_score.criticality_weight,
      unauthorized_factor: inc.risk_score.unauthorized_factor,
      total_score: inc.risk_score.total_score,
      rationale: inc.risk_score.rationale,
    },
    firstSeen: inc.first_seen,
    lastSeen: inc.last_seen,
    createdAt: inc.created_at,
    updatedAt: inc.updated_at,
    isSynthetic: true,
  });

  // Fetch list of incidents from live backend
  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getIncidents({
        severity: filterSeverity,
        status: filterStatus,
        search: searchQuery,
      });

      if (res.success && res.data && res.data.length > 0) {
        setIncidents(res.data);
        setIsUsingFallback(false);
        if (!selectedIncidentId || !res.data.some((i) => i.id === selectedIncidentId)) {
          setSelectedIncidentId(res.data[0].id);
        }
      } else {
        // Fallback to synthetic if database empty
        const fallbackList = SYNTHETIC_INCIDENTS.map(adaptSyntheticIncident);
        setIncidents(fallbackList);
        setIsUsingFallback(true);
        if (!selectedIncidentId || !fallbackList.some((i) => i.id === selectedIncidentId)) {
          setSelectedIncidentId(fallbackList[0]?.id || '');
        }
      }
    } catch {
      // Offline fallback
      const fallbackList = SYNTHETIC_INCIDENTS.map(adaptSyntheticIncident);
      setIncidents(fallbackList);
      setIsUsingFallback(true);
      if (!selectedIncidentId && fallbackList.length > 0) {
        setSelectedIncidentId(fallbackList[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterStatus, searchQuery, selectedIncidentId]);

  // Fetch active incident details (alerts & kill-chain timeline)
  const fetchActiveDetails = useCallback(async (id: string) => {
    if (!id) return;
    try {
      setDetailsLoading(true);
      if (id.startsWith('INC-00')) {
        // Synthetic mock data
        const mock = SYNTHETIC_INCIDENTS.find((i) => i.id === id);
        if (mock) {
          const adapted = adaptSyntheticIncident(mock);
          const timelineItems: TimelineItem[] = mock.timeline.map((t) => ({
            id: t.id,
            timestamp: t.timestamp,
            title: t.title,
            description: t.description,
            sourceIp: t.source_ip,
            actorId: t.actor_id,
            actorRole: t.actor_role,
            severity: t.severity,
            eventType: t.event_type,
          }));
          setActiveDetails({
            ...adapted,
            alerts: [],
            timeline: timelineItems as any,
          });
        }
        return;
      }

      const res = await api.getIncidentById(id);
      if (res.success && res.data) {
        setActiveDetails(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch incident details:', err);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  useEffect(() => {
    if (selectedIncidentId) {
      fetchActiveDetails(selectedIncidentId);
    }
  }, [selectedIncidentId, fetchActiveDetails]);

  // Run Incident Correlation
  const handleCorrelate = async () => {
    try {
      setCorrelating(true);
      setCorrelationMsg(null);
      const res = await api.correlateIncidents();
      if (res.success && res.data) {
        setCorrelationMsg(
          `Correlation complete: Correlated ${res.data.totalAlertsProcessed} alerts into ${res.data.incidentsCreated} incidents (${res.data.alertsLinked} alerts linked).`
        );
        await fetchIncidents();
      }
    } catch (err: any) {
      setCorrelationMsg(`Correlation failed: ${err.message || 'Unknown error'}`);
    } finally {
      setCorrelating(false);
    }
  };

  // Status Triage Update
  const handleStatusChange = async (newStatus: IncidentStatus) => {
    if (!activeIncident) return;
    try {
      if (!isUsingFallback && !activeIncident.id.startsWith('INC-00')) {
        await api.updateIncidentStatus(activeIncident.id, newStatus);
      }
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === activeIncident.id ? { ...inc, status: newStatus as any } : inc))
      );
      if (activeDetails) {
        setActiveDetails({ ...activeDetails, status: newStatus as any });
      }
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const activeIncident = incidents.find((i) => i.id === selectedIncidentId) || incidents[0];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-400 border-red-500/50 bg-red-950/30';
    if (score >= 50) return 'text-orange-400 border-orange-500/50 bg-orange-950/30';
    return 'text-amber-400 border-amber-500/50 bg-amber-950/30';
  };

  // Convert timeline to TimelineItem format
  const activeTimeline: TimelineItem[] = activeDetails?.timeline
    ? activeDetails.timeline.map((step: any) => ({
        id: step.id,
        timestamp: step.timestamp,
        phase: step.phase,
        title: step.title || `${step.phase || 'Event'}: ${step.method || ''} ${step.endpoint || ''}`,
        description: step.message || step.description,
        method: step.method,
        endpoint: step.endpoint,
        statusCode: step.statusCode || step.status_code,
        sourceIp: step.sourceIp || step.source_ip,
        actorId: step.actorId || step.actor_id,
        actorRole: step.actorRole || step.actor_role,
        severity: step.severity,
        eventType: step.eventType || step.event_type,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            Security Incidents &amp; Correlation Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Correlated multi-alert security campaigns with explainable risk scores and step-by-step kill-chain reconstruction
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Data Source Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#070b14] border border-slate-800 text-xs font-mono">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Source:</span>
            <span className={isUsingFallback ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isUsingFallback ? 'Synthetic Offline' : 'Neon PostgreSQL'}
            </span>
          </div>

          {/* Run Correlation Engine Button */}
          <button
            onClick={handleCorrelate}
            disabled={correlating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold font-mono transition-all disabled:opacity-50"
          >
            {correlating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <GitMerge className="w-3.5 h-3.5 text-cyan-400" />
            )}
            {correlating ? 'Correlating...' : 'Correlate Alerts'}
          </button>
        </div>
      </div>

      {/* Correlation Notification Banner */}
      {correlationMsg && (
        <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/40 text-xs text-cyan-200 font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>{correlationMsg}</span>
          </div>
          <button
            onClick={() => setCorrelationMsg(null)}
            className="text-slate-400 hover:text-slate-200 text-xs ml-4"
          >
            &times;
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-[#0d1527] border border-slate-800 rounded-lg text-xs font-mono">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Filter className="w-3.5 h-3.5 text-cyan-400" />
          <span>Filters:</span>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search incident title, IP, asset..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#070b14] border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-cyan-500/60"
          />
        </div>

        {/* Severity */}
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          aria-label="Filter by Severity"
          className="px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-cyan-500/60"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter by Status"
          className="px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-cyan-500/60"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="mitigated">Mitigated</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <button
          onClick={() => {
            setFilterSeverity('all');
            setFilterStatus('all');
            setSearchQuery('');
          }}
          className="px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Incidents Selector List (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Incidents ({incidents.length})
            </span>
            {loading && <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />}
          </div>

          <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {incidents.length === 0 && !loading && (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg text-slate-400 text-xs space-y-3">
                <p>No incidents match the active filters.</p>
                <button
                  onClick={handleCorrelate}
                  className="px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-xs hover:bg-cyan-500/30"
                >
                  Run Correlation Engine
                </button>
              </div>
            )}

            {incidents.map((incident) => {
              const isSelected = incident.id === activeIncident?.id;
              return (
                <div
                  key={incident.id}
                  onClick={() => setSelectedIncidentId(incident.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 text-left ${
                    isSelected
                      ? 'bg-[#111e38] border-cyan-500/60 shadow-lg ring-1 ring-cyan-500/30'
                      : 'bg-[#0d1527] border-slate-800/80 hover:border-slate-700/80 hover:bg-[#0f182d]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge severity={incident.severity} size="sm" />
                      <span className="text-xs font-mono font-bold text-cyan-400">
                        {incident.id}
                      </span>
                    </div>
                    <StatusBadge status={incident.status as any} />
                  </div>

                  <h3 className="text-xs font-semibold text-slate-100 line-clamp-2 mb-2 leading-relaxed">
                    {incident.title}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Risk:</span>
                      <span
                        className={`px-1.5 py-0.2 rounded border font-bold ${getScoreColor(
                          incident.riskScore || incident.riskBreakdown?.total_score || 0
                        )}`}
                      >
                        {incident.riskScore || incident.riskBreakdown?.total_score || 0}/100
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <span className="text-cyan-300 font-mono">{incident.primarySourceIp}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Incident Details & Chronological Timeline (7 Cols) */}
        {activeIncident ? (
          <div className="lg:col-span-7 space-y-5">
            {/* Incident Header Card */}
            <Card className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      {activeIncident.id}
                    </span>
                    <Badge severity={activeIncident.severity} size="sm" />
                    <StatusBadge status={activeIncident.status as any} />
                    {activeIncident.isSynthetic && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-800 border border-slate-700 text-slate-400">
                        Synthetic
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-slate-100">{activeIncident.title}</h2>
                </div>

                {/* Status Triage Control */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-mono text-slate-400">Triage:</span>
                  <select
                    value={activeIncident.status}
                    onChange={(e) => handleStatusChange(e.target.value as IncidentStatus)}
                    aria-label={`Status for incident ${activeIncident.id}`}
                    className="bg-[#070b14] border border-slate-700 text-xs rounded px-2.5 py-1 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="mitigated">Mitigated</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {activeIncident.description}
              </p>

              {/* Asset & IP Telemetry */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-[#070b14] border border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Threat Actor IP</span>
                  <span className="text-cyan-300 font-semibold">{activeIncident.primarySourceIp}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Targeted Asset</span>
                  <span className="text-slate-200 truncate block">{activeIncident.targetedAsset}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Observed Window</span>
                  <span className="text-slate-400">
                    {activeIncident.firstSeen ? activeIncident.firstSeen.replace('T', ' ').slice(11, 19) : ''} —{' '}
                    {activeIncident.lastSeen ? activeIncident.lastSeen.replace('T', ' ').slice(11, 19) : ''} UTC
                  </span>
                </div>
              </div>

              {/* Explainable Risk Scoring Card */}
              {activeIncident.riskBreakdown && (
                <div className="p-4 rounded-lg bg-[#09101f] border border-cyan-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-slate-100 uppercase tracking-wider font-mono">
                        Explainable Deterministic Risk Score
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-sm font-mono font-bold border ${getScoreColor(
                        activeIncident.riskBreakdown.total_score
                      )}`}
                    >
                      Score: {activeIncident.riskBreakdown.total_score} / 100
                    </span>
                  </div>

                  {/* Score component breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono pt-1">
                    <div className="p-2 rounded bg-[#070b14] border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Base Severity</span>
                      <span className="text-cyan-400 font-bold">
                        +{activeIncident.riskBreakdown.base_score}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-[#070b14] border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Frequency</span>
                      <span className="text-amber-400 font-bold">
                        +{activeIncident.riskBreakdown.frequency_multiplier}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-[#070b14] border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Criticality</span>
                      <span className="text-purple-400 font-bold">
                        +{activeIncident.riskBreakdown.criticality_weight}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-[#070b14] border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Breach Factor</span>
                      <span className="text-rose-400 font-bold">
                        +{activeIncident.riskBreakdown.unauthorized_factor}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 font-mono italic leading-relaxed">
                    Rationale: {activeIncident.riskBreakdown.rationale}
                  </p>
                </div>
              )}

              {/* Linked Alerts Summary */}
              {activeDetails?.alerts && activeDetails.alerts.length > 0 && (
                <div className="p-3 rounded-lg bg-[#070b14] border border-slate-800/80 space-y-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                    Correlated Alerts in this Incident ({activeDetails.alerts.length})
                  </span>
                  <div className="space-y-1.5">
                    {activeDetails.alerts.map((al: DbAlert) => (
                      <div
                        key={al.id}
                        className="flex items-center justify-between p-2 rounded bg-[#0b1220] border border-slate-800 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <Badge severity={al.severity} size="sm" showDot={false} />
                          <span className="font-bold text-cyan-400">{al.id}</span>
                          <span className="text-slate-300 truncate max-w-[240px]">{al.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {al.ruleId}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Chronological Incident Timeline */}
            <Card
              title="Chronological Incident Timeline"
              subtitle="Step-by-step kill-chain reconstruction from supporting security logs"
              action={
                <span className="text-xs font-mono text-cyan-400">
                  {detailsLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    `${activeTimeline.length} Sequenced Steps`
                  )}
                </span>
              }
            >
              <div className="pt-2">
                <IncidentTimeline events={activeTimeline} />
              </div>
            </Card>
          </div>
        ) : (
          <div className="lg:col-span-7 flex items-center justify-center p-12 border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs">
            Select an incident on the left to inspect its risk breakdown and timeline.
          </div>
        )}
      </div>
    </div>
  );
};
