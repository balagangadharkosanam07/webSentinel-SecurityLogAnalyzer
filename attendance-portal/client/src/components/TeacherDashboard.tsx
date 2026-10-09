import React, { useState, useEffect } from 'react';
import { portalApi } from '../services/api.js';
import { AttendanceRecord, AttendanceStatus } from '../types/index.js';
import { BookOpen, Calendar, CheckCircle2, Clock, XCircle, Save, AlertCircle, RefreshCw } from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const [selectedCourse, setSelectedCourse] = useState('crs-cs101-001');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Pre-configured students roster
  const studentList = [
    { id: 'usr-student-001', name: 'Alice Johnson', email: 'student@portal.edu' },
    { id: 'usr-student-002', name: 'Bob Smith', email: 'bob@portal.edu' },
    { id: 'usr-student-003', name: 'Charlie Davis', email: 'charlie@portal.edu' },
  ];

  const loadRoster = async () => {
    setLoading(true);
    try {
      const data = await portalApi.getCourseAttendance(selectedCourse);
      setRecords(data || []);
    } catch (err: any) {
      console.error('Failed to load course attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoster();
  }, [selectedCourse]);

  const handleMark = async (studentId: string, status: AttendanceStatus) => {
    setSavingId(studentId);
    setMessage(null);
    try {
      await portalApi.markAttendance({
        studentId,
        courseId: selectedCourse,
        sessionDate,
        status,
      });
      setMessage({
        text: `Attendance saved: ${status.toUpperCase()} recorded for ${studentId}`,
        type: 'success',
      });
      await loadRoster();
    } catch (err: any) {
      setMessage({ text: `Failed to mark attendance: ${err.message}`, type: 'error' });
    } finally {
      setSavingId(null);
    }
  };

  const handleTamperSimulation = async () => {
    setMessage({ text: 'Executing bulk historical modification burst...', type: 'success' });
    try {
      const updates = [
        { recordId: 'att-001', status: 'present' as AttendanceStatus },
        { recordId: 'att-002', status: 'present' as AttendanceStatus },
        { recordId: 'att-003', status: 'present' as AttendanceStatus },
      ];
      await portalApi.bulkUpdateAttendance(updates);
      setMessage({
        text: 'Bulk modification completed. WebSentinel is evaluating tamper frequency (RULE-004).',
        type: 'success',
      });
      await loadRoster();
    } catch (err: any) {
      setMessage({ text: `Bulk modification failed: ${err.message}`, type: 'error' });
    }
  };

  // Helper to get status of student for currently selected session date
  const getStudentStatusForDate = (studentId: string): AttendanceStatus | 'unmarked' => {
    const match = records.find(
      (r) => r.studentId === studentId && r.sessionDate === sessionDate
    );
    return match ? match.status : 'unmarked';
  };

  return (
    <div className="space-y-6">
      {/* Teacher Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-lg shadow-indigo-900/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-blue-200 text-xs font-semibold uppercase tracking-wider">
              Faculty Instructor Portal
            </span>
            <h1 className="text-2xl font-bold mt-1">Class Attendance Roster & Grading</h1>
            <p className="text-blue-100 text-sm mt-1 max-w-xl">
              Conduct roll calls, mark daily attendance status, and maintain tamper-evident audit trails monitored by WebSentinel SOC.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadRoster}
              disabled={loading}
              className="inline-flex items-center px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold backdrop-blur-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Roster
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
          <div>
            <label className="block text-xs font-medium text-blue-100 mb-1">
              Select Course Module
            </label>
            <div className="relative">
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="crs-cs101-001">CS101: Introduction to Computer Security</option>
                <option value="crs-cs202-001">CS202: Relational Database Engineering</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-blue-100 mb-1">
              Session Lecture Date
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Roster Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Enrolled Student Roster</h2>
            <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
              Session: {sessionDate}
            </span>
          </div>
          <button
            onClick={handleTamperSimulation}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
            title="Bulk modify records to test RULE-004 correlation"
          >
            ⚡ Test Bulk Tamper Modification
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {studentList.map((student) => {
            const currentStatus = getStudentStatusForDate(student.id);
            const isSaving = savingId === student.id;

            return (
              <div
                key={student.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 border border-slate-200">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{student.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{student.email}</p>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {student.id}</span>
                  </div>
                </div>

                {/* Status Indicator & Mark Buttons */}
                <div className="flex items-center space-x-2">
                  <div className="mr-2">
                    {currentStatus === 'present' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Present
                      </span>
                    )}
                    {currentStatus === 'late' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        Late
                      </span>
                    )}
                    {currentStatus === 'absent' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                        Absent
                      </span>
                    )}
                    {currentStatus === 'unmarked' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                        Unrecorded
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleMark(student.id, 'present')}
                    disabled={isSaving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                      currentStatus === 'present'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Present</span>
                  </button>

                  <button
                    onClick={() => handleMark(student.id, 'late')}
                    disabled={isSaving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                      currentStatus === 'late'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Late</span>
                  </button>

                  <button
                    onClick={() => handleMark(student.id, 'absent')}
                    disabled={isSaving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                      currentStatus === 'absent'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Absent</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
