import { getStoredUser } from "@/lib/auth";

// Resolves to the real logged-in user's id via /auth/me, or null if nobody
// is logged in / the token is invalid. Cached for the lifetime of the page
// so we don't hit /auth/me on every render.
let cachedUserId: string | null | undefined = undefined;

export async function getCurrentUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId;

  if (typeof window === "undefined") {
    cachedUserId = null;
    return null;
  }

  const storedUser = getStoredUser();
  if (!storedUser) {
    cachedUserId = null;
    return null;
  }

  try {
    // Note: getStoredUser returns the user object from localStorage.
    // We use its id field.
    // NOTE: auth.ts types User.id as `number`, but users.id is uuid —
    // the real runtime value is a uuid string. String() here regardless of
    // which one actually comes back. Worth correcting the type in auth.ts.
    cachedUserId = String(storedUser.id);
  } catch {
    cachedUserId = null;
  }

  return cachedUserId;
}

// Call after login/logout so the next getCurrentUserId() re-checks instead
// of serving a stale cached value.
export function clearCachedUserId() {
  cachedUserId = undefined;
}