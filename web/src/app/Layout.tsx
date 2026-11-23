/**
 * 画面全体の枠: PC では左にメニュー、スマホ(〜767px)では下にタブバー。
 * ログインしていなければログイン画面に移す。メニューはロール(member / admin)で変える。
 */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { api, useGetMeQuery } from '../api/api';
import { useAuth } from './AuthContext';
import { useAppDispatch } from './store';

const MEMBER_MENU = [
  { to: '/', label: '日報入力', short: '入力', icon: '✎' },
  { to: '/reports', label: '自分の日報', short: '日報', icon: '☰' },
];
const ADMIN_MENU = [
  { to: '/dashboard', label: 'ダッシュボード', short: '集計', icon: '▤' },
  { to: '/admin/projects', label: 'プロジェクト管理', short: 'PJ管理', icon: '◫' },
  { to: '/admin/users', label: 'ユーザー管理', short: 'ユーザー', icon: '◎' },
  { to: '/admin/exports', label: 'CSV 出力', short: 'CSV', icon: '⇩' },
  { to: '/admin/settings', label: '設定', short: '設定', icon: '⚙' },
];

export function Layout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    auth.idToken().then((token) => {
      if (!token) navigate('/login', { replace: true });
      setSignedIn(Boolean(token));
    });
  }, [auth, navigate]);

  const { data: me, error } = useGetMeQuery(undefined, { skip: !signedIn });

  useEffect(() => {
    if (error && 'status' in error && error.status === 401) navigate('/login', { replace: true });
  }, [error, navigate]);

  async function signOut() {
    await auth.signOut();
    dispatch(api.util.resetApiState());
    navigate('/login', { replace: true });
  }

  if (!signedIn) return null;
  if (!me) return error ? <p className="error">読み込めませんでした。再読み込みしてください。</p> : null;
  const menu = me.roles.includes('admin') ? [...MEMBER_MENU, ...ADMIN_MENU] : MEMBER_MENU;

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">工数日報</span>
        <span className="who">{me.name}</span>
        <button type="button" className="link" onClick={signOut}>
          ログアウト
        </button>
      </header>
      <nav className="menu" aria-label="メニュー">
        {menu.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}>
            <span className="icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="label">{item.label}</span>
            <span className="short" aria-hidden="true">
              {item.short}
            </span>
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
