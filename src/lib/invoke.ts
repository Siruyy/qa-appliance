import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/**
 * Typed wrapper around Tauri's invoke. All IPC calls go through here
 * for consistent error handling and type safety.
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`[invoke] ${cmd} failed:`, error);
    }
    throw error;
  }
}
