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

/**
 * No-op kept for API compatibility.
 * The Supabase client's autoRefreshToken handles token renewal automatically
 * in the background. Calling refreshSession() manually can cause internal
 * lock contention that makes ALL subsequent getSession() calls hang forever.
 */
export async function ensureFreshSession(): Promise<void> {}

/**
 * Returns the current authenticated user from the cached local session.
 * No network call is made — autoRefreshToken renews the token in the background.
 */
export async function getAuthenticatedUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user;
}

/**
 * Creates an AbortSignal that fires after timeoutMs milliseconds (default 15 s).
 * Attach to Supabase query builders with .abortSignal() to prevent indefinite hangs
 * caused by a paused project, slow network, or other connection issues.
 */
export function querySignal(timeoutMs = 15_000): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}
