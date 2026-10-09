import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Server,
  Network,
  Database,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import {
  SYNTHETIC_RULE_STATS,
  SYNTHETIC_TOP_IPS,
  SYNTHETIC_TARGETED_ENDPOINTS,
} from '../../data/mockData';
import { api, RiskAnalyticsResult } from '../../services/api';

export const RiskAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<RiskAnalyticsResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);

  const fetchRiskAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getRiskAnalytics();
      if (res.success && res.data && res.data.ruleStats.length > 0) {
        setData(res.data);
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
    fetchRiskAnalytics();
  }, []);

  const getSeverityBarColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return '#ef4444';
      case 'high':
        return '#f97316';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#3b82f6';
      default:
        return '#64748b';
    }
  };

  // Compute total alert counts across rules to derive percentages
  const totalRuleAlerts = data
    ? data.ruleStats.reduce((sum, r) => sum + r.count, 0)
    : SYNTHETIC_RULE_STATS.reduce((sum, r) => sum + r.count, 0);

  const ruleStats = data && data.ruleStats.length > 0
    ? data.ruleStats.map((r) => ({
        rule_id: r.ruleId,
        rule_name: r.name,
        severity: r.severity as any,
        category: r.category,
        count: r.count,
        percentage: totalRuleAlerts > 0 ? Math.round((r.count / totalRuleAlerts) * 100) : 0,
      }))
    : SYNTHETIC_RULE_STATS;

  interface DisplayIp {
    ip: string;
    requests: number;
    suspicious: number;
    last_seen: string;
    primary_target: string;
  }

  const topIps: DisplayIp[] = data && data.topSuspiciousIps.length > 0
    ? data.topSuspiciousIps.map((ip) => ({
        ip: ip.ip,
        requests: ip.totalRequests,
        suspicious: ip.suspiciousCount,
        last_seen: ip.lastSeen ? ip.lastSeen.replace('T', ' ').slice(11, 19) + ' UTC' : 'Recent',
        primary_target: ip.primaryTarget,
      }))
    : SYNTHETIC_TOP_IPS.map((ip) => ({
        ip: ip.ip,
        requests: ip.event_count,
        suspicious: ip.failed_logins,
        last_seen: ip.last_activity,
        primary_target: ip.geo,
      }));

  interface DisplayEndpoint {
    endpoint: string;
    method: string;
    total_hits: number;
    suspicious_hits: number;
    error_ratio: number;
  }

  const targetedEndpoints: DisplayEndpoint[] = data && data.targetedEndpoints.length > 0
    ? data.targetedEndpoints.map((e) => ({
        endpoint: e.endpoint,
        method: e.method,
        total_hits: e.totalHits,
        suspicious_hits: e.suspiciousHits,
        error_ratio: e.totalHits > 0 ? Math.round((e.errorCount / e.totalHits) * 100) : 0,
      }))
    : SYNTHETIC_TARGETED_ENDPOINTS.map((e) => ({
        endpoint: e.endpoint,
        method: e.method,
        total_hits: e.total_hits,
        suspicious_hits: e.status_401 + e.status_403 + e.status_404,
        error_ratio: e.total_hits > 0 ? Math.round(((e.status_401 + e.status_403 + e.status_404) / e.total_hits) * 100) : 0,
      }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Risk Analytics &amp; Threat Patterns
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated attack signatures, malicious infrastructure telemetry, and target endpoint exposure
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Data Source Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#070b14] border border-slate-800 text-xs font-mono">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Data Source:</span>
            <span className={isUsingFallback ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isUsingFallback ? 'Synthetic Offline' : 'Neon PostgreSQL'}
            </span>
          </div>

          <button
            onClick={fetchRiskAnalytics}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Top Row: Detection Rule Frequency (Bar Chart & Ranked Breakdown) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Detection Rules Bar Chart (7 Cols) */}
        <Card
          title="Rule Detection Frequency"
          subtitle="Relative trigger volume across configured security rules"
          className="lg:col-span-7"
        >
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ruleStats}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  fontFamily="monospace"
                />
                <YAxis
                  type="category"
                  dataKey="rule_id"
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  fontFamily="monospace"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0d1527',
                    borderColor: '#334155',
                    borderRadius: '0.375rem',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                  itemStyle={{ color: '#e2e8f0' }}
                  formatter={(val: number) => [`${val} detections`, 'Count']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {ruleStats.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getSeverityBarColor(entry.severity)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Rule Breakdown Ranked Table (5 Cols) */}
        <Card
          title="Detection Breakdown"
          subtitle="Rules sorted by trigger prevalence"
          className="lg:col-span-5"
        >
          <div className="space-y-2.5 pt-1 overflow-y-auto max-h-64">
            {ruleStats.map((rule) => (
              <div
                key={rule.rule_id}
                className="p-2.5 rounded-lg bg-[#070b14] border border-slate-800/80 flex items-center justify-between text-xs font-mono"
              >
                <div className="space-y-0.5 truncate pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">{rule.rule_id}</span>
                    <Badge severity={rule.severity} size="sm" showDot={false} />
                  </div>
                  <p className="text-[11px] text-slate-300 truncate" title={rule.rule_name}>
                    {rule.rule_name}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-slate-100 font-bold">{rule.count}</span>
                  <span className="text-[10px] text-slate-500 block">({rule.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Second Row: Top Suspicious Source IPs & Targeted Endpoints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Frequent Suspicious Source IPs */}
        <Card
          title="Top Malicious Source IPs"
          subtitle="Entities generating suspicious or high-volume anomalies"
          action={
            <span className="text-xs font-mono text-cyan-400 flex items-center gap-1">
              <Network className="w-3.5 h-3.5" />
              Ranked by Hits
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-500 uppercase">
                  <th className="py-2 px-3">IP Address</th>
                  <th className="py-2 px-3">Requests</th>
                  <th className="py-2 px-3">Suspicious</th>
                  <th className="py-2 px-3">Primary Target</th>
                  <th className="py-2 px-3 text-right">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {topIps.map((entry) => (
                  <tr key={entry.ip} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-cyan-300">{entry.ip}</td>
                    <td className="py-2.5 px-3 text-slate-400">{entry.requests}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-rose-400 font-bold">{entry.suspicious}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 max-w-[150px] truncate" title={entry.primary_target}>
                      {entry.primary_target}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">{entry.last_seen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Targeted Application Endpoints */}
        <Card
          title="Frequently Targeted Endpoints"
          subtitle="HTTP route exposure and error rate distribution"
          action={
            <span className="text-xs font-mono text-cyan-400 flex items-center gap-1">
              <Server className="w-3.5 h-3.5" />
              Route Telemetry
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-500 uppercase">
                  <th className="py-2 px-3">Method &amp; Route</th>
                  <th className="py-2 px-3">Total</th>
                  <th className="py-2 px-3">Suspicious</th>
                  <th className="py-2 px-3 text-right">Error Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {targetedEndpoints.map((ep) => (
                  <tr key={`${ep.method}-${ep.endpoint}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-slate-200">
                      <span className="font-bold text-cyan-400 mr-2">{ep.method}</span>
                      <span className="text-slate-300">{ep.endpoint}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{ep.total_hits}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-amber-400 font-bold">{ep.suspicious_hits}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          ep.error_ratio > 30
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                            : ep.error_ratio > 0
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {ep.error_ratio}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
