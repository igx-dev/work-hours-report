import { screen, within } from '@testing-library/react';
import { db, renderPage } from '../../../tests/render';
import { emptyDb } from '../../mocks/db';
import { addMonths, currentMonth, daysInMonth, formatDay } from '../../lib/dates';
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

test('月の全部の日が並び、日報がない日は「未入力」と出る', async () => {
  await renderPage(<ReportsPage />, { data: data() });
  const table = await screen.findByRole('table', { name: '日報の一覧' });
  await within(table).findByText('受発注システム改修 8h');
  const rows = within(table).getAllByRole('row');
  expect(rows).toHaveLength(daysInMonth(THIS).length + 1); // 見出し + その月の日数
  expect(rows[1]).toHaveTextContent('受発注システム改修 8h'); // 1日(他人の分は出ない)
  expect(rows[3]).toHaveTextContent('未入力'); // 3日
  expect(screen.getByText('月の合計 14.5 時間')).toBeInTheDocument();
});

test('前の月に切り替えられる', async () => {
  const { user } = await renderPage(<ReportsPage />, { data: data() });
  await screen.findByText('月の合計 14.5 時間');
  await user.click(screen.getByRole('button', { name: '前の月' }));
  expect(await screen.findByText('月の合計 7 時間')).toBeInTheDocument();
});

test('日報がある日を押すと、その日を編集できる', async () => {
  const { user } = await renderPage(<ReportsPage />, { data: data() });
  const table = await screen.findByRole('table', { name: '日報の一覧' });
  await user.click(await within(table).findByRole('button', { name: formatDay(`${THIS}-02`) }));
  expect(await screen.findByRole('heading', { name: formatDay(`${THIS}-02`) })).toBeInTheDocument();
});

test('「未入力」の日を押すと、その日に新しく追加できる', async () => {
  const { user } = await renderPage(<ReportsPage />, { data: data() });
  const table = await screen.findByRole('table', { name: '日報の一覧' });
  await within(table).findByText('受発注システム改修 8h');
  await user.click(within(table).getByRole('button', { name: formatDay(`${THIS}-03`) }));
  expect(await screen.findByRole('heading', { name: '新規追加' })).toBeInTheDocument();
  await screen.findByRole('option', { name: '受発注システム改修' });
  await user.click(screen.getByRole('button', { name: '追加' }));
  expect(await within(table).findByText('受発注システム改修 8h', { selector: 'tr:nth-child(3) *' })).toBeInTheDocument();
  expect(db.current.reports.some((r) => r.userId === 'u-1' && r.date === `${THIS}-03`)).toBe(true);
});
