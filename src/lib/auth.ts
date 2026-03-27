import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setAccessToken: (token: string) => void;
}

/**
 * Auth store.
 * - accessToken is stored in memory only (never in localStorage/sessionStorage).
 * - Refresh Token lives in httpOnly cookie managed by the API server.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  setAuth: (token, user) => set({ accessToken: token, user }),
  clearAuth: () => set({ accessToken: null, user: null }),
  setAccessToken: (token) => set({ accessToken: token }),
}));
