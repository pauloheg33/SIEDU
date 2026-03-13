import { create } from 'zustand';
import { authAPI } from '@/lib/api';
import { supabase, ensureFreshSession } from '@/lib/supabase';
import type { User } from '@/types';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

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
    set({ isLoading: true });
    
    // Check for existing session, refresh if needed
    await ensureFreshSession();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      try {
        const user = await authAPI.getUser();
        set({ user, isAuthenticated: !!user, isLoading: false });
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' && session) {
        const user = await authAPI.getUser();
        set({ user, isAuthenticated: !!user });
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Session was refreshed — keep user state consistent
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) {
          const user = await authAPI.getUser();
          set({ user, isAuthenticated: !!user });
        }
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, isAuthenticated: false });
      }
    });
  },

  login: async (data: { email: string; password: string }) => {
    set({ isLoading: true });
    try {
      await authAPI.login(data);
      const user = await authAPI.getUser();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data: { name: string; email: string; password: string }) => {
    set({ isLoading: true });
    try {
      await authAPI.register(data);
      // Auto-login after registration
      await authAPI.login({ email: data.email, password: data.password });
      const user = await authAPI.getUser();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      set({ user: null, isAuthenticated: false });
    }
  },

  loadUser: async () => {
    await ensureFreshSession();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const user = await authAPI.getUser();
      set({ user, isAuthenticated: !!user, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
