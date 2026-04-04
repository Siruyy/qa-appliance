import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import { invoke } from "@/lib/invoke";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import { useNavigate } from "react-router-dom";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const penaltyChecked = useRef(false);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const theme = useUIStore((s) => s.theme);
  const navigate = useNavigate();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Apply dark class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const isDark = theme === "dark" || (theme === "system" && mq.matches);
      root.classList.toggle("dark", isDark);
    };
    apply();
    if (theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (penaltyChecked.current) return;
    penaltyChecked.current = true;

    invoke<number>("run_penalty_check")
      .then((count) => {
        if (count > 0) {
          toast.warning(`${count} penalty/penalties applied to overdue accounts`);
        }
      })
      .catch((err) => {
        console.error("Penalty check failed:", err);
      });
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "n") {
        e.preventDefault();
        navigate("/sales/new");
      } else if (ctrl && e.key === ",") {
        e.preventDefault();
        navigate("/settings");
      } else if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      }
    },
    [navigate]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
