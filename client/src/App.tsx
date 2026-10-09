import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { OverviewPage } from './pages/Overview/OverviewPage';
import { LogExplorerPage } from './pages/LogExplorer/LogExplorerPage';
import { ThreatAlertsPage } from './pages/ThreatAlerts/ThreatAlertsPage';
import { IncidentsPage } from './pages/Incidents/IncidentsPage';
import { RiskAnalyticsPage } from './pages/RiskAnalytics/RiskAnalyticsPage';
import { ReportsPage } from './pages/Reports/ReportsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="logs" element={<LogExplorerPage />} />
          <Route path="alerts" element={<ThreatAlertsPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="analytics" element={<RiskAnalyticsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
