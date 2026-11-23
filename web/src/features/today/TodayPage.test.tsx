import { screen, within } from '@testing-library/react';
import { db, renderPage } from '../../../tests/render';
import { emptyDb } from '../../mocks/db';
import { addMonths, currentMonth, formatDay, todayIso } from '../../lib/dates';
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

describe('前回と同じ内容にする', () => {
  const LAST_MONTH_15 = `${addMonths(currentMonth(), -1)}-15`;
  const source = (projectId: string, projectName: string, hours: number, note = '') => ({
    userId: 'u-1', date: LAST_MONTH_15, projectId, projectName, hours, note, updatedAt: '',
  });

  test('押す前に、どの日の何を写すのかが見える', async () => {
    const data = withProjects();
    data.reports = [source('p-001', '受発注システム改修', 5), source('p-002', '社内ポータル', 3)];
    await renderPage(<TodayPage />, { data });
    expect(
      await screen.findByText(`${formatDay(LAST_MONTH_15)} の内容(受発注システム改修 5時間、社内ポータル 3時間)を写します`),
    ).toBeInTheDocument();
  });

  test('押すと写されて、時間だけ直せる状態になる', async () => {
    const data = withProjects();
    data.reports = [source('p-001', '受発注システム改修', 6, '設計')];
    const { user } = await renderPage(<TodayPage />, { data });
    await screen.findByText(/を写します$/); // 写す元を読み込むまでは押せない
    await user.click(screen.getByRole('button', { name: '前回と同じ内容にする' }));
    expect(await screen.findByText(`${formatDay(LAST_MONTH_15)} の内容を写しました`)).toBeInTheDocument();
    expect(screen.getByText('合計 6 時間')).toBeInTheDocument();
  });

  test('今日にもう日報がある時は、上書きしてよいか確かめる', async () => {
    const data = withProjects();
    data.reports = [
      source('p-001', '受発注システム改修', 6),
      { ...source('p-002', '社内ポータル', 2), date: TODAY },
    ];
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = await renderPage(<TodayPage />, { data });
    await screen.findByText(/を写します$/);
    await user.click(screen.getByRole('button', { name: '前回と同じ内容にする' }));
    expect(confirm).toHaveBeenCalledWith('今日の日報を、写す内容で置き換えます。よろしいですか?');
    expect(screen.getByText('合計 2 時間')).toBeInTheDocument(); // やめたので変わらない
    confirm.mockRestore();
  });

  test('写せる日報がなければ、ボタンは押せない', async () => {
    await renderPage(<TodayPage />, { data: withProjects() });
    expect(await screen.findByText('写せる日報がまだありません')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前回と同じ内容にする' })).toBeDisabled();
  });
});

test('一覧から削除できる', async () => {
  const data = withProjects();
  data.reports = [{ userId: 'u-1', date: TODAY, projectId: 'p-001', projectName: '受発注システム改修', hours: 2, note: '', updatedAt: '' }];
  const { user } = await renderPage(<TodayPage />, { data });
  await user.click(await screen.findByRole('button', { name: '受発注システム改修 を削除' }));
  expect(await screen.findByText('まだ登録がありません')).toBeInTheDocument();
});
