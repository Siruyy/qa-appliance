import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {}
  return "system";
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  theme: getInitialTheme(),
  setTheme: (theme) => {
    try { localStorage.setItem("theme", theme); } catch {}
    set({ theme });
  },
}));
