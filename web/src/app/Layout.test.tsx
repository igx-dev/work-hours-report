import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { renderPage } from '../../tests/render';
import { Layout } from './Layout';

function app() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<p>中身</p>} />
      </Route>
      <Route path="/login" element={<p>ログイン画面</p>} />
    </Routes>
  );
}

test('member のメニューには、管理者用の項目が出ない', async () => {
  await renderPage(app(), { email: 'yamada@example.com' });
  const nav = await screen.findByRole('navigation', { name: 'メニュー' });
  expect(nav).toHaveTextContent('日報入力');
  expect(nav).toHaveTextContent('自分の日報');
  expect(nav).not.toHaveTextContent('ダッシュボード');
  expect(screen.getByText('山田 太郎')).toBeInTheDocument();
});

test('admin のメニューには、ダッシュボードとプロジェクト管理が出る', async () => {
  await renderPage(app(), { email: 'admin@example.com' });
  const nav = await screen.findByRole('navigation', { name: 'メニュー' });
  expect(nav).toHaveTextContent('ダッシュボード');
  expect(nav).toHaveTextContent('プロジェクト管理');
  expect(nav).toHaveTextContent('ユーザー管理');
  expect(nav).toHaveTextContent('CSV 出力');
  expect(nav).toHaveTextContent('設定');
});

test('ログインしていなければ、ログイン画面に移る', async () => {
  await renderPage(app(), { email: null });
  expect(await screen.findByText('ログイン画面')).toBeInTheDocument();
});

test('ログアウトするとログイン画面に移る', async () => {
  const { user } = await renderPage(app());
  await user.click(await screen.findByRole('button', { name: 'ログアウト' }));
  expect(await screen.findByText('ログイン画面')).toBeInTheDocument();
});
