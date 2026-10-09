import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import {
  SYNTHETIC_LOG_EVENTS,
  SYNTHETIC_ALERTS,
  SYNTHETIC_INCIDENTS,
  SYNTHETIC_RULE_STATS,
} from '../../data/mockData';
import { api, ReportSummaryResult } from '../../services/api';

export const ReportsPage: React.FC = () => {
  const [reportPeriod, setReportPeriod] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  const [report, setReport] = useState<ReportSummaryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const fetchReport = async (period: '24h' | '7d' | '30d' | 'all') => {
    try {
      setLoading(true);
      const res = await api.getReportSummary(period);
      if (res.success && res.data) {
        setReport(res.data);
        setIsUsingFallback(false);
      } else {
        setIsUsingFallback(true);
      }
    } catch {
      setIsUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(reportPeriod);
  }, [reportPeriod]);

  // Trigger live CSV download from Express backend
  const handleExportCsv = () => {
    const exportUrl = api.getReportExportUrl(reportPeriod);
    const link = document.createElement('a');
    link.href = exportUrl;
    link.setAttribute('download', `WebSentinel_Report_${reportPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  // Metrics from Live DB report or synthetic fallback
  const totalEvents = report ? report.totalEvents : SYNTHETIC_LOG_EVENTS.length;
  const totalAlerts = report ? report.totalAlerts : SYNTHETIC_ALERTS.length;
  const totalIncidents = report ? report.totalIncidents : SYNTHETIC_INCIDENTS.length;
  const criticalCount = report?.severityCounts?.critical ?? 3;
  const highCount = report?.severityCounts?.high ?? 4;
  const mediumCount = report?.severityCounts?.medium ?? 5;
  const lowCount = report?.severityCounts?.low ?? 2;

  const topRules = report && report.topRules.length > 0
    ? report.topRules.map((r) => ({
        rule_id: r.ruleId,
        rule_name: r.name,
        severity: r.severity as any,
        count: r.count,
        category: r.category,
      }))
    : SYNTHETIC_RULE_STATS.map((r) => ({
        rule_id: r.rule_id,
        rule_name: r.rule_name,
        severity: r.severity,
        count: r.count,
        category: 'behavioral',
      }));

  const keyFindings = report && report.keyFindings.length > 0
    ? report.keyFindings
    : [
        'Critical Risk: 7 high/critical alerts detected including multi-stage brute force and probable account takeover.',
        'Data Integrity Alert: Unauthorized attendance record alterations detected on endpoint /api/attendance/records.',
        'Injection Attacks: SQL Injection / XSS probes intercepted.',
      ];

  const limitations = report && report.limitations.length > 0
    ? report.limitations
    : [
        'Analysis derived from structured HTTP logs and deterministic rule evaluation.',
        'Raw passwords, access tokens, and confidential student identifiers are zeroized by design.',
        'Active synthetic datasets are utilized for automated SOC validation.',
      ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-cyan-400" />
            Security Audit Reports &amp; Compliance Export
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Periodic executive risk assessments, rule audit trails, and exportable findings for governance
          </p>
        </div>

        {/* Actions & Period selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Data Source Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#070b14] border border-slate-800 text-xs font-mono">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Data Source:</span>
            <span className={isUsingFallback ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isUsingFallback ? 'Synthetic Offline' : 'Neon PostgreSQL'}
            </span>
          </div>

          <div className="flex items-center bg-[#070b14] border border-slate-700 rounded-lg p-0.5 text-xs font-mono">
            {(['24h', '7d', '30d', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setReportPeriod(p)}
                className={`px-3 py-1 rounded transition-colors ${
                  reportPeriod === p
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchReport(reportPeriod)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
            title="Refresh Report"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition-colors shadow-sm"
          >
            {downloadSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export CSV Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Executive Summary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-[#0d1527] border border-slate-800">
          <span className="text-xs font-mono uppercase text-slate-400 block mb-1">
            Total Log Events
          </span>
          <span className="text-2xl font-bold font-mono text-cyan-300">{totalEvents}</span>
          <span className="text-[11px] text-slate-500 block mt-1">Processed in {reportPeriod}</span>
        </div>

        <div className="p-4 rounded-lg bg-[#0d1527] border border-slate-800">
          <span className="text-xs font-mono uppercase text-slate-400 block mb-1">
            Flagged Alerts
          </span>
          <span className="text-2xl font-bold font-mono text-orange-400">{totalAlerts}</span>
          <span className="text-[11px] text-slate-500 block mt-1">Rule violations triggered</span>
        </div>

        <div className="p-4 rounded-lg bg-[#0d1527] border border-slate-800">
          <span className="text-xs font-mono uppercase text-slate-400 block mb-1">
            Incidents Correlated
          </span>
          <span className="text-2xl font-bold font-mono text-rose-400">{totalIncidents}</span>
          <span className="text-[11px] text-slate-500 block mt-1">Multi-stage campaigns</span>
        </div>

        <div className="p-4 rounded-lg bg-[#0d1527] border border-slate-800">
          <span className="text-xs font-mono uppercase text-slate-400 block mb-1">
            High Severity Ratio
          </span>
          <span className="text-2xl font-bold font-mono text-amber-300">
            {totalAlerts > 0 ? Math.round(((criticalCount + highCount) / totalAlerts) * 100) : 0}%
          </span>
          <span className="text-[11px] text-slate-500 block mt-1">Requires SOC intervention</span>
        </div>
      </div>

      {/* Report Body: Executive Findings & Severity Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Key Findings & Recommendations (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card
            title="Key Security Findings"
            subtitle={`Actionable intelligence identified during the ${reportPeriod} audit window`}
          >
            <div className="space-y-3 pt-1">
              {keyFindings.map((finding, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[#070b14] border border-slate-800/80 flex items-start gap-3"
                >
                  <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{finding}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Audit Methodology &amp; Platform Limitations"
            subtitle="Defensive boundaries and privacy guardrails"
          >
            <div className="space-y-2.5 pt-1 text-xs text-slate-400">
              {limitations.map((lim, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">&bull;</span>
                  <span>{lim}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Severity Breakdown & Top Detection Rules (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card
            title="Severity Distribution Matrix"
            subtitle="Alerts categorized by operational severity"
          >
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-[#070b14] border border-rose-500/30">
                <span className="text-[10px] uppercase font-mono text-rose-400 block">Critical</span>
                <span className="text-xl font-bold font-mono text-rose-300">{criticalCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#070b14] border border-orange-500/30">
                <span className="text-[10px] uppercase font-mono text-orange-400 block">High</span>
                <span className="text-xl font-bold font-mono text-orange-300">{highCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#070b14] border border-amber-500/30">
                <span className="text-[10px] uppercase font-mono text-amber-400 block">Medium</span>
                <span className="text-xl font-bold font-mono text-amber-300">{mediumCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#070b14] border border-blue-500/30">
                <span className="text-[10px] uppercase font-mono text-blue-400 block">Low</span>
                <span className="text-xl font-bold font-mono text-blue-300">{lowCount}</span>
              </div>
            </div>
          </Card>

          <Card
            title="Prevalent Detection Rules"
            subtitle="Security rules triggering most frequently in period"
          >
            <div className="space-y-2 pt-1 font-mono text-xs">
              {topRules.map((rule) => (
                <div
                  key={rule.rule_id}
                  className="flex items-center justify-between p-2 rounded bg-[#070b14] border border-slate-800"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Badge severity={rule.severity} size="sm" showDot={false} />
                    <span className="text-slate-300 truncate">{rule.rule_name}</span>
                  </div>
                  <span className="font-bold text-cyan-300 flex-shrink-0">{rule.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
