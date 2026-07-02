'use client';

/**
 * context/AuthContext.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * App-wide auth state. Wraps lib/auth.ts (the swappable layer) and exposes
 * `user`, `isLoading`, `login`, `signup`, and `logout` to the rest of the app
 * via `useAuth()`. No page or component below talks to lib/auth.ts directly —
 * they all go through this context, so the localStorage → real-API swap in
 * lib/auth.ts is the only place that needs to change.
 * ───────────────────────────────────────────────────────────────────────────
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';
import * as authApi from '@/lib/auth';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signup: (input: { name: string; email: string; password: string }) => Promise<User>;
  login: (input: { email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Restore the session on first load so refreshing the page doesn't log
  // the user out. TODO(backend): once real sessions exist, you may want to
  // call authApi.fetchCurrentUser() here instead of trusting local storage.
  useEffect(() => {
  if (typeof window !== 'undefined') {
    setUser(authApi.getStoredUser());
  }
  setIsLoading(false);
}, []);

  const signup = useCallback(async (input: { name: string; email: string; password: string }) => {
    const result = await authApi.signup(input);
    setUser(result);
    return result;
  }, []);

  const login = useCallback(async (input: { email: string; password: string }) => {
    const result = await authApi.login(input);
    setUser(result);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    router.push('/');
  }, [router]);

  const value = useMemo(
    () => ({ user, isLoading, signup, login, logout }),
    [user, isLoading, signup, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used inside <AuthProvider>.');
  }
  return ctx;
}
