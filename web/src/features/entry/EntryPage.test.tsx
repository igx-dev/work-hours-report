import { fireEvent, screen, within } from '@testing-library/react';
import { db, renderPage } from '../../../tests/render';
import { emptyDb } from '../../mocks/db';
import { formatDay, todayIso } from '../../lib/dates';
import { Route, Routes } from 'react-router';
import { EntryPage } from './EntryPage';

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

describe('日付', () => {
  test('見出しは「日報入力」で、日付は最初は今日', async () => {
    await renderPage(<EntryPage />, { data: withProjects() });
    expect(screen.getByRole('heading', { level: 1, name: '日報入力' })).toBeInTheDocument();
    expect(screen.getByLabelText('日付')).toHaveValue(TODAY);
  });

  test('日報を出していない過去の日を選んで、追加できる', async () => {
    const { user } = await renderPage(<EntryPage />, { data: withProjects() });
    // 日付の欄はカレンダーから選ぶので、選び終わった値が一度に入る形で試す
    fireEvent.change(screen.getByLabelText('日付'), { target: { value: '2026-11-02' } });
    expect(await screen.findByRole('heading', { name: formatDay('2026-11-02') })).toBeInTheDocument();
    await screen.findByRole('option', { name: '社内ポータル' });
    await user.click(screen.getByRole('button', { name: '追加' }));
    await screen.findByText('合計 8 時間');
    expect(db.current.reports[0].date).toBe('2026-11-02');
  });

  test('「前の日」で1日戻れる', async () => {
    const { user } = await renderPage(<EntryPage />, { data: withProjects(), route: '/?date=2026-11-02' });
    await user.click(screen.getByRole('button', { name: '前の日' }));
    expect(screen.getByLabelText('日付')).toHaveValue('2026-11-01');
  });

  test('「今日」ボタンで今日に戻れる。今日を開いている時は押せない', async () => {
    const { user } = await renderPage(<EntryPage />, { data: withProjects(), route: '/?date=2026-10-15' });
    await user.click(screen.getByRole('button', { name: '今日' }));
    expect(screen.getByLabelText('日付')).toHaveValue(TODAY);
    expect(screen.getByRole('button', { name: '今日' })).toBeDisabled();
  });

  test('URL の ?date= で日付を指定して開ける', async () => {
    await renderPage(
      <Routes>
        <Route path="/" element={<EntryPage />} />
      </Routes>,
      { data: withProjects(), route: '/?date=2026-10-15' },
    );
    expect(screen.getByLabelText('日付')).toHaveValue('2026-10-15');
  });
});

describe('新規追加', () => {
  test('プルダウンには、進行中で今日まだ登録していないプロジェクトだけが出る', async () => {
    const data = withProjects();
    data.reports = [todayReport('p-001', '受発注システム改修', 3)];
    await renderPage(<EntryPage />, { data });
    const select = await screen.findByLabelText('プロジェクト');
    await within(select).findByRole('option', { name: '社内ポータル' });
    expect(within(select).queryByRole('option', { name: '受発注システム改修' })).toBeNull();
    expect(within(select).queryByRole('option', { name: '旧サイト改修' })).toBeNull();
  });

  test('時間を入れて追加すると、左の一覧と合計に出る', async () => {
    const { user } = await renderPage(<EntryPage />, { data: withProjects() });
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
    await renderPage(<EntryPage />, { data });
    expect(await screen.findByText('進行中のプロジェクトは、すべて登録済みです')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '追加' })).toBeNull();
  });

  test('編集中に「新規追加」を押すと、新しく入力できる', async () => {
    const data = withProjects();
    data.reports = [todayReport('p-001', '受発注システム改修', 3, '設計')];
    const { user } = await renderPage(<EntryPage />, { data });
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
    const { user } = await renderPage(<EntryPage />, { data });
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
    const { user } = await renderPage(<EntryPage />, { data });
    await user.click(await screen.findByRole('button', { name: /受発注システム改修/ }));
    await user.click(screen.getByRole('button', { name: '15分増やす' }));
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('合計 3.25 時間')).toBeInTheDocument();
    expect(db.current.reports.map((r) => r.hours)).toEqual([3.25]);
  });

  test('削除する前に確認のダイアログが出て、「削除する」で消える', async () => {
    const data = withProjects();
    data.reports = [todayReport('p-001', '受発注システム改修', 2)];
    const { user } = await renderPage(<EntryPage />, { data });
    await user.click(await screen.findByRole('button', { name: /受発注システム改修/ }));
    await user.click(screen.getByRole('button', { name: 'この日報を削除' }));
    const dialog = screen.getByRole('dialog', { name: '日報を削除しますか?' });
    expect(dialog).toHaveTextContent('受発注システム改修 2時間');
    await user.click(within(dialog).getByRole('button', { name: '削除する' }));
    expect(await screen.findByText('まだ登録がありません')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '新規追加' })).toBeInTheDocument();
  });

  test('確認のダイアログで「やめる」を押すと、消えない', async () => {
    const data = withProjects();
    data.reports = [todayReport('p-001', '受発注システム改修', 2)];
    const { user } = await renderPage(<EntryPage />, { data });
    await user.click(await screen.findByRole('button', { name: /受発注システム改修/ }));
    await user.click(screen.getByRole('button', { name: 'この日報を削除' }));
    await user.click(screen.getByRole('button', { name: 'やめる' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(db.current.reports).toHaveLength(1);
  });
});

describe('時間の入力', () => {
  test('±ボタンで15分ずつ変えられる', async () => {
    const { user } = await renderPage(<EntryPage />, { data: withProjects() });
    const hours = await screen.findByLabelText('時間');
    expect(hours).toHaveValue(8);
    await user.click(screen.getByRole('button', { name: '15分減らす' }));
    expect(hours).toHaveValue(7.75);
    await user.click(screen.getByRole('button', { name: '15分増やす' }));
    await user.click(screen.getByRole('button', { name: '15分増やす' }));
    expect(hours).toHaveValue(8.25);
  });

  test('15分単位でない時間は、送る前にエラーを出す', async () => {
    const { user } = await renderPage(<EntryPage />, { data: withProjects() });
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
    const { user } = await renderPage(<EntryPage />, { data });
    await screen.findByText('合計 20 時間');
    await screen.findByRole('option', { name: '社内ポータル' });
    await user.click(screen.getByRole('button', { name: '追加' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('1日の合計が24時間を超えます');
  });
});
