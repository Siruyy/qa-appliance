/** Extract a user-friendly message from an unknown error */
export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "An unexpected error occurred";
}

/** Get a user-friendly error message with recovery suggestion */
export function getErrorWithRecovery(err: unknown, context?: string): string {
  const msg = extractErrorMessage(err);
  const recoveryHints: Record<string, string> = {
    "Failed to load": "Try refreshing the page.",
    "Failed to save": "Check your input and try again.",
    "Failed to delete": "The item may be in use. Check for dependencies.",
    "Failed to create": "Verify all required fields are filled.",
    "database is locked": "Another operation is in progress. Wait a moment and retry.",
    "UNIQUE constraint": "A record with this information already exists.",
  };

  for (const [key, hint] of Object.entries(recoveryHints)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) {
      return `${msg}. ${hint}`;
    }
  }

  return context ? `${context}: ${msg}` : msg;
}
