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
  const { data: { session } } = await withTimeout(
    supabase.auth.getSession(),
    12_000,
    'Falha ao validar sessão. Faça login novamente.',
  );
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

export async function withTimeout<T>(
  operation: PromiseLike<T> | T,
  timeoutMs = 20_000,
  errorMessage = 'Tempo de conexão esgotado. Tente novamente.',
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    return await Promise.race<T>([
      Promise.resolve(operation),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
