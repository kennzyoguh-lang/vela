import { create } from "zustand";
import { persist } from "zustand/middleware";

// Zustand owns cross-cutting UI concerns ONLY — theme, sidebar collapsed
// state, current org context in multi-org accountant sessions (Handbook 4.5).
// Server data (anything with an org_id) never lives here — TanStack Query's
// cache is the only source of truth for that.
export type ThemeMode = "light" | "dark";

interface UiState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "vela-ui-preferences" },
  ),
);
