import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
  Terminal,
  FileCode,
  ShieldAlert,
  Database,
  UploadCloud,
  CheckCircle,
  RefreshCw,
  Server,
  Sparkles,
} from 'lucide-react';
import { LogEvent, generateDedupKey } from '../../types/logs';
import { DetailDrawer } from '../../components/common/DetailDrawer';
import {
  DatasetCategory,
  DATASET_META,
  RAW_MALFORMED_RECORDS,
  validateLogDataset,
  getDatasetEvents,
} from '../../services/logDatasetService';
import {
  api,
  DbLogEvent,
  IngestionBatchResult,
  LogMetadataResult,
} from '../../services/api';

export const LogExplorerPage: React.FC = () => {
  // Mode Selection: Live Neon DB vs Synthetic Datasets
  const [activeTab, setActiveTab] = useState<'live_db' | 'datasets'>('live_db');

  // ---------------------------------------------------------
  // 1. LIVE DATABASE STATE (Neon PostgreSQL)
  // ---------------------------------------------------------
  const [dbLogs, setDbLogs] = useState<DbLogEvent[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbMetadata, setDbMetadata] = useState<LogMetadataResult>({
    eventTypes: [],
    sourceIps: [],
    totalCount: 0,
  });

  // DB Filter States
  const [dbSearch, setDbSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [dbEventType, setDbEventType] = useState<string>('all');
  const [dbStatusCode, setDbStatusCode] = useState<string>('all');
  const [dbSourceIp, setDbSourceIp] = useState<string>('all');
  const [dbOnlySuspicious, setDbOnlySuspicious] = useState<boolean>(false);
  const [dbSortField, setDbSortField] = useState<'timestamp' | 'statusCode'>('timestamp');
  const [dbSortOrder, setDbSortOrder] = useState<'asc' | 'desc'>('desc');

  // DB Pagination State
  const [dbPage, setDbPage] = useState<number>(1);
  const [dbLimit, setDbLimit] = useState<number>(15);
  const [dbPagination, setDbPagination] = useState<{
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
  });

  // Bulk Seeding State
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  // ---------------------------------------------------------
  // 2. SYNTHETIC DATASET STATE (Contract & Schema Hub)
  // ---------------------------------------------------------
  const [selectedDataset, setSelectedDataset] = useState<DatasetCategory>('all');
  const [showContractHub, setShowContractHub] = useState<boolean>(false);
  const [datasetPage, setDatasetPage] = useState<number>(1);
  const datasetItemsPerPage = 10;
  const [isIngestingSingle, setIsIngestingSingle] = useState<boolean>(false);
  const [singleIngestResult, setSingleIngestResult] = useState<IngestionBatchResult | null>(null);
  const [singleIngestError, setSingleIngestError] = useState<string | null>(null);

  // Active event for Detail Drawer
  const [activeEvent, setActiveEvent] = useState<LogEvent | DbLogEvent | null>(null);

  // Debounce search query for database queries (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(dbSearch);
      setDbPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [dbSearch]);

  // Fetch Database Metadata (Distinct IPs, Event types, Total records)
  const fetchMetadata = useCallback(async () => {
    try {
      const res = await api.getLogMetadata();
      if (res.success && res.data) {
        setDbMetadata(res.data);
      }
    } catch {
      // Non-blocking fallback
    }
  }, []);

  // Fetch Live Logs from Neon PostgreSQL
  const fetchDbLogs = useCallback(async () => {
    setIsLoadingDb(true);
    setDbError(null);

    try {
      const res = await api.getLogs({
        search: debouncedSearch,
        event_type: dbEventType,
        source_ip: dbSourceIp,
        status_code: dbStatusCode,
        only_suspicious: dbOnlySuspicious,
        sort_by: dbSortField,
        sort_order: dbSortOrder,
        page: dbPage,
        limit: dbLimit,
      });

      if (res.success && res.data) {
        setDbLogs(res.data);
        if (res.meta) {
          setDbPagination({
            total: res.meta.total ?? res.data.length,
            page: res.meta.page ?? dbPage,
            limit: res.meta.limit ?? dbLimit,
            totalPages: res.meta.totalPages ?? 1,
          });
        }
      }
    } catch (err: unknown) {
      setDbError(err instanceof Error ? err.message : 'Error fetching logs from Neon PostgreSQL');
    } finally {
      setIsLoadingDb(false);
    }
  }, [
    debouncedSearch,
    dbEventType,
    dbSourceIp,
    dbStatusCode,
    dbOnlySuspicious,
    dbSortField,
    dbSortOrder,
    dbPage,
    dbLimit,
  ]);

  // Initial load and dependency trigger
  useEffect(() => {
    if (activeTab === 'live_db') {
      fetchDbLogs();
    }
  }, [fetchDbLogs, activeTab]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // Handle Seeding All Datasets
  const handleSeedAll = async () => {
    setIsSeeding(true);
    setSeedNotice(null);
    try {
      const res = await api.seedAllDatasets();
      if (res.success && res.data) {
        setSeedNotice(
          `Successfully loaded ${res.data.batches.length} synthetic attack datasets (${res.data.totalLogsInDatabase} total rows in Neon DB)!`
        );
        await Promise.all([fetchDbLogs(), fetchMetadata()]);
      }
    } catch (err: any) {
      setDbError(err.message || 'Failed to seed synthetic datasets into Neon DB');
    } finally {
      setIsSeeding(false);
    }
  };

  // Reset Live DB Filters
  const resetDbFilters = () => {
    setDbSearch('');
    setDebouncedSearch('');
    setDbEventType('all');
    setDbStatusCode('all');
    setDbSourceIp('all');
    setDbOnlySuspicious(false);
    setDbSortField('timestamp');
    setDbSortOrder('desc');
    setDbPage(1);
  };

  // ---------------------------------------------------------
  // Synthetic dataset memoized calculations
  // ---------------------------------------------------------
  const baseRecords: LogEvent[] = useMemo(() => {
    return getDatasetEvents(selectedDataset);
  }, [selectedDataset]);

  const validationSummary = useMemo(() => {
    if (selectedDataset === 'malformed_suite') {
      return validateLogDataset(RAW_MALFORMED_RECORDS);
    }
    return validateLogDataset(baseRecords);
  }, [selectedDataset, baseRecords]);

  const paginatedDatasetEvents = baseRecords.slice(
    (datasetPage - 1) * datasetItemsPerPage,
    datasetPage * datasetItemsPerPage
  );
  const totalDatasetPages = Math.ceil(baseRecords.length / datasetItemsPerPage) || 1;

  const handleIngestSingleDataset = async () => {
    setIsIngestingSingle(true);
    setSingleIngestError(null);
    setSingleIngestResult(null);

    try {
      const recordsToIngest =
        selectedDataset === 'malformed_suite' ? RAW_MALFORMED_RECORDS : baseRecords;
      const response = await api.importLogs(recordsToIngest, `dashboard-${selectedDataset}`);
      if (response.success && response.data) {
        setSingleIngestResult(response.data);
        await Promise.all([fetchDbLogs(), fetchMetadata()]);
      } else {
        setSingleIngestError(response.error?.message || 'Ingestion failed');
      }
    } catch (err: unknown) {
      setSingleIngestError(err instanceof Error ? err.message : 'Network error connecting to backend ingestion API');
    } finally {
      setIsIngestingSingle(false);
    }
  };

  const getStatusBadge = (code: number) => {
    if (code >= 200 && code < 300) {
      return 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30';
    } else if (code >= 400 && code < 500) {
      return 'bg-amber-950/40 text-amber-400 border border-amber-500/30';
    } else {
      return 'bg-red-950/40 text-red-400 border border-red-500/30';
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            Log Explorer &amp; Security Forensics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time querying, pattern search, and RFC-2026-WS-LOG schema compliance against Neon PostgreSQL
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex items-center gap-2 bg-[#090f1d] border border-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('live_db')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
              activeTab === 'live_db'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>Neon DB (Live)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </button>

          <button
            onClick={() => setActiveTab('datasets')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
              activeTab === 'datasets'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>Synthetic Datasets</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: LIVE NEON POSTGRESQL DATABASE                          */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'live_db' && (
        <div className="space-y-4">
          {/* Action & Status Sub-header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1527] border border-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Live Connection:
              </span>
              <span className="text-slate-300">
                Neon PostgreSQL (<strong className="text-cyan-400">{dbMetadata.totalCount}</strong> total events stored)
              </span>
              {isLoadingDb && (
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin ml-2" />
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSeedAll}
                disabled={isSeeding}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60 disabled:opacity-50"
                title="Populates Neon DB with all 5 attack scenarios from sample-logs"
              >
                <Sparkles className={`w-3.5 h-3.5 text-emerald-400 ${isSeeding ? 'animate-spin' : ''}`} />
                <span>{isSeeding ? 'Seeding Neon DB...' : 'Load All Attack Scenarios'}</span>
              </button>

              <button
                onClick={() => {
                  fetchDbLogs();
                  fetchMetadata();
                }}
                disabled={isLoadingDb}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoadingDb ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Seed Success Notification */}
          {seedNotice && (
            <div className="bg-[#0b1b1f] border border-emerald-500/40 rounded-lg p-3 font-mono text-xs flex items-center justify-between text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>{seedNotice}</span>
              </div>
              <button onClick={() => setSeedNotice(null)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>
          )}

          {/* Database Error Banner */}
          {dbError && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-lg p-3 font-mono text-xs flex items-center justify-between text-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>Database Query Error: {dbError}</span>
              </div>
              <button onClick={() => setDbError(null)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>
          )}

          {/* Server-Side Filter Bar */}
          <div className="bg-[#0d1527] border border-slate-800 rounded-lg p-4 space-y-3 font-mono">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span>Server-Side Filters &amp; Full-Text Search</span>
              </div>
              <button
                onClick={resetDbFilters}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
              {/* Search Bar */}
              <div className="md:col-span-2 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search endpoint, IP, message, actor..."
                  value={dbSearch}
                  onChange={(e) => setDbSearch(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Event Type Dropdown */}
              <div>
                <select
                  value={dbEventType}
                  onChange={(e) => {
                    setDbEventType(e.target.value);
                    setDbPage(1);
                  }}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Event Types</option>
                  {dbMetadata.eventTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source IP Dropdown */}
              <div>
                <select
                  value={dbSourceIp}
                  onChange={(e) => {
                    setDbSourceIp(e.target.value);
                    setDbPage(1);
                  }}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Source IPs</option>
                  {dbMetadata.sourceIps.map((ip) => (
                    <option key={ip} value={ip}>
                      {ip}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Code Dropdown */}
              <div>
                <select
                  value={dbStatusCode}
                  onChange={(e) => {
                    setDbStatusCode(e.target.value);
                    setDbPage(1);
                  }}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All HTTP Codes</option>
                  <option value="200">200 OK</option>
                  <option value="201">201 Created</option>
                  <option value="400">400 Bad Request</option>
                  <option value="401">401 Unauthorized</option>
                  <option value="403">403 Forbidden</option>
                  <option value="404">404 Not Found</option>
                  <option value="429">429 Rate Limited</option>
                  <option value="500">500 Server Error</option>
                </select>
              </div>
            </div>

            {/* Quick Toggle Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60 text-xs">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-slate-100 select-none">
                  <input
                    type="checkbox"
                    checked={dbOnlySuspicious}
                    onChange={(e) => {
                      setDbOnlySuspicious(e.target.checked);
                      setDbPage(1);
                    }}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                  />
                  <span className="flex items-center gap-1 text-red-400">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Only Suspicious Events
                  </span>
                </label>
              </div>

              {/* Sort Order Selector */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Sort by:</span>
                <select
                  value={dbSortField}
                  onChange={(e) => setDbSortField(e.target.value as any)}
                  className="bg-[#070b14] border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs"
                >
                  <option value="timestamp">Timestamp</option>
                  <option value="statusCode">Status Code</option>
                </select>
                <button
                  onClick={() => setDbSortOrder(dbSortOrder === 'asc' ? 'desc' : 'asc')}
                  className="bg-[#070b14] border border-slate-800 rounded px-2 py-1 text-cyan-400 hover:text-cyan-300 text-xs"
                >
                  {dbSortOrder.toUpperCase()}
                </button>
              </div>
            </div>
          </div>

          {/* Database Events Table */}
          <div className="bg-[#0d1527] border border-slate-800 rounded-lg overflow-hidden font-mono shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#070b14] border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp (UTC)</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Source IP</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Endpoint</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Actor / Role</th>
                    <th className="py-2.5 px-3">Dedup Fingerprint</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {isLoadingDb ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" />
                        Fetching rows from Neon PostgreSQL...
                      </td>
                    </tr>
                  ) : dbLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 space-y-2">
                        <Database className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="text-slate-400 font-semibold">No records matched your query filters.</p>
                        <p className="text-slate-500 text-xs">
                          Try resetting filters or click &quot;Load All Attack Scenarios&quot; to populate Neon DB.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    dbLogs.map((log) => {
                      const isSuspicious = log.isSuspicious;
                      return (
                        <tr
                          key={log.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isSuspicious ? 'bg-red-950/10' : ''
                          }`}
                        >
                          {/* Timestamp */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-400">
                            <span title={log.timestamp}>
                              {new Date(log.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                          </td>

                          {/* Event Type */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                isSuspicious
                                  ? 'bg-red-950/70 text-red-300 border-red-500/40'
                                  : 'bg-slate-900 text-slate-300 border-slate-700'
                              }`}
                            >
                              {log.eventType}
                            </span>
                          </td>

                          {/* Source IP */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-cyan-400">
                            {log.sourceIp}
                          </td>

                          {/* Method */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-bold text-slate-200">{log.method}</span>
                          </td>

                          {/* Endpoint */}
                          <td className="py-2.5 px-3 whitespace-nowrap max-w-[200px] truncate text-slate-200" title={log.endpoint}>
                            {log.endpoint}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getStatusBadge(log.statusCode)}`}>
                              {log.statusCode}
                            </span>
                          </td>

                          {/* Actor / Role */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-400">
                            {log.actorId ? (
                              <span>
                                {log.actorId}{' '}
                                {log.actorRole && (
                                  <span className="text-[10px] text-cyan-400">({log.actorRole})</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-600">anon</span>
                            )}
                          </td>

                          {/* Dedup Fingerprint */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-500" title={log.dedupId}>
                            {log.dedupId.slice(0, 10)}...
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-right">
                            <button
                              onClick={() => setActiveEvent(log as any)}
                              className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-950/50 rounded"
                              title="Inspect Full Database Record"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Server-Side Pagination Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#070b14] border-t border-slate-800 text-xs">
              <div className="flex items-center gap-3 text-slate-400">
                <span>
                  Showing <strong className="text-cyan-400">{dbLogs.length}</strong> of{' '}
                  <strong className="text-slate-200">{dbPagination.total}</strong> events
                </span>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1.5">
                  Per page:
                  <select
                    value={dbLimit}
                    onChange={(e) => {
                      setDbLimit(Number(e.target.value));
                      setDbPage(1);
                    }}
                    className="bg-[#0d1527] border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 text-xs"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDbPage(Math.max(1, dbPage - 1))}
                  disabled={dbPage <= 1 || isLoadingDb}
                  className="p-1.5 rounded border border-slate-800 bg-[#0d1527] text-slate-300 hover:border-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-slate-300 px-2 font-mono">
                  Page <strong className="text-cyan-400">{dbPagination.page}</strong> of{' '}
                  <strong className="text-slate-200">{dbPagination.totalPages}</strong>
                </span>
                <button
                  onClick={() => setDbPage(Math.min(dbPagination.totalPages, dbPage + 1))}
                  disabled={dbPage >= dbPagination.totalPages || isLoadingDb}
                  className="p-1.5 rounded border border-slate-800 bg-[#0d1527] text-slate-300 hover:border-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: SYNTHETIC DATASET INSPECTOR & CONTRACT HUB             */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'datasets' && (
        <div className="space-y-4">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1527] border border-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 overflow-x-auto text-xs font-mono">
              <span className="text-slate-500 flex items-center gap-1 flex-shrink-0">
                <Database className="w-3.5 h-3.5 text-cyan-500" />
                Dataset:
              </span>
              {(Object.keys(DATASET_META) as DatasetCategory[]).map((cat) => {
                const isSelected = selectedDataset === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedDataset(cat);
                      setDatasetPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md border whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-cyan-950/70 border-cyan-500/60 text-cyan-300 font-semibold shadow-sm'
                        : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {DATASET_META[cat].name}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleIngestSingleDataset}
                disabled={isIngestingSingle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60 disabled:opacity-50"
              >
                <UploadCloud className={`w-3.5 h-3.5 text-emerald-400 ${isIngestingSingle ? 'animate-bounce' : ''}`} />
                <span>{isIngestingSingle ? 'Ingesting...' : 'Ingest Active Dataset'}</span>
              </button>

              <button
                onClick={() => setShowContractHub(!showContractHub)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                  showContractHub
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Contract Inspector</span>
              </button>
            </div>
          </div>

          {/* Ingestion Batch Receipt */}
          {singleIngestResult && (
            <div className="bg-[#0b1326] border border-emerald-500/40 rounded-lg p-4 font-mono text-xs space-y-2.5 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-emerald-300">
                    Ingested into Neon PostgreSQL (Audit Batch #{singleIngestResult.batchId.slice(0, 8)})
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    {singleIngestResult.status}
                  </span>
                </div>
                <button onClick={() => setSingleIngestResult(null)} className="text-slate-400 hover:text-slate-200">
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#070b14] p-2.5 rounded border border-slate-800/80">
                <div>
                  <span className="text-slate-500 text-[11px] block">Total Received:</span>
                  <span className="text-slate-200 font-bold">{singleIngestResult.totalRecords}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Accepted &amp; Persisted:</span>
                  <span className="text-emerald-400 font-bold">{singleIngestResult.acceptedCount}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Duplicate Hashes Ignored:</span>
                  <span className="text-cyan-400 font-bold">{singleIngestResult.duplicateCount}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Malformed / Rejected:</span>
                  <span className="text-red-400 font-bold">{singleIngestResult.rejectedCount}</span>
                </div>
              </div>
            </div>
          )}

          {singleIngestError && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-lg p-3 font-mono text-xs flex items-center justify-between text-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>Ingestion error: {singleIngestError}</span>
              </div>
              <button onClick={() => setSingleIngestError(null)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>
          )}

          {/* Collapsible Schema & Contract Hub */}
          {showContractHub && (
            <div className="bg-[#0b1326] border border-cyan-500/30 rounded-lg p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    RFC-2026-WS-LOG Contract Validation Hub
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live Zod schema enforcement against {DATASET_META[selectedDataset].name}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded">
                    Passed: <strong>{validationSummary.validCount}</strong>
                  </span>
                  {validationSummary.invalidCount > 0 && (
                    <span className="text-xs font-mono text-red-400 bg-red-950/60 border border-red-500/30 px-2.5 py-1 rounded">
                      Rejected: <strong>{validationSummary.invalidCount}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Malformed Error Diagnostics */}
              {validationSummary.errors.length > 0 && (
                <div className="space-y-2 bg-[#070b14] p-3 rounded border border-red-500/30">
                  <span className="text-xs font-semibold text-red-300 block">
                    Schema Rejection Diagnostics:
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {validationSummary.errors.map((err, i) => (
                      <div key={i} className="text-xs font-mono bg-red-950/20 p-2 rounded border border-red-500/20 flex flex-col gap-1">
                        <span className="text-red-400 font-bold">{err.testCase || `Record #${err.index + 1}`}</span>
                        <span className="text-slate-300">{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Synthetic Records Table */}
          <div className="bg-[#0d1527] border border-slate-800 rounded-lg overflow-hidden font-mono shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#070b14] border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp (UTC)</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Source IP</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Endpoint</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Actor / Role</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {paginatedDatasetEvents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No synthetic events found in this view.
                      </td>
                    </tr>
                  ) : (
                    paginatedDatasetEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(evt.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                            evt.is_suspicious ? 'bg-red-950/70 text-red-300 border-red-500/40' : 'bg-slate-900 text-slate-300 border-slate-700'
                          }`}>
                            {evt.event_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-cyan-400">{evt.source_ip}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-200">{evt.method}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap max-w-[200px] truncate text-slate-200">{evt.endpoint}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getStatusBadge(evt.status_code)}`}>
                            {evt.status_code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-400">
                          {evt.actor_id || <span className="text-slate-600">anon</span>}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-right">
                          <button
                            onClick={() => setActiveEvent(evt)}
                            className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-950/50 rounded"
                            title="Inspect Event"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Synthetic Pagination Bar */}
            <div className="flex items-center justify-between p-3 bg-[#070b14] border-t border-slate-800 text-xs">
              <span className="text-slate-400">
                Total Events in Dataset: <strong className="text-cyan-400">{baseRecords.length}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDatasetPage(Math.max(1, datasetPage - 1))}
                  disabled={datasetPage <= 1}
                  className="p-1.5 rounded border border-slate-800 bg-[#0d1527] text-slate-300 hover:border-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-slate-300 px-2 font-mono">
                  Page <strong className="text-cyan-400">{datasetPage}</strong> of{' '}
                  <strong className="text-slate-200">{totalDatasetPages}</strong>
                </span>
                <button
                  onClick={() => setDatasetPage(Math.min(totalDatasetPages, datasetPage + 1))}
                  disabled={datasetPage >= totalDatasetPages}
                  className="p-1.5 rounded border border-slate-800 bg-[#0d1527] text-slate-300 hover:border-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DETAIL DRAWER FOR ACTIVE RECORD (LIVE DB OR SYNTHETIC)       */}
      {/* ------------------------------------------------------------- */}
      {activeEvent && (
        <DetailDrawer
          title="Telemetry Event Forensic Inspection"
          subtitle={`Event Record #${String((activeEvent as any).id || (activeEvent as any).requestId || '').slice(0, 16)}`}
          isOpen={!!activeEvent}
          onClose={() => setActiveEvent(null)}
          data={activeEvent as any}
        >
          <div className="space-y-4 font-mono text-xs">
            {/* Dedup Fingerprint Header */}
            <div className="bg-[#070b14] border border-cyan-500/30 rounded p-3 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Deterministic SHA-256 Deduplication Fingerprint:
              </span>
              <span className="text-cyan-400 text-[11px] break-all select-all font-bold">
                {(activeEvent as any).dedupId || (activeEvent as any).dedup_id || generateDedupKey(activeEvent as any)}
              </span>
            </div>

            {/* Core Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 bg-[#070b14] p-3 rounded border border-slate-800">
              <div>
                <span className="text-slate-500 text-[11px] block">Timestamp:</span>
                <span className="text-slate-200 font-semibold">{activeEvent.timestamp}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Event Type:</span>
                <span className="text-cyan-400 font-semibold">
                  {(activeEvent as any).eventType || (activeEvent as any).event_type}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Source IP:</span>
                <span className="text-slate-200 font-semibold">
                  {(activeEvent as any).sourceIp || (activeEvent as any).source_ip}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">HTTP Response:</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getStatusBadge((activeEvent as any).statusCode || (activeEvent as any).status_code)}`}>
                  {(activeEvent as any).statusCode || (activeEvent as any).status_code}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">HTTP Method &amp; Endpoint:</span>
                <span className="text-slate-200 font-semibold">
                  {activeEvent.method} {activeEvent.endpoint}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Request ID:</span>
                <span className="text-slate-200 font-semibold">
                  {(activeEvent as any).requestId || (activeEvent as any).request_id}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Actor ID / Role:</span>
                <span className="text-slate-200 font-semibold">
                  {((activeEvent as any).actorId || (activeEvent as any).actor_id) ?? 'Anonymous'}{' '}
                  {((activeEvent as any).actorRole || (activeEvent as any).actor_role) && `(${(activeEvent as any).actorRole || (activeEvent as any).actor_role})`}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Duration:</span>
                <span className="text-slate-200 font-semibold">
                  {(activeEvent as any).durationMs || (activeEvent as any).duration_ms ? `${(activeEvent as any).durationMs || (activeEvent as any).duration_ms} ms` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Message */}
            <div className="bg-[#070b14] p-3 rounded border border-slate-800">
              <span className="text-slate-500 text-[11px] block mb-1">Log Message:</span>
              <p className="text-slate-200 text-xs">{activeEvent.message}</p>
            </div>

            {/* Structured Metadata JSON */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-semibold">Metadata JSON (Clean of Plain Secrets):</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify((activeEvent as any).metadata || {}, null, 2)
                    );
                  }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono"
                >
                  Copy JSON
                </button>
              </div>
              <pre className="bg-[#070b14] border border-slate-800 rounded p-3 text-[11px] text-cyan-300 overflow-x-auto max-h-48 font-mono">
                {JSON.stringify((activeEvent as any).metadata || {}, null, 2)}
              </pre>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
};
