import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

function setup(open = true) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  render(
    <ConfirmDialog
      open={open}
      title="日報を削除しますか?"
      confirmLabel="削除する"
      danger
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      元に戻せません。
    </ConfirmDialog>,
  );
  return { onConfirm, onCancel, user: userEvent.setup() };
}

test('開いている時だけ、題名と中身が出る', () => {
  setup();
  const dialog = screen.getByRole('dialog', { name: '日報を削除しますか?' });
  expect(dialog).toHaveTextContent('元に戻せません。');
});

test('閉じている時は何も出ない', () => {
  setup(false);
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('開いた時は「やめる」に焦点がある(うっかり Enter で消さないように)', () => {
  setup();
  expect(screen.getByRole('button', { name: 'やめる' })).toHaveFocus();
});

test('ボタンで決める・やめるを選べる', async () => {
  const { user, onConfirm, onCancel } = setup();
  await user.click(screen.getByRole('button', { name: '削除する' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'やめる' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('Esc キーでやめられる', async () => {
  const { user, onCancel } = setup();
  await user.keyboard('{Escape}');
  expect(onCancel).toHaveBeenCalledTimes(1);
});
