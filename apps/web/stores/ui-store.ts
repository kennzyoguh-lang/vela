import { create } from "zustand";
import { persist } from "zustand/middleware";

// Zustand owns cross-cutting UI concerns ONLY — theme, sidebar collapsed
// state, current org context in multi-org accountant sessions (Handbook 4.5).
// Server data (anything with an org_id) never lives here — TanStack Query's
// cache is the only source of truth for that.
export type ThemeMode = "light" | "dark";
// Anti-theft/POS feature — English + Igbo toggle for the sale-logging UI.
export type Language = "en" | "ig";

interface UiState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      language: "en",
      setLanguage: (language) => set({ language }),
    }),
    { name: "vela-ui-preferences" },
  ),
);
