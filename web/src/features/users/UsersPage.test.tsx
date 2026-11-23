import { screen, within } from '@testing-library/react';
import { db, renderPage } from '../../../tests/render';
import { UsersPage } from './UsersPage';

const asAdmin = { email: 'admin@example.com' };

test('一覧に名前・メールアドレス・役割・状態が出る', async () => {
  await renderPage(<UsersPage />, asAdmin);
  const list = await screen.findByRole('list', { name: 'ユーザーの一覧' });
  const yamada = await within(list).findByRole('button', { name: /山田 太郎/ });
  expect(yamada).toHaveTextContent('yamada@example.com');
  expect(yamada).toHaveTextContent('作業者');
  expect(within(list).getByRole('button', { name: /管理 花子/ })).toHaveTextContent('管理者');
});

describe('新規追加', () => {
  test('名前・メールアドレス・役割を入れて追加すると、一覧に出て招待される', async () => {
    const { user } = await renderPage(<UsersPage />, asAdmin);
    await user.type(await screen.findByLabelText('名前'), '鈴木 一郎');
    await user.type(screen.getByLabelText('メールアドレス'), 'suzuki@example.com');
    await user.click(screen.getByRole('button', { name: '追加して招待する' }));
    expect(await screen.findByText('招待メールを送りました')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'ユーザーの一覧' });
    expect(within(list).getByRole('button', { name: /鈴木 一郎/ })).toBeInTheDocument();
    expect(db.current.users.find((u) => u.email === 'suzuki@example.com')?.roles).toEqual(['member']);
  });

  test('もう登録されているメールアドレスは、エラーを出す', async () => {
    const { user } = await renderPage(<UsersPage />, asAdmin);
    await user.type(await screen.findByLabelText('名前'), '別人');
    await user.type(screen.getByLabelText('メールアドレス'), 'yamada@example.com');
    await user.click(screen.getByRole('button', { name: '追加して招待する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('このメールアドレスは、もう登録されています');
  });

  test('役割を1つも選ばないと、送る前にエラーを出す', async () => {
    const { user } = await renderPage(<UsersPage />, asAdmin);
    await user.type(await screen.findByLabelText('名前'), 'X');
    await user.type(screen.getByLabelText('メールアドレス'), 'x@example.com');
    await user.click(screen.getByLabelText('作業者'));
    await user.click(screen.getByRole('button', { name: '追加して招待する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('役割を1つ以上選んでください');
  });
});

describe('編集', () => {
  test('名前と役割を変えて保存できる(メールアドレスは変えられない)', async () => {
    const { user } = await renderPage(<UsersPage />, asAdmin);
    await user.click(await screen.findByRole('button', { name: /山田 太郎/ }));
    const form = screen.getByRole('form', { name: '編集' });
    expect(within(form).queryByLabelText('メールアドレス')).toBeNull();
    await user.clear(within(form).getByLabelText('名前'));
    await user.type(within(form).getByLabelText('名前'), '山田 一郎');
    await user.click(within(form).getByLabelText('管理者'));
    await user.click(within(form).getByRole('button', { name: '保存' }));
    expect(await screen.findByText('保存しました')).toBeInTheDocument();
    expect(db.current.users.find((u) => u.userId === 'u-1')).toMatchObject({ name: '山田 一郎', roles: ['member', 'admin'] });
  });

  test('利用を止める前に確認のダイアログが出て、止めたら一覧にそう出る。再開もできる', async () => {
    const { user } = await renderPage(<UsersPage />, asAdmin);
    await user.click(await screen.findByRole('button', { name: /山田 太郎/ }));
    await user.click(screen.getByRole('button', { name: '利用を止める' }));
    const dialog = screen.getByRole('dialog', { name: '山田 太郎 さんの利用を止めますか?' });
    await user.click(within(dialog).getByRole('button', { name: '止める' }));
    const list = screen.getByRole('list', { name: 'ユーザーの一覧' });
    expect(await within(list).findByText('停止中')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '利用を再開する' }));
    expect(await screen.findByText('利用を再開しました')).toBeInTheDocument();
    expect(db.current.users.find((u) => u.userId === 'u-1')?.enabled).not.toBe(false);
  });

  test('自分の管理者の役割は外せず、自分の利用も止められない', async () => {
    const { user } = await renderPage(<UsersPage />, asAdmin);
    await user.click(await screen.findByRole('button', { name: /管理 花子/ }));
    const form = screen.getByRole('form', { name: '編集' });
    expect(within(form).getByLabelText('管理者')).toBeDisabled();
    expect(within(form).queryByRole('button', { name: '利用を止める' })).toBeNull();
    expect(within(form).getByText('自分の管理者の役割と利用は変えられません')).toBeInTheDocument();
  });
});

