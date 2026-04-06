import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useImportExportStore } from "@/stores/importExportStore";
import { fetchImportLogs, undoImport } from "@/lib/importExport";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/error";
import { ChevronDown, ChevronRight, Undo2 } from "lucide-react";

export function ImportHistory() {
  const { logs, setLogs } = useImportExportStore();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [undoing, setUndoing] = useState<number | null>(null);

  const refreshLogs = () => {
    fetchImportLogs(20).then(setLogs).catch(() => {});
  };

  useEffect(() => {
    refreshLogs();
  }, [setLogs]);

  const handleUndo = async (logId: number) => {
    setUndoing(logId);
    try {
      const msg = await undoImport(logId);
      toast.success(msg);
      refreshLogs();
    } catch (err) {
      toast.error(`Undo failed: ${extractErrorMessage(err)}`);
    } finally {
      setUndoing(null);
    }
  };

  const parseErrors = (details: string | null): Array<{ row?: number; message?: string; runtime?: string }> => {
    if (!details) return [];
    try {
      const parsed = JSON.parse(details);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const isUndone = (log: { error_details: string | null }) =>
    log.error_details?.includes("[UNDONE]") ?? false;

  if (logs.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Import History</h3>
        <p className="text-sm text-muted-foreground">No imports yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Import History</h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Added</TableHead>
              <TableHead className="text-right">Skipped</TableHead>
              <TableHead className="text-right">Errors</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const errors = parseErrors(log.error_details);
              const hasErrors = errors.length > 0 && !isUndone(log);
              const undone = isUndone(log);
              const canUndo = log.rows_added > 0 && !!log.imported_ids && !undone;
              const isExpanded = expandedId === log.id;

              return (
                <>
                  <TableRow key={log.id} className={undone ? "opacity-50" : ""}>
                    <TableCell>
                      {hasErrors && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{log.imported_at}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.import_type}</Badge>
                      {undone && <Badge variant="destructive" className="ml-1">Undone</Badge>}
                    </TableCell>
                    <TableCell className="text-sm font-mono max-w-[200px] truncate">
                      {log.filename}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-medium">
                      {log.rows_added}
                    </TableCell>
                    <TableCell className="text-right text-yellow-600">
                      {log.rows_skipped}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {log.rows_errored}
                    </TableCell>
                    <TableCell className="text-right">
                      {canUndo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUndo(log.id)}
                          disabled={undoing === log.id}
                        >
                          <Undo2 className="h-4 w-4 mr-1" />
                          {undoing === log.id ? "Undoing…" : "Undo"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {hasErrors && isExpanded && (
                    <TableRow key={`${log.id}-errors`}>
                      <TableCell colSpan={8} className="bg-muted/30">
                        <div className="px-2 py-2 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            Error Details:
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-0.5">
                            {errors.map((e, i) => (
                              <p key={i} className="text-xs text-red-600 font-mono">
                                {e.row ? `Row ${e.row}: ${e.message}` : e.runtime ?? "Unknown error"}
                              </p>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
