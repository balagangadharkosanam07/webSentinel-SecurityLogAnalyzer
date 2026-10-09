import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  Flame,
  ShieldCheck,
  ArrowRight,
  Activity,
  Terminal,
  Database,
  RefreshCw,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { KpiCard } from '../../components/common/KpiCard';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import {
  SYNTHETIC_LOG_EVENTS,
  SYNTHETIC_ALERTS,
  SYNTHETIC_INCIDENTS,
  SYNTHETIC_EVENT_TRENDS,
} from '../../data/mockData';
import { api, OverviewMetricsData } from '../../services/api';

export const OverviewPage: React.FC = () => {
  const [metrics, setMetrics] = useState<OverviewMetricsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await api.getOverviewMetrics();
      if (res.success && res.data && res.data.totalEvents > 0) {
        setMetrics(res.data);
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
    fetchMetrics();
  }, []);

  // Compute values with live DB data or synthetic fallback
  const suspiciousCount = metrics
    ? metrics.suspiciousEvents
    : SYNTHETIC_LOG_EVENTS.filter((e) => e.is_suspicious).length;

  const totalEvents = metrics ? metrics.totalEvents : SYNTHETIC_LOG_EVENTS.length;

  const suspiciousRatio = metrics
    ? metrics.suspiciousRatio
    : Math.round((suspiciousCount / totalEvents) * 100);

  const openIncidentsCount = metrics
    ? metrics.openIncidents
    : SYNTHETIC_INCIDENTS.filter((i) => i.status === 'open').length;

  const criticalAlertsCount = metrics
    ? metrics.criticalAlerts
    : SYNTHETIC_ALERTS.filter((a) => a.severity === 'critical' || a.severity === 'high').length;

  const trendData = metrics && metrics.eventTrends.length > 0
    ? metrics.eventTrends
    : SYNTHETIC_EVENT_TRENDS;

  const severityDistribution = metrics && metrics.severityDistribution.length > 0
    ? metrics.severityDistribution
    : [
        { severity: 'critical', count: 3 },
        { severity: 'high', count: 4 },
        { severity: 'medium', count: 5 },
        { severity: 'low', count: 2 },
      ];

  const recentAlertsList = metrics && metrics.recentAlerts.length > 0
    ? metrics.recentAlerts.map((a) => ({
        id: a.id,
        title: a.title,
        severity: a.severity as any,
        time: a.detectedAt ? a.detectedAt.replace('T', ' ').slice(11, 19) + ' UTC' : 'Recent',
        sourceIp: a.sourceIp,
      }))
    : SYNTHETIC_ALERTS.slice(0, 5).map((a) => ({
        id: a.id,
        title: a.title,
        severity: a.severity,
        time: a.detected_at.slice(11, 19) + ' UTC',
        sourceIp: a.source_ip,
      }));

  const recentEventsList = metrics && metrics.recentEvents.length > 0
    ? metrics.recentEvents.map((e) => ({
        id: e.id,
        timestamp: e.timestamp ? e.timestamp.replace('T', ' ').slice(11, 19) + ' UTC' : 'Recent',
        sourceIp: e.sourceIp,
        method: e.method,
        endpoint: e.endpoint,
        statusCode: e.statusCode,
        isSuspicious: e.isSuspicious,
      }))
    : SYNTHETIC_LOG_EVENTS.slice(0, 6).map((e) => ({
        id: e.id,
        timestamp: e.timestamp.slice(11, 19) + ' UTC',
        sourceIp: e.source_ip,
        method: e.method,
        endpoint: e.endpoint,
        statusCode: e.status_code,
        isSuspicious: e.is_suspicious,
      }));

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Security Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time security telemetry and high-priority indicators for target application{' '}
            <span className="font-mono text-cyan-300">attendance-portal</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Source Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#070b14] border border-slate-800 text-xs font-mono">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Data Source:</span>
            <span className={isUsingFallback ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isUsingFallback ? 'Synthetic Offline' : 'Neon PostgreSQL'}
            </span>
          </div>

          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <Link
            to="/logs"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            Log Explorer
          </Link>
          <Link
            to="/incidents"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white transition-colors shadow-sm"
          >
            <Flame className="w-3.5 h-3.5" />
            Triage Incidents ({openIncidentsCount})
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Ingested Events"
          value={totalEvents.toLocaleString()}
          change={isUsingFallback ? 'Synthetic Data' : 'Live Neon DB'}
          changeType="neutral"
          icon={FileText}
          subtext="Telemetry ingested from attendance portal"
          tone="cyan"
        />
        <KpiCard
          title="Suspicious Events"
          value={suspiciousCount}
          change={`${suspiciousRatio}% ratio`}
          changeType={suspiciousRatio > 10 ? 'negative' : 'positive'}
          icon={AlertTriangle}
          subtext="Events flagged by behavioral or pattern rules"
          tone="amber"
        />
        <KpiCard
          title="Open Incidents"
          value={openIncidentsCount}
          change={openIncidentsCount > 0 ? 'Requires Triage' : 'Normal'}
          changeType={openIncidentsCount > 0 ? 'negative' : 'positive'}
          icon={Flame}
          subtext="Active correlated clusters under analyst review"
          tone="red"
        />
        <KpiCard
          title="High-Risk Findings"
          value={criticalAlertsCount}
          change={criticalAlertsCount > 0 ? 'Action Needed' : 'Zero High Risk'}
          changeType={criticalAlertsCount > 0 ? 'negative' : 'positive'}
          icon={ShieldCheck}
          subtext="Critical & High severity alerts active"
          tone="orange"
        />
      </div>

      {/* Main Grid: Compact Trend Chart & Severity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Compact Event Trend Chart */}
        <Card
          title="Event Volume & Suspicious Trend"
          subtitle="Chronological ingested logs vs. anomaly rate (Live Telemetry)"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span>
                <span className="text-slate-400">Total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                <span className="text-slate-400">Suspicious</span>
              </div>
            </div>
          }
        >
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="suspiciousGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  fontFamily="monospace"
                />
                <YAxis
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
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#totalGradient)"
                  name="Total Events"
                />
                <Area
                  type="monotone"
                  dataKey="suspicious"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#suspiciousGradient)"
                  name="Suspicious"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Right 1 Col: Severity Distribution */}
        <Card
          title="Alert Severity Breakdown"
          subtitle="Distribution of alerts by severity category"
        >
          <div className="space-y-4 pt-2">
            {severityDistribution.map((item) => {
              const maxCount = Math.max(...severityDistribution.map((s) => s.count), 1);
              const percentage = Math.round((item.count / maxCount) * 100);

              let barColor = 'bg-blue-500';
              if (item.severity === 'critical') barColor = 'bg-rose-500';
              if (item.severity === 'high') barColor = 'bg-orange-500';
              if (item.severity === 'medium') barColor = 'bg-amber-500';

              return (
                <div key={item.severity} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <Badge severity={item.severity as any} size="sm" />
                    <span className="font-mono text-slate-300 font-semibold">{item.count} alerts</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(percentage, 6)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Bottom Grid: Recent High-Severity Alerts & Recent Raw Security Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts List */}
        <Card
          title="Recent High-Severity Alerts"
          subtitle="Latest security anomalies requiring investigation"
          action={
            <Link
              to="/alerts"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <div className="space-y-2.5 pt-1">
            {recentAlertsList.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#070b14] border border-slate-800/80 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge severity={alert.severity} size="sm" showDot={false} />
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">
                      {alert.title}
                    </h4>
                    <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>IP: <strong className="text-cyan-300">{alert.sourceIp}</strong></span>
                      <span>&bull;</span>
                      <span>{alert.id}</span>
                    </p>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-600" />
                  {alert.time}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Security Log Events Table */}
        <Card
          title="Recent Target Events"
          subtitle="Latest HTTP transaction records on attendance-portal"
          action={
            <Link
              to="/logs"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              Launch Explorer <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <div className="overflow-x-auto pt-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="pb-2 font-medium">Time (UTC)</th>
                  <th className="pb-2 font-medium">Source IP</th>
                  <th className="pb-2 font-medium">Method &amp; Endpoint</th>
                  <th className="pb-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {recentEventsList.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 text-slate-400">{evt.timestamp}</td>
                    <td className="py-2 text-cyan-300">{evt.sourceIp}</td>
                    <td className="py-2 text-slate-300 max-w-[200px] truncate">
                      <span className="font-bold text-slate-200 mr-1.5">{evt.method}</span>
                      <span className="text-slate-400">{evt.endpoint}</span>
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          evt.statusCode < 300
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                            : evt.statusCode === 401 || evt.statusCode === 403
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {evt.statusCode}
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
