'use client';

/**
 * context/AuthContext.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * App-wide auth state. Wraps lib/auth.ts (the swappable layer) and exposes
 * `user`, `isLoading`, `login`, `signup`, and `logout` to the rest of the app
 * ───────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import type { User } from '@/types';
import * as authApi from '@/lib/auth';

const AuthContext = createContext<{
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (input: { email: string; password: string }) => Promise<User>;
  signup: (input: { name: string; email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionUser = authApi.getStoredUser();
    if (sessionUser) {
      setUser(sessionUser);
    }
    setIsLoading(false);
  }, []);

  const value = {
    user,
    isLoading,
    error,
    login: authApi.login,
    signup: authApi.signup,
    logout: authApi.logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}