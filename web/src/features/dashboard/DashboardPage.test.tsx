import { screen, within } from '@testing-library/react';
import { renderPage } from '../../../tests/render';
import { emptyDb } from '../../mocks/db';
import { currentMonth } from '../../lib/dates';
import { DashboardPage } from './DashboardPage';
import { ProjectDetailPage } from './ProjectDetailPage';
import { Route, Routes } from 'react-router';

const M = currentMonth();

function data() {
  const d = emptyDb();
  d.projects = [
    { projectId: 'p-001', name: '受発注システム改修', plannedHours: 20, startDate: '2026-01-01', endDate: '2099-12-31', status: 'ACTIVE' },
    { projectId: 'p-002', name: '社内ポータル', plannedHours: 100, startDate: '2026-01-01', endDate: '2099-12-31', status: 'ACTIVE' },
  ];
  const r = (userId: string, projectId: string, hours: number) => ({ userId, date: `${M}-01`, projectId, projectName: '', hours, note: '', updatedAt: '' });
  d.reports = [r('u-1', 'p-001', 8), r('u-2', 'p-001', 16), r('u-1', 'p-002', 10)];
  return d;
}

test('予定と実績を、グラフの下の表でも読める', async () => {
  await renderPage(<DashboardPage />, { email: 'admin@example.com', data: data() });
  const table = await screen.findByRole('table', { name: '予定と実績' });
  const rows = await within(table).findAllByRole('row');
  expect(rows[1]).toHaveTextContent('受発注システム改修');
  expect(rows[1]).toHaveTextContent('24');
  expect(rows[1]).toHaveTextContent('120%');
  expect(rows[2]).toHaveTextContent('10%');
});

test('予定を超えたプロジェクトには印が付く', async () => {
  await renderPage(<DashboardPage />, { email: 'admin@example.com', data: data() });
  expect(await screen.findByText('予定超過')).toBeInTheDocument();
  expect(screen.getAllByText('予定超過')).toHaveLength(1);
});

test('プロジェクト詳細では、メンバー別の内訳が表で読める', async () => {
  await renderPage(
    <Routes>
      <Route path="/projects/:id" element={<ProjectDetailPage />} />
    </Routes>,
    { email: 'admin@example.com', data: data(), route: '/projects/p-001' },
  );
  expect(await screen.findByRole('heading', { name: '受発注システム改修' })).toBeInTheDocument();
  const table = await screen.findByRole('table', { name: 'メンバー別の内訳' });
  expect(within(table).getByText('佐藤 次郎')).toBeInTheDocument();
  expect(within(table).getByText('16')).toBeInTheDocument();
});
