import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Page help sheet (right slide-out) */
  helpSheetOpen: boolean;
  setHelpSheetOpen: (open: boolean) => void;
  /** Global help center dialog */
  helpCenterOpen: boolean;
  setHelpCenterOpen: (open: boolean) => void;
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {}
  return "system";
}

function getInitialSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem("sidebarCollapsed") === "true";
  } catch {}
  return false;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: getInitialSidebarCollapsed(),
  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      try { localStorage.setItem("sidebarCollapsed", String(next)); } catch {}
      return { sidebarCollapsed: next };
    }),
  theme: getInitialTheme(),
  setTheme: (theme) => {
    try { localStorage.setItem("theme", theme); } catch {}
    set({ theme });
  },
  helpSheetOpen: false,
  setHelpSheetOpen: (open) => set({ helpSheetOpen: open }),
  helpCenterOpen: false,
  setHelpCenterOpen: (open) => set({ helpCenterOpen: open }),
}));
