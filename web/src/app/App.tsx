import { Route, Routes } from 'react-router';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProjectDetailPage } from '../features/dashboard/ProjectDetailPage';
import { ExportsPage } from '../features/exports/ExportsPage';
import { LoginPage } from '../features/login/LoginPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { EntryPage } from '../features/entry/EntryPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { UsersPage } from '../features/users/UsersPage';
import { Layout } from './Layout';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route index element={<EntryPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="admin/projects" element={<ProjectsPage />} />
        <Route path="admin/users" element={<UsersPage />} />
        <Route path="admin/exports" element={<ExportsPage />} />
        <Route path="admin/settings" element={<SettingsPage />} />
        <Route path="*" element={<p>ページが見つかりません</p>} />
      </Route>
    </Routes>
  );
}
