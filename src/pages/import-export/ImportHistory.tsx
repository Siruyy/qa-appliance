import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useImportExportStore } from "@/stores/importExportStore";
import { fetchImportLogs } from "@/lib/importExport";

export function ImportHistory() {
  const { logs, setLogs } = useImportExportStore();

  useEffect(() => {
    fetchImportLogs(20).then(setLogs).catch(() => {});
  }, [setLogs]);

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
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Added</TableHead>
              <TableHead className="text-right">Skipped</TableHead>
              <TableHead className="text-right">Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">{log.imported_at}</TableCell>
                <TableCell>
                  <Badge variant="outline">{log.import_type}</Badge>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
