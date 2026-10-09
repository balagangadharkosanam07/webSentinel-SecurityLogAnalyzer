import React, { useEffect, useState } from 'react';
import { portalApi } from '../services/api.js';
import { Course } from '../types/index.js';
import { BookOpen, Search, User, ShieldAlert } from 'lucide-react';

export const CoursesCatalog: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchCourses = async (query = '') => {
    setLoading(true);
    try {
      const data = query.trim()
        ? await portalApi.searchCourses(query)
        : await portalApi.getCourses();
      setCourses(data || []);
    } catch (err) {
      console.error('Course query error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCourses(searchQuery);
  };

  const handleTestSqliSearch = () => {
    const sqliQuery = "' OR '1'='1";
    setSearchQuery(sqliQuery);
    fetchCourses(sqliQuery);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-800 rounded-2xl p-6 text-white shadow-lg shadow-teal-900/10">
        <h1 className="text-2xl font-bold">Academic Course Catalog</h1>
        <p className="text-teal-100 text-sm mt-1 max-w-xl">
          Search registered academic modules and view course coordinators. Monitored for parameter tampering and SQL injection probes.
        </p>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-col sm:flex-row gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by course code (CS101) or title..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900/60 border border-white/20 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-sm transition-colors shadow-sm"
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleTestSqliSearch}
            className="px-3.5 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition-colors"
            title="Inject ' OR '1'='1 probe to trigger RULE-006"
          >
            <ShieldAlert className="w-3.5 h-3.5 mr-1 text-rose-300" />
            Inject SQLi Probe
          </button>
        </form>
      </div>

      {/* Courses List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 p-12 text-center text-slate-400">
            Searching course catalog...
          </div>
        ) : courses.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            No courses found matching "{searchQuery}"
          </div>
        ) : (
          courses.map((course) => (
            <div
              key={course.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-mono">
                    {course.code}
                  </span>
                  <BookOpen className="w-4 h-4 text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-2">{course.name}</h3>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Instructor: <strong className="text-slate-700">{course.teacherName || 'Faculty Lead'}</strong></span>
                </div>
                <span className="font-mono text-slate-400 text-[10px]">ID: {course.id}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
