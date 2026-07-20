// frontend/src/lib/auth.ts
// Full auth helper — saves token to both localStorage AND cookie
// Cookie is needed for Next.js middleware (server-side route protection)
// localStorage is used for client-side API calls

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  access_token: string;
  token_type: string;
}

export interface UserProfile {
  id: string | number;  // Changed to handle both string and number UUIDs
  email: string;
  name?: string;
  role?: string;
  created_at?: string;
}

export interface AuthError {
  detail: string;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

export function saveToken(token: string) {
  localStorage.setItem("krita_access_token", token);
  document.cookie = `krita_token=${token}; path=/; max-age=${30 * 60}; SameSite=Strict`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("krita_access_token");
}

export function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  // Try to get from cookie first
  const cookies = document.cookie.split('; ');
  const userIdCookie = cookies.find(row => row.startsWith('user_id='));
  if (userIdCookie) {
    return userIdCookie.split('=')[1];
  }
  // Fallback to localStorage
  return localStorage.getItem("krita_user_id");
}

export function saveUserId(userId: string) {
  if (!userId) return;
  localStorage.setItem("krita_user_id", userId);
  document.cookie = `user_id=${userId}; path=/; max-age=${30 * 60}; SameSite=Strict`;
}

export function removeToken() {
  localStorage.removeItem("krita_access_token");
  localStorage.removeItem("krita_user_id");
  document.cookie = "krita_token=; path=/; max-age=0";
  document.cookie = "user_id=; path=/; max-age=0";
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function logout() {
  removeToken();
  window.location.href = "/login";
}

// ─── Auth headers helper ──────────────────────────────────────────────────────

export function authHeaders(): Record<string, string> {
  const token = getToken();
  // DEV fallback: send dev-token if no real token stored
  return { Authorization: `Bearer ${token || "dev-token"}` };
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function loginUser(
  email: string,
  password: string
): Promise<AuthTokens & { user?: UserProfile }> {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  // ✅ FIX: Changed from /auth/login to /api/auth/login
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  if (!res.ok) {
    const err: AuthError = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Login failed");
  }

  const data = await res.json();
  
  // Save the token
  saveToken(data.access_token);
  
  // ✅ Save user data from the response
  if (data.user) {
    // Save user_id from the user object
    if (data.user.id) {
      saveUserId(String(data.user.id));
    }
    
    // Optionally save user data in localStorage for quick access
    try {
      localStorage.setItem("krita_user", JSON.stringify(data.user));
    } catch (e) {
      // Ignore storage errors
    }
  }
  
  return data;
}

export async function registerUser(
  email: string,
  password: string,
  name?: string,
  role?: string
): Promise<{ message: string; user?: UserProfile }> {
  // ✅ FIX: Changed from /auth/signup to /api/auth/signup
  const params = new URLSearchParams({ 
    email, 
    password,
    ...(name && { name }),
    ...(role && { role })
  });

  const res = await fetch(`${API_BASE}/api/auth/signup?${params.toString()}`, {
    method: "POST",
  });

  if (!res.ok) {
    const err: AuthError = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "Registration failed");
  }

  return res.json();
}

export async function getCurrentUser(): Promise<UserProfile> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  // ✅ FIX: Changed from /auth/me to /api/auth/me
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) removeToken();
    throw new Error("Session expired. Please log in again.");
  }

  const userData = await res.json();
  
  // ✅ Save user_id when we get the current user
  if (userData.id) {
    const userId = String(userData.id);
    saveUserId(userId);
    
    // Cache user data
    try {
      localStorage.setItem("krita_user", JSON.stringify(userData));
    } catch (e) {
      // Ignore storage errors
    }
  }
  
  return userData;
}

// ─── Optional: Get cached user data ──────────────────────────────────────────

export function getCachedUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const userStr = localStorage.getItem("krita_user");
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}