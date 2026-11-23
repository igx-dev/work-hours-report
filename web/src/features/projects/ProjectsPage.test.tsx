import { screen, within } from '@testing-library/react';
import { db, renderPage } from '../../../tests/render';
import { emptyDb } from '../../mocks/db';
import { ProjectsPage } from './ProjectsPage';

test('プロジェクトを登録すると一覧に出る', async () => {
  const { user } = await renderPage(<ProjectsPage />, { email: 'admin@example.com', data: emptyDb() });
  await user.type(await screen.findByLabelText('名前'), '新しい仕組み');
  await user.clear(screen.getByLabelText('予定工数(時間)'));
  await user.type(screen.getByLabelText('予定工数(時間)'), '120');
  await user.type(screen.getByLabelText('開始日'), '2027-01-01');
  await user.type(screen.getByLabelText('終了日'), '2027-06-30');
  await user.click(screen.getByRole('button', { name: '登録' }));
  const table = await screen.findByRole('table', { name: 'プロジェクトの一覧' });
  expect(await within(table).findByText('新しい仕組み')).toBeInTheDocument();
  expect(db.current.projects[0].status).toBe('ACTIVE');
});

test('終了日が開始日より前なら、送る前にエラーを出す', async () => {
  const { user } = await renderPage(<ProjectsPage />, { email: 'admin@example.com', data: emptyDb() });
  await user.type(await screen.findByLabelText('名前'), 'X');
  await user.type(screen.getByLabelText('開始日'), '2027-06-30');
  await user.type(screen.getByLabelText('終了日'), '2027-01-01');
  await user.click(screen.getByRole('button', { name: '登録' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('終了日は開始日より後にしてください');
});

test('進行中のプロジェクトを終了にできる', async () => {
  const data = emptyDb();
  data.projects = [{ projectId: 'p-001', name: '受発注システム改修', plannedHours: 20, startDate: '2026-01-01', endDate: '2099-12-31', status: 'ACTIVE' }];
  const { user } = await renderPage(<ProjectsPage />, { email: 'admin@example.com', data });
  await user.click(await screen.findByRole('button', { name: '受発注システム改修 を終了にする' }));
  expect(await screen.findByText('終了')).toBeInTheDocument();
  expect(db.current.projects[0].status).toBe('CLOSED');
});
