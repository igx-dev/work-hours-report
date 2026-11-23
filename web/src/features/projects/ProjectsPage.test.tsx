import { screen, within } from '@testing-library/react';
import { db, renderPage } from '../../../tests/render';
import { emptyDb } from '../../mocks/db';
import { ProjectsPage } from './ProjectsPage';

function withProject() {
  const data = emptyDb();
  data.projects = [
    { projectId: 'p-001', name: '受発注システム改修', plannedHours: 20, startDate: '2026-01-01', endDate: '2026-12-31', status: 'ACTIVE' },
  ];
  return data;
}

describe('新規追加', () => {
  test('入力して追加すると、左の一覧に出て、そのまま編集できる状態になる', async () => {
    const { user } = await renderPage(<ProjectsPage />, { email: 'admin@example.com', data: emptyDb() });
    expect(await screen.findByRole('heading', { name: '新規追加' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('名前'), '新しい仕組み');
    await user.clear(screen.getByLabelText('予定工数(時間)'));
    await user.type(screen.getByLabelText('予定工数(時間)'), '120');
    await user.type(screen.getByLabelText('開始日'), '2027-01-01');
    await user.type(screen.getByLabelText('終了日'), '2027-06-30');
    await user.click(screen.getByRole('button', { name: '追加' }));

    const list = await screen.findByRole('list', { name: 'プロジェクトの一覧' });
    expect(await within(list).findByText('新しい仕組み')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '編集' })).toBeInTheDocument();
    expect(db.current.projects[0].status).toBe('ACTIVE');
  });

  test('終了日が開始日より前なら、送る前にエラーを出す', async () => {
    const { user } = await renderPage(<ProjectsPage />, { email: 'admin@example.com', data: emptyDb() });
    await user.type(await screen.findByLabelText('名前'), 'X');
    await user.type(screen.getByLabelText('開始日'), '2027-06-30');
    await user.type(screen.getByLabelText('終了日'), '2027-01-01');
    await user.click(screen.getByRole('button', { name: '追加' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('終了日は開始日より後にしてください');
    expect(db.current.projects).toHaveLength(0);
  });
});

describe('編集', () => {
  test('左で選ぶと、右にその内容が入る', async () => {
    const { user } = await renderPage(<ProjectsPage />, { email: 'admin@example.com', data: withProject() });
    await user.click(await screen.findByRole('button', { name: /受発注システム改修/ }));
    const form = await screen.findByRole('form', { name: '編集' });
    expect(within(form).getByLabelText('名前')).toHaveValue('受発注システム改修');
    expect(within(form).getByLabelText('予定工数(時間)')).toHaveValue(20);
    expect(within(form).getByLabelText('終了日')).toHaveValue('2026-12-31');
    expect(within(form).getByLabelText('状態')).toHaveValue('ACTIVE');
  });

  test('予定工数と期間を変えて保存できる', async () => {
    const { user } = await renderPage(<ProjectsPage />, { email: 'admin@example.com', data: withProject() });
    await user.click(await screen.findByRole('button', { name: /受発注システム改修/ }));
    await user.clear(screen.getByLabelText('予定工数(時間)'));
    await user.type(screen.getByLabelText('予定工数(時間)'), '40');
    await user.clear(screen.getByLabelText('終了日'));
    await user.type(screen.getByLabelText('終了日'), '2027-03-31');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('保存しました')).toBeInTheDocument();
    expect(db.current.projects[0]).toMatchObject({ plannedHours: 40, endDate: '2027-03-31' });
  });

  test('状態を「終了」にして保存できる(戻すこともできる)', async () => {
    const { user } = await renderPage(<ProjectsPage />, { email: 'admin@example.com', data: withProject() });
    await user.click(await screen.findByRole('button', { name: /受発注システム改修/ }));
    await user.selectOptions(screen.getByLabelText('状態'), 'CLOSED');
    await user.click(screen.getByRole('button', { name: '保存' }));
    const list = await screen.findByRole('list', { name: 'プロジェクトの一覧' });
    expect(await within(list).findByText('終了')).toBeInTheDocument();
    expect(db.current.projects[0].status).toBe('CLOSED');
  });

  test('編集中に「新規追加」を押すと、空の入力欄になる', async () => {
    const { user } = await renderPage(<ProjectsPage />, { email: 'admin@example.com', data: withProject() });
    await user.click(await screen.findByRole('button', { name: /受発注システム改修/ }));
    await user.click(screen.getByRole('button', { name: '＋ 新規追加' }));
    expect(screen.getByRole('heading', { name: '新規追加' })).toBeInTheDocument();
    expect(screen.getByLabelText('名前')).toHaveValue('');
    expect(screen.queryByLabelText('状態')).toBeNull();
  });
});
