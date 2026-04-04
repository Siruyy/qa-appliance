import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores/settingsStore";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const penaltyChecked = useRef(false);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

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
