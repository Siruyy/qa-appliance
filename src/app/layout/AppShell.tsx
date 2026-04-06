import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import { invoke } from "@/lib/invoke";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import { useNavigate } from "react-router-dom";
import type { PenaltyApplied } from "@/types/account";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { CommandPalette } from "@/components/CommandPalette";
import { HelpFAB } from "@/components/help/HelpFAB";
import { HelpCenterDialog } from "@/components/help/HelpCenterDialog";
import { PageHelpSheet } from "@/components/help/PageHelpSheet";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const penaltyChecked = useRef(false);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const theme = useUIStore((s) => s.theme);
  const navigate = useNavigate();
  const setHelpCenterOpen = useUIStore((s) => s.setHelpCenterOpen);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

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

    invoke<PenaltyApplied[]>("run_penalty_check")
      .then((applied) => {
        if (applied.length > 0) {
          toast.warning(`${applied.length} penalty/penalties applied to overdue accounts`);
        }
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.error("Penalty check failed:", err);
        }
      });
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      } else if (ctrl && e.key === "n") {
        e.preventDefault();
        navigate("/sales/new");
      } else if (ctrl && e.key === ",") {
        e.preventDefault();
        navigate("/settings");
      } else if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      } else if ((ctrl && e.key === "/") || e.key === "F1") {
        e.preventDefault();
        setHelpCenterOpen(true);
      }
    },
    [navigate, setHelpCenterOpen]
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
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <PageHelpSheet />
      <HelpCenterDialog />
      <HelpFAB />
    </div>
  );
}
