import { create } from 'zustand';

type Role = 'admin' | 'viewer';

interface AuthState {
  accessToken: string | null;
  userId: string | null;
  role: Role | null;
  expiresAt: number | null; // Date.now() + expiresIn * 1000

  setTokens: (accessToken: string, userId: string, role: Role, expiresIn: number) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  needsRefresh: () => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  accessToken: null,
  userId: null,
  role: null,
  expiresAt: null,

  setTokens: (accessToken, userId, role, expiresIn) => {
    set({
      accessToken,
      userId,
      role,
      expiresAt: Date.now() + expiresIn * 1000,
    });
  },

  clearAuth: () => {
    set({ accessToken: null, userId: null, role: null, expiresAt: null });
  },

  isAuthenticated: () => {
    const { accessToken, expiresAt } = get();
    if (!accessToken) return false;
    if (expiresAt !== null && Date.now() >= expiresAt) return false;
    return true;
  },

  isAdmin: () => get().role === 'admin',

  needsRefresh: () => {
    const { accessToken, expiresAt } = get();
    if (!accessToken || expiresAt === null) return false;
    return expiresAt - Date.now() < 60_000;
  },
}));
