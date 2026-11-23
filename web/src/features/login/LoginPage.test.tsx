import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { renderPage } from '../../../tests/render';
import { LoginPage } from './LoginPage';

function app() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>最初の画面</p>} />
    </Routes>
  );
}

test('メールアドレスとパスワードでログインすると、最初の画面に移る', async () => {
  const { user, auth } = await renderPage(app(), { route: '/login', email: null });
  await user.type(screen.getByLabelText('メールアドレス'), 'yamada@example.com');
  await user.type(screen.getByLabelText('パスワード'), 'secret-password');
  await user.click(screen.getByRole('button', { name: 'ログイン' }));
  expect(await screen.findByText('最初の画面')).toBeInTheDocument();
  expect(await auth.idToken()).toBe('yamada@example.com');
});

test('初めてのログインでは、新しいパスワードを決める', async () => {
  const { user, auth } = await renderPage(app(), { route: '/login', email: null });
  auth.signIn = async () => 'newPasswordRequired';
  await user.type(screen.getByLabelText('メールアドレス'), 'yamada@example.com');
  await user.type(screen.getByLabelText('パスワード'), 'temporary');
  await user.click(screen.getByRole('button', { name: 'ログイン' }));
  await user.type(await screen.findByLabelText('新しいパスワード'), 'NewPassword123');
  await user.click(screen.getByRole('button', { name: 'パスワードを決める' }));
  expect(await screen.findByText('最初の画面')).toBeInTheDocument();
});

test('ログインに失敗したら、理由を出す', async () => {
  const { user, auth } = await renderPage(app(), { route: '/login', email: null });
  auth.signIn = async () => {
    throw new Error('Incorrect username or password.');
  };
  await user.type(screen.getByLabelText('メールアドレス'), 'yamada@example.com');
  await user.type(screen.getByLabelText('パスワード'), 'wrong');
  await user.click(screen.getByRole('button', { name: 'ログイン' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('メールアドレスかパスワードが違います');
});
