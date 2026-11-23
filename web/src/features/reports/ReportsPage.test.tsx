import { screen, within } from '@testing-library/react';
import { renderPage } from '../../../tests/render';
import { emptyDb } from '../../mocks/db';
import { addMonths, currentMonth } from '../../lib/dates';
import { Route, Routes, useLocation } from 'react-router';
import { ReportsPage } from './ReportsPage';

const THIS = currentMonth();
const LAST = addMonths(THIS, -1);

function data() {
  const d = emptyDb();
  d.projects = [{ projectId: 'p-001', name: '受発注システム改修', plannedHours: 100, startDate: '2026-01-01', endDate: '2099-12-31', status: 'ACTIVE' }];
  const r = (date: string, hours: number) => ({ userId: 'u-1', date, projectId: 'p-001', projectName: '受発注システム改修', hours, note: '', updatedAt: '' });
  d.reports = [r(`${THIS}-01`, 8), r(`${THIS}-02`, 6.5), r(`${LAST}-15`, 7), { ...r(`${THIS}-01`, 3), userId: 'u-2' }];
  return d;
}

test('今月の自分の日報を、日ごとの合計と月の合計で見られる', async () => {
  await renderPage(<ReportsPage />, { data: data() });
  const table = await screen.findByRole('table', { name: '日報の一覧' });
  expect(await within(table).findAllByRole('row')).toHaveLength(3); // 見出し + 2日分(他人の分は出ない)
  expect(screen.getByText('月の合計 14.5 時間')).toBeInTheDocument();
});

test('前の月に切り替えられる', async () => {
  const { user } = await renderPage(<ReportsPage />, { data: data() });
  await screen.findByText('月の合計 14.5 時間');
  await user.click(screen.getByRole('button', { name: '前の月' }));
  expect(await screen.findByText('月の合計 7 時間')).toBeInTheDocument();
});

test('日付を押すと、その日の「日報入力」を開く', async () => {
  const { user } = await renderPage(
    <Routes>
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/" element={<LocationProbe />} />
    </Routes>,
    { data: data(), route: '/reports' },
  );
  const table = await screen.findByRole('table', { name: '日報の一覧' });
  await user.click(await within(table).findByRole('link', { name: /^.+\/2\(/ }));
  expect(await screen.findByTestId('location')).toHaveTextContent(`?date=${THIS}-02`);
});

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.search}</p>;
}
