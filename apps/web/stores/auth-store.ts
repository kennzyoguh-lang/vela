import { create } from "zustand";

// In-memory only, deliberately not persisted (Handbook 8.1) — an access token
// in localStorage/sessionStorage is readable by any script running on the
// page; keeping it in memory means a reload starts with none and the API
// client (lib/api/client.ts) silently exchanges the httpOnly refresh cookie
// for a fresh one on the first authenticated call.
//
// challengeToken carries the same in-memory-only posture — it's short-lived
// (5 minutes) and single-purpose (only redeemable at /v1/auth/2fa/verify),
// but the reasoning for never touching Web Storage applies identically: it's
// XSS-readable there, no better than nothing against the threat this app is
// already designed around.
interface AuthState {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  challengeToken: string | null;
  setChallengeToken: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  setAccessToken: (token) => set({ accessToken: token }),
  challengeToken: null,
  setChallengeToken: (token) => set({ challengeToken: token }),
}));
