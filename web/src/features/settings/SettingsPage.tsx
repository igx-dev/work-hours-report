/**
 * 設定(admin): Slack とのつなぎ方と、通知のオン・オフ。
 * Webhook URL は書き込むだけで、画面には末尾4文字しか出さない(知っていれば誰でも投稿できてしまうため)。
 */
import { useState, type FormEvent } from 'react';
import {
  errorMessage,
  useGetSettingsQuery,
  useSendSlackTestMutation,
  useSetSlackWebhookMutation,
  useUpdateSettingsMutation,
} from '../../api/api';
import type { Settings } from '../../api/types';

type Message = { kind: 'error' | 'info'; text: string } | null;

const NOTIFICATIONS: { key: 'remindEnabled' | 'weeklyReportEnabled'; label: string; hint: string }[] = [
  { key: 'remindEnabled', label: '未提出者のお知らせ', hint: '平日 18:00 に、その日の日報をまだ出していない人の名前を投稿します' },
  { key: 'weeklyReportEnabled', label: '週次レポート', hint: '月曜 9:00 に、先週のプロジェクト別の工数を投稿します' },
];

export function SettingsPage() {
  const { data } = useGetSettingsQuery();
  const [setWebhook, webhookState] = useSetSlackWebhookMutation();
  const [sendTest, testState] = useSendSlackTestMutation();
  const [updateSettings] = useUpdateSettingsMutation();
  const [url, setUrl] = useState('');
  const [slackMessage, setSlackMessage] = useState<Message>(null);
  const [notifyMessage, setNotifyMessage] = useState<Message>(null);

  async function onSaveWebhook(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return setSlackMessage({ kind: 'error', text: 'Webhook URL を入れてください' });
    const result = await setWebhook(url.trim());
    if ('error' in result) return setSlackMessage({ kind: 'error', text: errorMessage(result.error)! });
    setUrl('');
    setSlackMessage({ kind: 'info', text: '保存しました。「テスト送信」で、届くか確かめてください' });
  }

  async function onTest() {
    const result = await sendTest();
    if ('error' in result) return setSlackMessage({ kind: 'error', text: errorMessage(result.error)! });
    setSlackMessage({ kind: 'info', text: '送りました。Slack のチャンネルを確かめてください' });
  }

  async function onToggle(key: keyof Pick<Settings, 'remindEnabled' | 'weeklyReportEnabled'>, value: boolean) {
    const result = await updateSettings({ [key]: value });
    if ('error' in result) return setNotifyMessage({ kind: 'error', text: errorMessage(result.error)! });
    setNotifyMessage({ kind: 'info', text: '保存しました' });
  }

  if (!data) return <h1>設定</h1>;

  return (
    <>
      <h1>設定</h1>
      <div className="grid-2">
        <form className="card" onSubmit={onSaveWebhook} noValidate aria-labelledby="slack-title">
          <h2 id="slack-title">Slack とのつなぎ方</h2>
          <p className="field-label">今の状態</p>
          <p className="fixed-value">
            {data.slackConfigured ? `つないであります(末尾 …${data.slackHint})` : 'まだつないでいません'}
          </p>

          <label htmlFor="webhook-url">Webhook URL</label>
          <input
            id="webhook-url"
            type="url"
            autoComplete="off"
            placeholder="https://hooks.slack.com/services/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="hint">
            Slack で、通知を送りたいチャンネルの「Incoming Webhook」を作り、その URL を貼ってください。保存したあとは、URL の全体は表示しません。
          </p>

          {slackMessage && (
            <p role={slackMessage.kind === 'error' ? 'alert' : 'status'} className={slackMessage.kind}>
              {slackMessage.text}
            </p>
          )}
          <div className="button-row">
            <button type="submit" className="primary" disabled={webhookState.isLoading}>
              URL を保存
            </button>
            <button type="button" className="secondary" onClick={onTest} disabled={!data.slackConfigured || testState.isLoading}>
              テスト送信
            </button>
          </div>
        </form>

        <section className="card" aria-labelledby="notify-title">
          <h2 id="notify-title">通知</h2>
          {NOTIFICATIONS.map((n) => (
            <div key={n.key} className="toggle-row">
              <label className="check">
                <input type="checkbox" checked={data[n.key]} onChange={(e) => onToggle(n.key, e.target.checked)} />
                {n.label}
              </label>
              <p className="hint">{n.hint}</p>
            </div>
          ))}
          {!data.slackConfigured && <p className="hint">Slack をつなぐまでは、オンにしていても投稿されません。</p>}
          {notifyMessage && (
            <p role={notifyMessage.kind === 'error' ? 'alert' : 'status'} className={notifyMessage.kind}>
              {notifyMessage.text}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
