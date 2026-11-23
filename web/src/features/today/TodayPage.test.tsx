import { screen, within } from '@testing-library/react';
import { db, renderPage } from '../../../tests/render';
import { emptyDb } from '../../mocks/db';
import { todayIso } from '../../lib/dates';
import { TodayPage } from './TodayPage';

const TODAY = todayIso();

function withProjects() {
  const data = emptyDb();
  data.projects = [
    { projectId: 'p-001', name: '受発注システム改修', plannedHours: 100, startDate: '2026-01-01', endDate: '2027-12-31', status: 'ACTIVE' },
    { projectId: 'p-002', name: '社内ポータル', plannedHours: 40, startDate: '2026-01-01', endDate: '2027-12-31', status: 'ACTIVE' },
    { projectId: 'p-999', name: '旧サイト改修', plannedHours: 10, startDate: '2026-01-01', endDate: '2026-06-30', status: 'CLOSED' },
  ];
  return data;
}

test('進行中のプロジェクトだけを選べる', async () => {
  await renderPage(<TodayPage />, { data: withProjects() });
  const select = await screen.findByLabelText('プロジェクト');
  await screen.findByRole('option', { name: '受発注システム改修' });
  expect(within(select).queryByRole('option', { name: '旧サイト改修' })).toBeNull();
});

test('時間を入れて保存すると、今日の一覧と合計に出る', async () => {
  const { user } = await renderPage(<TodayPage />, { data: withProjects() });
  await screen.findByRole('option', { name: '社内ポータル' });
  await user.selectOptions(screen.getByLabelText('プロジェクト'), 'p-002');
  await user.clear(screen.getByLabelText('時間'));
  await user.type(screen.getByLabelText('時間'), '3.5');
  await user.type(screen.getByLabelText('メモ'), 'レビュー');
  await user.click(screen.getByRole('button', { name: '保存' }));

  const list = await screen.findByRole('list', { name: '今日の日報' });
  expect(await within(list).findByText('社内ポータル')).toBeInTheDocument();
  expect(screen.getByText('合計 3.5 時間')).toBeInTheDocument();
  expect(db.current.reports).toHaveLength(1);
});

test('±ボタンで15分ずつ変えられる', async () => {
  const { user } = await renderPage(<TodayPage />, { data: withProjects() });
  const hours = await screen.findByLabelText('時間');
  expect(hours).toHaveValue(8);
  await user.click(screen.getByRole('button', { name: '15分減らす' }));
  expect(hours).toHaveValue(7.75);
  await user.click(screen.getByRole('button', { name: '15分増やす' }));
  await user.click(screen.getByRole('button', { name: '15分増やす' }));
  expect(hours).toHaveValue(8.25);
});

test('15分単位でない時間は、送る前にエラーを出す', async () => {
  const { user } = await renderPage(<TodayPage />, { data: withProjects() });
  await screen.findByRole('option', { name: '社内ポータル' });
  await user.clear(screen.getByLabelText('時間'));
  await user.type(screen.getByLabelText('時間'), '1.1');
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('15分単位で入力してください');
  expect(db.current.reports).toHaveLength(0);
});

test('1日の合計が24時間を超えると、サーバーのエラーを出す', async () => {
  const data = withProjects();
  data.reports = [{ userId: 'u-1', date: TODAY, projectId: 'p-001', projectName: '受発注システム改修', hours: 20, note: '', updatedAt: '' }];
  const { user } = await renderPage(<TodayPage />, { data });
  await screen.findByText('合計 20 時間');
  await user.selectOptions(screen.getByLabelText('プロジェクト'), 'p-002');
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('1日の合計が24時間を超えます');
});

test('「前日と同じ」で、直前に出した日の日報を複製できる', async () => {
  const data = withProjects();
  data.reports = [{ userId: 'u-1', date: '2026-01-05', projectId: 'p-001', projectName: '受発注システム改修', hours: 6, note: '設計', updatedAt: '' }];
  const { user } = await renderPage(<TodayPage />, { data });
  await user.click(await screen.findByRole('button', { name: '前日と同じ' }));
  expect(await screen.findByText('1/5(月) の内容を複製しました')).toBeInTheDocument();
  expect(screen.getByText('合計 6 時間')).toBeInTheDocument();
});

test('一覧から削除できる', async () => {
  const data = withProjects();
  data.reports = [{ userId: 'u-1', date: TODAY, projectId: 'p-001', projectName: '受発注システム改修', hours: 2, note: '', updatedAt: '' }];
  const { user } = await renderPage(<TodayPage />, { data });
  await user.click(await screen.findByRole('button', { name: '受発注システム改修 を削除' }));
  expect(await screen.findByText('まだ登録がありません')).toBeInTheDocument();
});
