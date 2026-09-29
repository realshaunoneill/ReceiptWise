/**
 * Remembers an invitation link across sign-up.
 *
 * The auth pages force-redirect to /redirect after sign-in or sign-up, so a person who opened
 * /invite/<token> signed out and then created an account would land on /upgrade with the
 * invitation forgotten. The invite page stores the token here; /redirect sends them back to it.
 * localStorage survives the OAuth round trip through Google.
 */
const STORAGE_KEY = 'rw-pending-invite';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function rememberPendingInvite(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, savedAt: Date.now() }));
  } catch {
    // Storage unavailable (private mode): the link still works if they reopen it.
  }
}

export function takePendingInvite(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    localStorage.removeItem(STORAGE_KEY);
    const { token, savedAt } = JSON.parse(raw) as { token?: string; savedAt?: number };
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    if (!savedAt || Date.now() - savedAt > MAX_AGE_MS) return null;
    return token;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
