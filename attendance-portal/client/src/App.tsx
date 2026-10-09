import React, { useState, useEffect } from 'react';
import { User } from './types/index.js';
import { authStorage, portalApi } from './services/api.js';
import { LoginPage } from './pages/LoginPage.js';
import { Navbar } from './components/Navbar.js';
import { StudentDashboard } from './components/StudentDashboard.js';
import { TeacherDashboard } from './components/TeacherDashboard.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { CoursesCatalog } from './components/CoursesCatalog.js';
import { SecurityConsoleModal } from './components/SecurityConsoleModal.js';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => authStorage.getUser());
  const [activeTab, setActiveTab] = useState<string>('attendance');
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.role === 'student') setActiveTab('attendance');
      else if (user.role === 'teacher') setActiveTab('roster');
      else if (user.role === 'admin') setActiveTab('admin');

      // Optionally refresh user profile in background
      portalApi.getMe().then(setUser).catch(() => {
        // If token expired, clear auth
        authStorage.logout();
        setUser(null);
      });
    }
  }, [user?.role]);

  const handleLogout = () => {
    authStorage.logout();
    setUser(null);
  };

  if (!user) {
    return <LoginPage onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenSecurityConsole={() => setIsSecurityModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'attendance' && <StudentDashboard />}
        {activeTab === 'roster' && <TeacherDashboard />}
        {activeTab === 'admin' && <AdminDashboard />}
        {activeTab === 'courses' && <CoursesCatalog />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        EduTrack Attendance Portal &bull; Port 3001 &bull; Connected to WebSentinel SOC Platform (Port 3000)
      </footer>

      <SecurityConsoleModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />
    </div>
  );
};
