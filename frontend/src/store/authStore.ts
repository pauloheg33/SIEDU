import { create } from 'zustand';
import { authAPI } from '@/lib/api';
import { supabase, ensureFreshSession, withTimeout } from '@/lib/supabase';
import type { User } from '@/types';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

let hasInitializedAuth = false;
let authUnsubscribe: (() => void) | null = null;
let isIntentionalLogout = false;

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    if (hasInitializedAuth) return;
    hasInitializedAuth = true;
    set({ isLoading: true });

    try {
      await ensureFreshSession();
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        12_000,
        'Não foi possível validar sua sessão.',
      );

      if (session) {
        const user = await withTimeout(authAPI.getUser(), 12_000, 'Falha ao carregar usuário.');
        set({ user, isAuthenticated: !!user, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }

    if (authUnsubscribe) {
      authUnsubscribe();
      authUnsubscribe = null;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' && session) {
        try {
          const user = await withTimeout(authAPI.getUser(), 12_000, 'Falha ao carregar usuário.');
          set({ user, isAuthenticated: !!user, isLoading: false });
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) {
          try {
            const user = await withTimeout(authAPI.getUser(), 12_000, 'Falha ao carregar usuário.');
            set({ user, isAuthenticated: !!user, isLoading: false });
          } catch {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        }
      } else if (event === 'SIGNED_OUT') {
        if (!isIntentionalLogout) {
          // Token refresh may have failed transiently (e.g. background tab).
          // Wait a moment for startAutoRefresh() (visibilitychange) to recover.
          await new Promise((r) => setTimeout(r, 1500));
          const { data: { session: recovered } } = await supabase.auth.getSession();
          if (recovered) {
            // Session was recovered – do NOT clear auth state.
            return;
          }
        }
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    });

    authUnsubscribe = () => subscription.unsubscribe();
  },

  login: async (data: { email: string; password: string }) => {
    set({ isLoading: true });
    try {
      await withTimeout(authAPI.login(data), 15_000, 'Tempo esgotado ao fazer login.');
      const user = await withTimeout(authAPI.getUser(), 12_000, 'Falha ao carregar usuário.');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data: { name: string; email: string; password: string }) => {
    set({ isLoading: true });
    try {
      await withTimeout(authAPI.register(data), 15_000, 'Tempo esgotado ao cadastrar.');
      await withTimeout(
        authAPI.login({ email: data.email, password: data.password }),
        15_000,
        'Tempo esgotado ao entrar após cadastro.',
      );
      const user = await withTimeout(authAPI.getUser(), 12_000, 'Falha ao carregar usuário.');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    isIntentionalLogout = true;
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      isIntentionalLogout = false;
      set({ user: null, isAuthenticated: false });
    }
  },

  loadUser: async () => {
    try {
      await ensureFreshSession();
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        12_000,
        'Não foi possível validar sua sessão.',
      );

      if (!session) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      set({ isLoading: true });
      const user = await withTimeout(authAPI.getUser(), 12_000, 'Falha ao carregar usuário.');
      set({ user, isAuthenticated: !!user, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
