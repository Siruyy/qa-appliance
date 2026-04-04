import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores/settingsStore";
import { useNavigate } from "react-router-dom";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const penaltyChecked = useRef(false);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const navigate = useNavigate();

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
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "n") {
        e.preventDefault();
        navigate("/sales/new");
      } else if (ctrl && e.key === ",") {
        e.preventDefault();
        navigate("/settings");
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
        <main className="flex-1 overflow-y-auto bg-[var(--background)] p-6">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
