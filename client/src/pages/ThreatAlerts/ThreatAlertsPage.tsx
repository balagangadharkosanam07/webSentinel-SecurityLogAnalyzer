import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  Search,
  Clock,
  ArrowUpRight,
  FileText,
  Info,
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { DetailDrawer } from '../../components/common/DetailDrawer';
import { api, DbAlert, DbLogEvent } from '../../services/api';

export const ThreatAlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<DbAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected alert and its fetched supporting events
  const [selectedAlert, setSelectedAlert] = useState<DbAlert | null>(null);
  const [supportingEvents, setSupportingEvents] = useState<DbLogEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);

  // Fetch live alerts from Neon PostgreSQL
  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getAlerts({
        severity: severityFilter,
        status: statusFilter,
        search: searchQuery,
      });
      if (res.success && res.data) {
        setAlerts(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch threat alerts from server');
    } finally {
      setIsLoading(false);
    }
  }, [severityFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Execute Detection Engine
  const handleRunDetection = async () => {
    setIsScanning(true);
    setScanNotice(null);
    setError(null);

    try {
      const res = await api.runDetection(500);
      if (res.success && res.data) {
        setScanNotice(
          `Detection Engine Run Complete: Evaluated ${res.data.totalEventsEvaluated} logs across ${res.data.rulesExecuted} rules -> Generated ${res.data.newAlertsCreated} new alerts!`
        );
        await fetchAlerts();
      }
    } catch (err: any) {
      setError(err.message || 'Detection engine execution failed');
    } finally {
      setIsScanning(false);
    }
  };

  // Status modification handler
  const handleStatusChange = async (alertId: string, newStatus: string) => {
    // Optimistic UI update
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: newStatus as any } : a))
    );

    try {
      await api.updateAlertStatus(alertId, newStatus);
    } catch (err: any) {
      setError(`Failed to update status for ${alertId}: ${err.message}`);
      await fetchAlerts();
    }
  };

  // Inspect alert and fetch hydrated supporting events
  const handleInspectAlert = async (alert: DbAlert) => {
    setSelectedAlert(alert);
    setIsLoadingEvents(true);
    setSupportingEvents([]);

    try {
      const res = await api.getAlertById(alert.id);
      if (res.success && res.data && res.data.supportingEvents) {
        setSupportingEvents(res.data.supportingEvents);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          alert.title.toLowerCase().includes(q) ||
          alert.ruleId.toLowerCase().includes(q) ||
          alert.sourceIp.toLowerCase().includes(q) ||
          alert.evidenceSummary.toLowerCase().includes(q) ||
          (alert.actorId && alert.actorId.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [alerts, severityFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-cyan-400" />
            Threat Alerts &amp; Rule Detections
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic rule evaluations, brute force clustering, and injection detections persisted in Neon DB
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunDetection}
            disabled={isScanning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all bg-cyan-950 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-900/60 disabled:opacity-50 shadow-sm"
          >
            <Sparkles className={`w-3.5 h-3.5 text-cyan-400 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Analyzing Telemetry...' : 'Run Detection Engine'}</span>
          </button>

          <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
            Alerts in DB: <strong className="text-cyan-400">{filteredAlerts.length}</strong>
          </span>
        </div>
      </div>

      {/* Scan Notice Banner */}
      {scanNotice && (
        <div className="bg-[#0b1b1f] border border-cyan-500/40 rounded-lg p-3 font-mono text-xs flex items-center justify-between text-cyan-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{scanNotice}</span>
          </div>
          <button onClick={() => setScanNotice(null)} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-950/40 border border-red-500/40 rounded-lg p-3 font-mono text-xs flex items-center justify-between text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[#0d1527] border border-slate-800/80 rounded-lg p-4 font-mono">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search alert title, rule ID, IP, actor..."
              className="w-full bg-[#070b14] border border-slate-700/80 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Severity filter */}
          <div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              aria-label="Filter by Severity"
              className="w-full bg-[#070b14] border border-slate-700/80 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Lifecycle Status"
              className="w-full bg-[#070b14] border border-slate-700/80 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="false_positive">False Positive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts Table / List */}
      <div className="space-y-3 font-mono">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 bg-[#0d1527] border border-slate-800 rounded-lg">
            <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" />
            Loading security alerts from Neon DB...
          </div>
        ) : filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-[#0d1527] border border-slate-800/80 hover:border-slate-700 rounded-lg p-4 transition-all space-y-3 shadow-lg"
            >
              {/* Alert Top line */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Badge severity={alert.severity} size="md" />
                  <span className="text-xs text-cyan-400 font-semibold">{alert.id}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-xs font-semibold text-slate-100">{alert.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(alert.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
                  </div>
                  {/* Status Dropdown */}
                  <select
                    value={alert.status}
                    onChange={(e) => handleStatusChange(alert.id, e.target.value)}
                    aria-label={`Status for alert ${alert.id}`}
                    className="bg-[#070b14] border border-slate-700 text-xs rounded px-2 py-0.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                    <option value="false_positive">False Positive</option>
                  </select>
                </div>
              </div>

              {/* Alert Description */}
              <p className="text-xs text-slate-300 font-sans leading-relaxed">{alert.description}</p>

              {/* Evidence box */}
              <div className="p-2.5 rounded bg-[#070b14] border border-slate-800 text-xs flex items-start gap-2 text-slate-300">
                <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-cyan-400 font-semibold mr-1.5">Evidence Summary:</span>
                  <span>{alert.evidenceSummary}</span>
                </div>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 flex-shrink-0 font-bold">
                  Strength: {alert.evidenceStrength}
                </span>
              </div>

              {/* Metadata & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
                <div className="flex items-center gap-4 text-slate-400">
                  <div>
                    <span className="text-slate-500">Rule:</span>{' '}
                    <span className="text-slate-200 font-bold">{alert.ruleId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Source IP:</span>{' '}
                    <span className="text-cyan-300">{alert.sourceIp}</span>
                  </div>
                  {alert.actorId && (
                    <div>
                      <span className="text-slate-500">Actor:</span>{' '}
                      <span className="text-slate-200">{alert.actorId}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleInspectAlert(alert)}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Inspect Supporting Events ({(alert.supportingEventIds as any)?.length || 0})</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-slate-500 bg-[#0d1527] border border-slate-800 rounded-lg space-y-2">
            <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-slate-300 font-semibold">No threat alerts found in Neon DB.</p>
            <p className="text-slate-500 text-xs">
              Click &quot;Run Detection Engine&quot; to evaluate telemetry and trigger security rules.
            </p>
          </div>
        )}
      </div>

      {/* Supporting Events Slide-Over Drawer */}
      <DetailDrawer
        isOpen={Boolean(selectedAlert)}
        onClose={() => setSelectedAlert(null)}
        title={selectedAlert ? `Security Alert: ${selectedAlert.id}` : 'Alert Forensics'}
        subtitle={`Rule: ${selectedAlert?.ruleId} | Attacker IP: ${selectedAlert?.sourceIp}`}
        data={selectedAlert ? (selectedAlert as unknown as Record<string, unknown>) : null}
      >
        {selectedAlert && (
          <div className="space-y-4 font-mono text-xs">
            <div className="text-xs text-slate-400">
              Correlated log evidence that satisfied the thresholds for detection rule{' '}
              <strong className="text-cyan-400">{selectedAlert.ruleId}</strong>:
            </div>

            {isLoadingEvents ? (
              <div className="py-6 text-center text-slate-500">
                <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin mx-auto mb-2" />
                Loading supporting events from PostgreSQL...
              </div>
            ) : supportingEvents.length > 0 ? (
              <div className="space-y-2">
                {supportingEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 rounded-lg bg-[#070b14] border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span className="text-cyan-400 font-semibold">{evt.id}</span>
                      <span>{evt.timestamp}</span>
                    </div>
                    <div className="text-slate-200">
                      <span className="text-cyan-400 font-bold mr-1">[{evt.method}]</span>
                      <span>{evt.endpoint}</span>
                      <span className="ml-2 text-slate-400">HTTP {evt.statusCode}</span>
                    </div>
                    <p className="text-slate-300 text-[11px] font-sans">{evt.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-[#070b14] border border-slate-800 rounded text-slate-500 text-center">
                Supporting event records: {(selectedAlert.supportingEventIds as string[]).join(', ')}
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
