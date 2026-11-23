/**
 * ログインの窓口。画面はこの形(Auth)だけを使い、中身が Cognito か見本かは気にしない。
 * テストでは見本(mockAuth)を渡す。
 */
export type SignInResult = 'done' | 'newPasswordRequired';

export interface Auth {
  signIn(email: string, password: string): Promise<SignInResult>;
  setNewPassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  /** ログイン中なら ID トークン、していなければ null */
  idToken(): Promise<string | null>;
}

/** 見本: メールアドレスが admin で始まれば管理者として振る舞う。トークンはメールアドレスそのもの。 */
export function createMockAuth(): Auth {
  let token: string | null = sessionStorageGet();
  return {
    async signIn(email) {
      token = email;
      sessionStorageSet(token);
      return 'done';
    },
    async setNewPassword() {},
    async signOut() {
      token = null;
      sessionStorageSet(null);
    },
    async idToken() {
      return token;
    },
  };
}

function sessionStorageGet(): string | null {
  try {
    return sessionStorage.getItem('mock-token');
  } catch {
    return null;
  }
}

function sessionStorageSet(value: string | null) {
  try {
    if (value) sessionStorage.setItem('mock-token', value);
    else sessionStorage.removeItem('mock-token');
  } catch {
    /* 保存できなくても動く */
  }
}
