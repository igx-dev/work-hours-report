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

const todayReport = (projectId: string, projectName: string, hours: number, note = '') => ({
  userId: 'u-1', date: TODAY, projectId, projectName, hours, note, updatedAt: '',
});

test('見出しは「今日の日報」', async () => {
  await renderPage(<TodayPage />, { data: withProjects() });
  expect(screen.getByRole('heading', { level: 1, name: '今日の日報' })).toBeInTheDocument();
});

describe('新規追加', () => {
  test('プルダウンには、進行中で今日まだ登録していないプロジェクトだけが出る', async () => {
    const data = withProjects();
    data.reports = [todayReport('p-001', '受発注システム改修', 3)];
    await renderPage(<TodayPage />, { data });
    const select = await screen.findByLabelText('プロジェクト');
    await within(select).findByRole('option', { name: '社内ポータル' });
    expect(within(select).queryByRole('option', { name: '受発注システム改修' })).toBeNull();
    expect(within(select).queryByRole('option', { name: '旧サイト改修' })).toBeNull();
  });

  test('時間を入れて追加すると、左の一覧と合計に出る', async () => {
    const { user } = await renderPage(<TodayPage />, { data: withProjects() });
    await screen.findByRole('option', { name: '社内ポータル' });
    await user.selectOptions(screen.getByLabelText('プロジェクト'), 'p-002');
    await user.clear(screen.getByLabelText('時間'));
    await user.type(screen.getByLabelText('時間'), '3.5');
    await user.type(screen.getByLabelText('メモ'), 'レビュー');
    await user.click(screen.getByRole('button', { name: '追加' }));

    const list = await screen.findByRole('list', { name: '登録済みの日報' });
    expect(await within(list).findByText('社内ポータル')).toBeInTheDocument();
    expect(screen.getByText('合計 3.5 時間')).toBeInTheDocument();
    expect(db.current.reports).toHaveLength(1);
  });

  test('全部のプロジェクトを登録済みなら、そう伝えて追加できない', async () => {
    const data = withProjects();
    data.reports = [todayReport('p-001', '受発注システム改修', 3), todayReport('p-002', '社内ポータル', 2)];
    await renderPage(<TodayPage />, { data });
    expect(await screen.findByText('進行中のプロジェクトは、すべて登録済みです')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '追加' })).toBeNull();
  });

  test('編集中に「新規追加」を押すと、新しく入力できる', async () => {
    const data = withProjects();
    data.reports = [todayReport('p-001', '受発注システム改修', 3, '設計')];
    const { user } = await renderPage(<TodayPage />, { data });
    await user.click(await screen.findByRole('button', { name: /受発注システム改修/ }));
    expect(await screen.findByRole('heading', { name: '編集' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '＋ 新規追加' }));
    expect(screen.getByRole('heading', { name: '新規追加' })).toBeInTheDocument();
    expect(screen.getByLabelText('時間')).toHaveValue(8);
    expect(screen.getByLabelText('メモ')).toHaveValue('');
  });
});

describe('編集', () => {
  test('左で登録済みのものを押すと、右にその内容が入る(プロジェクトは変えられない)', async () => {
    const data = withProjects();
    data.reports = [todayReport('p-001', '受発注システム改修', 3, '設計')];
    const { user } = await renderPage(<TodayPage />, { data });
    await user.click(await screen.findByRole('button', { name: /受発注システム改修/ }));
    const form = await screen.findByRole('form', { name: '編集' });
    expect(within(form).getByText('受発注システム改修')).toBeInTheDocument();
    expect(within(form).queryByLabelText('プロジェクト')).toBeNull();
    expect(within(form).getByLabelText('時間')).toHaveValue(3);
    expect(within(form).getByLabelText('メモ')).toHaveValue('設計');
  });

  test('時間を直して保存すると、上書きされる', async () => {
    const data = withProjects();
    data.reports = [todayReport('p-001', '受発注システム改修', 3)];
    const { user } = await renderPage(<TodayPage />, { data });
    await user.click(await screen.findByRole('button', { name: /受発注システム改修/ }));
    await user.click(screen.getByRole('button', { name: '15分増やす' }));
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('合計 3.25 時間')).toBeInTheDocument();
    expect(db.current.reports.map((r) => r.hours)).toEqual([3.25]);
  });

  test('編集中の日報を削除できる', async () => {
    const data = withProjects();
    data.reports = [todayReport('p-001', '受発注システム改修', 2)];
    const { user } = await renderPage(<TodayPage />, { data });
    await user.click(await screen.findByRole('button', { name: /受発注システム改修/ }));
    await user.click(screen.getByRole('button', { name: 'この日報を削除' }));
    expect(await screen.findByText('まだ登録がありません')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '新規追加' })).toBeInTheDocument();
  });
});

describe('時間の入力', () => {
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
    await user.click(screen.getByRole('button', { name: '追加' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('15分単位で入力してください');
    expect(db.current.reports).toHaveLength(0);
  });

  test('1日の合計が24時間を超えると、サーバーのエラーを出す', async () => {
    const data = withProjects();
    data.reports = [todayReport('p-001', '受発注システム改修', 20)];
    const { user } = await renderPage(<TodayPage />, { data });
    await screen.findByText('合計 20 時間');
    await screen.findByRole('option', { name: '社内ポータル' });
    await user.click(screen.getByRole('button', { name: '追加' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('1日の合計が24時間を超えます');
  });
});
