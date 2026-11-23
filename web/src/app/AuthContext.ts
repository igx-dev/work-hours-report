import { createContext, useContext } from 'react';
import type { Auth } from '../lib/auth';

export const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthContext がありません');
  return auth;
}
