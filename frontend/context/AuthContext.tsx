'use client';

/**
 * context/AuthContext.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * App-wide auth state. Now uses the recap auth library directly (via '@/lib/auth').
 * Exposes `user`, `isLoading`, `login`, `signup`, and `logout` to the rest of the app
 * via `useAuth()`.
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
import * as authApi from '@/lib/auth'; // This is now the recap auth library

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

  // Restore the session on first load.
  // If we have a token, we try to fetch the current user from the backend to validate.
  // Otherwise, we fall back to the cached user (from localStorage).
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = authApi.getToken();
      if (token) {
        // Token exists, validate with backend
        authApi
          .getCurrentUser()
          .then(fetchUser => {
            setUser(fetchUser ?? null);
          })
          .catch(() => {
            // If fetching the current user fails, clear the session
            authApi.logout(); // This clears the token and user from storage
            setUser(null);
          });
      } else {
        // No token, try to get cached user from localStorage
        setUser(authApi.getCachedUser());
      }
    }
    setIsLoading(false);
  }, []);

  const signup = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const result = await authApi.registerUser(
        input.email,
        input.password,
        input.name,
        // role is optional; we can let the backend decide or pass a default.
        // We'll pass undefined to let the backend use its default.
        undefined
      );
      if (!result.user) {
        throw new Error('Sign up succeeded but no user returned');
      }
      setUser(result.user);
      return result.user;
    },
    []
  );

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const result = await authApi.loginUser(input.email, input.password);
      if (!result.user) {
        throw new Error('Login succeeded but no user returned');
      }
      setUser(result.user);
      return result.user;
    },
    []
  );

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