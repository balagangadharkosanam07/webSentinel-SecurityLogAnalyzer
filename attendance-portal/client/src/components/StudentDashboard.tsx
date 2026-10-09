import React, { useEffect, useState } from 'react';
import { portalApi } from '../services/api.js';
import { AttendanceRecord } from '../types/index.js';
import { UserCheck, CheckCircle2, Clock, XCircle, Calendar, RefreshCw } from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'present' | 'late' | 'absent'>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await portalApi.getMyAttendance();
      setRecords(data || []);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const total = records.length;
  const presentCount = records.filter((r) => r.status === 'present').length;
  const lateCount = records.filter((r) => r.status === 'late').length;
  const absentCount = records.filter((r) => r.status === 'absent').length;

  const attendanceRate = total > 0 ? Math.round(((presentCount + lateCount * 0.5) / total) * 100) : 100;

  const filteredRecords = records.filter((r) => (filter === 'all' ? true : r.status === filter));

  return (
    <div className="space-y-6">
      {/* Welcome / KPI Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg shadow-emerald-700/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-emerald-200 text-xs font-semibold uppercase tracking-wider">
              Student Attendance Portal
            </span>
            <h1 className="text-2xl font-bold mt-1">Academic Attendance Record</h1>
            <p className="text-emerald-100 text-sm mt-1 max-w-xl">
              Track your lecture attendance, review verified session timestamps, and maintain compliance with academic requirements.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="self-start md:self-auto inline-flex items-center px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold backdrop-blur-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-100">Overall Rate</span>
              <UserCheck className="w-4 h-4 text-emerald-200" />
            </div>
            <p className="text-2xl font-bold mt-1">{attendanceRate}%</p>
            <span className="text-[10px] text-emerald-200">Requirement: &gt;= 75%</span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-100">Present</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-100">{presentCount}</p>
            <span className="text-[10px] text-emerald-200">On time</span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-100">Late</span>
              <Clock className="w-4 h-4 text-amber-300" />
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-200">{lateCount}</p>
            <span className="text-[10px] text-emerald-200">Grace period</span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-100">Absent</span>
              <XCircle className="w-4 h-4 text-rose-300" />
            </div>
            <p className="text-2xl font-bold mt-1 text-rose-200">{absentCount}</p>
            <span className="text-[10px] text-emerald-200">Missed lectures</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Attendance Log History</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {filteredRecords.length} records
            </span>
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
            {(['all', 'present', 'late', 'absent'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                  filter === mode
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <p className="text-sm">Retrieving verified attendance records from PostgreSQL...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No attendance records found</p>
            <p className="text-xs text-slate-400 mt-1">No sessions recorded matching this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Record ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      {item.sessionDate}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {item.courseCode || 'CS101'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.courseName || 'Computer Science Lecture'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {item.status === 'present' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                          Present
                        </span>
                      )}
                      {item.status === 'late' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 mr-1 text-amber-600" />
                          Late
                        </span>
                      )}
                      {item.status === 'absent' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                          <XCircle className="w-3 h-3 mr-1 text-rose-600" />
                          Absent
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      Verified by <span className="font-mono">{item.markedBy.slice(0, 14)}...</span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-400">
                      {item.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
