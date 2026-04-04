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
  setLogs: (logs) => set({ logs }),

  resetImport: () =>
    set({
      selectedFile: null,
      preview: null,
      importing: false,
    }),
}));
