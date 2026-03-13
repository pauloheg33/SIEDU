import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

/* ---------- helpers ---------- */

/** Race a promise against a timeout (ms). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), ms)
    ),
  ]);
}

/**
 * Ensure the Supabase session token is still valid before making any API call.
 * If expired (or about to expire within 60 s) it refreshes the token first.
 * A timeout prevents the call from hanging forever.
 *
 * Call this at the top of EVERY API function (reads & writes).
 */
export async function ensureFreshSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return; // Not logged in — let the query fail naturally with 401

  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && now >= session.expires_at - 60) {
    try {
      await withTimeout(supabase.auth.refreshSession(), 10_000);
    } catch (err) {
      console.warn('[Auth] Session refresh failed:', err);
      // Don't throw — let the Supabase query try anyway; if the old token still
      // works the call succeeds, otherwise it fails normally with a clear error.
    }
  }
}

/**
 * Returns the current authenticated user after ensuring the session is fresh.
 * Use this only in functions that need the user ID (create, upload, etc.).
 */
export async function getAuthenticatedUser() {
  await ensureFreshSession();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  return session.user;
}

/* ---------- visibility listener ---------- */
// When the browser tab becomes visible again after being in the background,
// proactively refresh the session so the next API call doesn't fail.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      ensureFreshSession();
    }
  });
}
