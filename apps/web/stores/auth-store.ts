import { create } from "zustand";

// In-memory only, deliberately not persisted (Handbook 8.1) — an access token
// in localStorage/sessionStorage is readable by any script running on the
// page; keeping it in memory means a reload starts with none and the API
// client (lib/api/client.ts) silently exchanges the httpOnly refresh cookie
// for a fresh one on the first authenticated call.
interface AuthState {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  setAccessToken: (token) => set({ accessToken: token }),
}));
