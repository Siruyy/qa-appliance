import { create } from "zustand";
import type { ImportLog, ImportPreview } from "@/types/import-export";

type ImportType = "products" | "customers" | "balances";

interface ImportExportState {
  // Export
  exportLoading: boolean;
  setExportLoading: (v: boolean) => void;

  // Import workflow
  importType: ImportType;
  setImportType: (t: ImportType) => void;
  selectedFile: string | null;
  setSelectedFile: (f: string | null) => void;
  preview: ImportPreview | null;
  setPreview: (p: ImportPreview | null) => void;
  importing: boolean;
  setImporting: (v: boolean) => void;

  // Import logs
  logs: ImportLog[];
  setLogs: (logs: ImportLog[]) => void;

  // Reset
  resetImport: () => void;
}

/** Zustand store for import/export workflow state. */
export const useImportExportStore = create<ImportExportState>((set) => ({
  exportLoading: false,
  setExportLoading: (v) => set({ exportLoading: v }),

  importType: "products",
  setImportType: (t) => set({ importType: t }),
  selectedFile: null,
  setSelectedFile: (f) => set({ selectedFile: f }),
  preview: null,
  setPreview: (p) => set({ preview: p }),
  importing: false,
  setImporting: (v) => set({ importing: v }),

  logs: [],
  /** Set import logs, keeping only the last 100 entries. */
  setLogs: (logs) => set({ logs: logs.slice(-100) }),

  /** Reset the import workflow state (file, preview, importing flag). */
  resetImport: () =>
    set({
      selectedFile: null,
      preview: null,
      importing: false,
    }),
}));
