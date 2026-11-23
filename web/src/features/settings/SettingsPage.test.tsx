import { screen } from '@testing-library/react';
import { db, renderPage } from '../../../tests/render';
import { SettingsPage } from './SettingsPage';

const asAdmin = { email: 'admin@example.com' };
const URL = 'https://hooks.slack.com/services/T000/B000/abcd1234';

test('最初は Slack 未設定で、通知はどちらもオン。テスト送信は押せない', async () => {
  await renderPage(<SettingsPage />, asAdmin);
  expect(await screen.findByText('まだつないでいません')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /未提出者のお知らせ/ })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /週次レポート/ })).toBeChecked();
  expect(screen.getByRole('button', { name: 'テスト送信' })).toBeDisabled();
});

test('Webhook URL を保存すると、末尾4文字だけが出て、入力欄は空に戻る', async () => {
  const { user } = await renderPage(<SettingsPage />, asAdmin);
  await user.type(await screen.findByLabelText('Webhook URL'), URL);
  await user.click(screen.getByRole('button', { name: 'URL を保存' }));
  expect(await screen.findByText('つないであります(末尾 …1234)')).toBeInTheDocument();
  expect(screen.getByLabelText('Webhook URL')).toHaveValue('');
  expect(screen.queryByText(URL)).toBeNull();
});

test('Slack の URL でなければ、エラーを出す', async () => {
  const { user } = await renderPage(<SettingsPage />, asAdmin);
  await user.type(await screen.findByLabelText('Webhook URL'), 'https://example.com/hook');
  await user.click(screen.getByRole('button', { name: 'URL を保存' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('https://hooks.slack.com/ で始まる');
});

test('つないだあとは、テスト送信できる', async () => {
  const { user } = await renderPage(<SettingsPage />, asAdmin);
  await user.type(await screen.findByLabelText('Webhook URL'), URL);
  await user.click(screen.getByRole('button', { name: 'URL を保存' }));
  await screen.findByText('つないであります(末尾 …1234)');
  await user.click(screen.getByRole('button', { name: 'テスト送信' }));
  expect(await screen.findByText('送りました。Slack のチャンネルを確かめてください')).toBeInTheDocument();
});

test('通知をオフにすると、すぐに保存される', async () => {
  const { user } = await renderPage(<SettingsPage />, asAdmin);
  await user.click(await screen.findByRole('checkbox', { name: /未提出者のお知らせ/ }));
  expect(await screen.findByText('保存しました')).toBeInTheDocument();
  expect(db.current.settings.remindEnabled).toBe(false);
  expect(screen.getByRole('checkbox', { name: /未提出者のお知らせ/ })).not.toBeChecked();
});
