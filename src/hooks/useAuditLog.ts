import { extractErrorMessage } from "@/lib/error";
import { useCallback, useState } from "react";
import { invoke } from "@/lib/invoke";
import type { PaginatedResult } from "@/types/shared";
import type { AuditEntry } from "@/types/audit";
import { toast } from "sonner";

export type { AuditEntry } from "@/types/audit";

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const fetchAuditLog = useCallback(
    async (actionFilter?: string, entityTypeFilter?: string) => {
      setLoading(true);
      try {
        const result = await invoke<PaginatedResult<AuditEntry>>(
          "get_audit_log",
          {
            page,
            pageSize,
            actionFilter: actionFilter || null,
            entityTypeFilter: entityTypeFilter || null,
          }
        );
        setEntries(result.items);
        setTotal(result.total);
      } catch (e) {
        toast.error(`Failed to load audit log: ${extractErrorMessage(e)}`);
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize]
  );

  return { entries, total, loading, page, setPage, pageSize, fetchAuditLog };
}
