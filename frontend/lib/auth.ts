/**
 * lib/auth.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Auth abstraction layer for RISHI-AI Discover.
 *
 * Every function below currently runs against a MOCK in-browser store
 * (localStorage) so the full signup → login → dashboard → logout flow
 * works with zero backend. Each function is written so that swapping the
 * mock body for a real `fetch()` call to the FastAPI backend is a
 * same-signature, same-return-shape change — nothing above this file
 * (AuthContext, pages, components) needs to change.
 *
 * Search this file for "TODO(backend)" to find every swap point.
 * ───────────────────────────────────────────────────────────────────────────
 */

import type { User } from '@/types';

const USERS_KEY = 'rishi_mock_users';
const SESSION_KEY = 'rishi_session';
const AUTH_COOKIE = 'rishi_auth';

/** Internal shape of a row in the mock "users table". Never exposed outside this file. */
interface MockUserRecord extends User {
  password: string;
}

export class AuthApiError extends Error {
  field?: 'name' | 'email' | 'password' | 'confirmPassword' | 'form';
  constructor(message: string, field?: AuthApiError['field']) {
    super(message);
    this.field = field;
  }
}

// ─── Local "database" helpers (mock only — delete this section when wiring the real API) ───

function readUsers(): MockUserRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as MockUserRecord[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: MockUserRecord[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function setSessionCookie(present: boolean) {
  // A non-sensitive flag cookie (NOT the session token) so that middleware.ts,
  // which runs on the server/edge and cannot read localStorage, can still
  // make redirect decisions.
  // TODO(backend): once the FastAPI backend issues a real session, replace
  // this with an httpOnly, secure cookie set by the server's Set-Cookie
  // response header on /api/auth/login and /api/auth/signup. At that point
  // this client-side cookie write can be removed entirely.
  if (present) {
    document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
  } else {
    document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }
}

function persistSession(user: User) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  setSessionCookie(true);
}

function simulateNetworkDelay(ms = 450): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Public API consumed by AuthContext ───────────────────────────────────

export async function signup(input: {
  name: string;
  email: string;
  password: string;
}): Promise<User> {
  await simulateNetworkDelay();

  // TODO(backend): replace the block below with:
  //
  //   const res = await fetch('/api/auth/signup', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     credentials: 'include', // backend sets the httpOnly session cookie
  //     body: JSON.stringify(input),
  //   });
  //   if (!res.ok) {
  //     const body = await res.json().catch(() => ({}));
  //     throw new AuthApiError(body.message ?? 'Could not create your account.', body.field);
  //   }
  //   const { user } = (await res.json()) as { user: User };
  //   persistSession(user); // keep this line — it also satisfies local "is logged in" checks
  //   return user;

  const users = readUsers();
  const email = input.email.trim().toLowerCase();

  if (users.some((u) => u.email === email)) {
    throw new AuthApiError('An account with this email already exists.', 'email');
  }

  const newUser: MockUserRecord = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
    name: input.name.trim(),
    email,
    password: input.password, // mock only — never store plaintext passwords in a real backend
  };

  writeUsers([...users, newUser]);

  const { password: _omit, ...publicUser } = newUser;
  persistSession(publicUser);
  return publicUser;
}

export async function login(input: { email: string; password: string }): Promise<User> {
  await simulateNetworkDelay();

  // TODO(backend): replace the block below with:
  //
  //   const res = await fetch('/api/auth/login', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     credentials: 'include',
  //     body: JSON.stringify(input),
  //   });
  //   if (!res.ok) {
  //     const body = await res.json().catch(() => ({}));
  //     throw new AuthApiError(body.message ?? 'Incorrect email or password.', body.field);
  //   }
  //   const { user } = (await res.json()) as { user: User };
  //   persistSession(user);
  //   return user;

  const users = readUsers();
  const email = input.email.trim().toLowerCase();
  const match = users.find((u) => u.email === email && u.password === input.password);

  if (!match) {
    throw new AuthApiError('Incorrect email or password.', 'form');
  }

  const { password: _omit, ...publicUser } = match;
  persistSession(publicUser);
  return publicUser;
}

export async function logout(): Promise<void> {
  // TODO(backend): replace with:
  //
  //   await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });

  await simulateNetworkDelay(150);
  window.localStorage.removeItem(SESSION_KEY);
  setSessionCookie(false);
}

/** Reads the current session synchronously from local storage (client-only). */
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

// TODO(backend): add a `fetchCurrentUser()` here that calls GET /api/auth/me
// with credentials: 'include', for cases where you want to re-validate the
// session against the server (e.g. on app load) rather than trusting the
// locally cached copy.
