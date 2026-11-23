/** ログイン。初めてのログイン(管理者が作った仮のパスワード)では、新しいパスワードを決める。 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/api';
import { useAuth } from '../../app/AuthContext';
import { useAppDispatch } from '../../app/store';

function toMessage(e: unknown): string {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  if (/Incorrect username or password|NotAuthorized|UserNotFound/i.test(text)) {
    return 'メールアドレスかパスワードが違います';
  }
  if (/Password does not conform|InvalidPassword/i.test(text)) {
    return 'パスワードは12文字以上で、英大文字・英小文字・数字を入れてください';
  }
  return 'ログインできませんでした。時間をおいてもう一度試してください';
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function goHome() {
    dispatch(api.util.resetApiState());
    const me = await dispatch(api.endpoints.getMe.initiate()).unwrap().catch(() => null);
    navigate(me?.roles.includes('admin') ? '/dashboard' : '/', { replace: true });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function onSignIn(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const result = await auth.signIn(email.trim(), password);
      if (result === 'newPasswordRequired') setNeedsNewPassword(true);
      else await goHome();
    });
  }

  function onNewPassword(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await auth.setNewPassword(newPassword);
      await goHome();
    });
  }

  return (
    <div className="login">
      <h1>工数日報</h1>
      {needsNewPassword ? (
        <form className="card" onSubmit={onNewPassword}>
          <p>初めてのログインです。これから使うパスワードを決めてください。</p>
          <label htmlFor="new-password">新しいパスワード</label>
          <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <p className="hint">12文字以上で、英大文字・英小文字・数字を入れてください。</p>
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" className="primary wide" disabled={busy}>
            パスワードを決める
          </button>
        </form>
      ) : (
        <form className="card" onSubmit={onSignIn}>
          <label htmlFor="email">メールアドレス</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="password">パスワード</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" className="primary wide" disabled={busy}>
            ログイン
          </button>
        </form>
      )}
    </div>
  );
}
