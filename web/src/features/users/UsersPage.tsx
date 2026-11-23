/**
 * ユーザー管理(admin)。日報・プロジェクトと同じ形にそろえる。
 * 左: ユーザーの一覧と「新規追加」。押した人を右で編集する。
 * 右: 新規追加(招待メールが届く)か、選んだ人の編集(名前、役割、利用の可否)。
 * 消すことはしない(過去の日報の名前が分からなくなるため)。代わりに利用を止める。
 */
import { useState, type FormEvent } from 'react';
import { errorMessage, useCreateUserMutation, useGetMeQuery, useListUsersQuery, useUpdateUserMutation } from '../../api/api';
import type { ManagedUser, Role } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';

const ROLE_LABELS: Record<Role, string> = { member: '作業者', admin: '管理者' };
const ROLES: Role[] = ['member', 'admin'];
type Mode = { kind: 'new' } | { kind: 'edit'; userId: string };
type Form = { name: string; email: string; roles: Role[] };
const EMPTY: Form = { name: '', email: '', roles: ['member'] };

export function UsersPage() {
  const { data: me } = useGetMeQuery();
  const { data } = useListUsersQuery();
  const [create, createState] = useCreateUserMutation();
  const [update, updateState] = useUpdateUserMutation();
  const [mode, setMode] = useState<Mode>({ kind: 'new' });
  const [form, setForm] = useState<Form>(EMPTY);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [confirmingStop, setConfirmingStop] = useState(false);

  const users = data?.items ?? [];
  const editing = mode.kind === 'edit' ? users.find((u) => u.userId === mode.userId) : undefined;
  const isSelf = editing?.userId === me?.userId;

  function startNew() {
    setMode({ kind: 'new' });
    setForm(EMPTY);
    setMessage(null);
  }

  function startEdit(u: ManagedUser) {
    setMode({ kind: 'edit', userId: u.userId });
    setForm({ name: u.name, email: u.email, roles: u.roles });
    setMessage(null);
  }

  function toggleRole(role: Role) {
    setForm({ ...form, roles: form.roles.includes(role) ? form.roles.filter((r) => r !== role) : [...form.roles, role] });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setMessage({ kind: 'error', text: '名前を入れてください' });
    if (mode.kind === 'new' && !form.email.includes('@')) {
      return setMessage({ kind: 'error', text: 'メールアドレスを入れてください' });
    }
    if (form.roles.length === 0) return setMessage({ kind: 'error', text: '役割を1つ以上選んでください' });
    const roles = ROLES.filter((r) => form.roles.includes(r));
    const result =
      mode.kind === 'edit'
        ? await update({ userId: mode.userId, name: form.name.trim(), roles })
        : await create({ name: form.name.trim(), email: form.email.trim(), roles });
    if ('error' in result) return setMessage({ kind: 'error', text: errorMessage(result.error)! });
    startEdit(result.data);
    setMessage({ kind: 'info', text: mode.kind === 'edit' ? '保存しました' : '招待メールを送りました' });
  }

  async function setEnabled(enabled: boolean) {
    if (!editing) return;
    setConfirmingStop(false);
    const result = await update({ userId: editing.userId, enabled });
    if ('error' in result) return setMessage({ kind: 'error', text: errorMessage(result.error)! });
    setMessage({ kind: 'info', text: enabled ? '利用を再開しました' : '利用を止めました' });
  }

  return (
    <>
      <h1>ユーザー管理</h1>
      <div className="day-editor">
        <section className="card">
          <ul className="report-list" aria-label="ユーザーの一覧">
            {users.map((u) => (
              <li key={u.userId}>
                <button
                  type="button"
                  className={`report-item${editing?.userId === u.userId ? ' selected' : ''}`}
                  aria-pressed={editing?.userId === u.userId}
                  onClick={() => startEdit(u)}
                >
                  <span className="name">
                    {u.name}
                    {!u.enabled && <span className="badge closed">停止中</span>}
                  </span>
                  <span className="hours">{u.roles.map((r) => ROLE_LABELS[r]).join('・')}</span>
                  <span className="note">{u.email}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="secondary wide" onClick={startNew} aria-pressed={mode.kind === 'new'}>
            ＋ 新規追加
          </button>
        </section>

        <form className="card" onSubmit={onSubmit} noValidate aria-labelledby="user-form-title">
          <h2 id="user-form-title">{mode.kind === 'edit' ? '編集' : '新規追加'}</h2>
          <label htmlFor="u-name">名前</label>
          <input id="u-name" value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} />

          {mode.kind === 'new' ? (
            <>
              <label htmlFor="u-email">メールアドレス</label>
              <input
                id="u-email"
                type="email"
                value={form.email}
                maxLength={254}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <p className="hint">追加すると、仮のパスワードを書いた招待メールがこのアドレスに届きます。</p>
            </>
          ) : (
            <>
              <p className="field-label">メールアドレス</p>
              <p className="fixed-value">{form.email}</p>
            </>
          )}

          <fieldset className="roles">
            <legend>役割</legend>
            {ROLES.map((role) => (
              <label key={role} className="check">
                <input
                  type="checkbox"
                  checked={form.roles.includes(role)}
                  disabled={isSelf && role === 'admin'}
                  onChange={() => toggleRole(role)}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </fieldset>
          {isSelf && <p className="hint">自分の管理者の役割と利用は変えられません</p>}

          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind}>
              {message.text}
            </p>
          )}
          <button type="submit" className="primary wide" disabled={createState.isLoading || updateState.isLoading}>
            {mode.kind === 'edit' ? '保存' : '追加して招待する'}
          </button>

          {editing && !isSelf && (
            editing.enabled ? (
              <button type="button" className="link danger delete" onClick={() => setConfirmingStop(true)}>
                利用を止める
              </button>
            ) : (
              <button type="button" className="link delete" onClick={() => setEnabled(true)}>
                利用を再開する
              </button>
            )
          )}
        </form>
      </div>

      <ConfirmDialog
        open={confirmingStop && !!editing}
        title={`${editing?.name ?? ''} さんの利用を止めますか?`}
        confirmLabel="止める"
        danger
        busy={updateState.isLoading}
        onConfirm={() => setEnabled(false)}
        onCancel={() => setConfirmingStop(false)}
      >
        <p>止めると、この人はログインできなくなります。ログイン中の画面からも外れます。これまでの日報は残り、あとで再開できます。</p>
      </ConfirmDialog>
    </>
  );
}
