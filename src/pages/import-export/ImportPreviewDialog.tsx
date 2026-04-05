import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ImportPreview } from "@/types/import-export";

// ── Generic preview table for valid rows ─────────────

function PreviewTable({
  rows,
}: {
  rows: { row: number; data: Record<string, string> }[];
}) {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0].data);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Row</TableHead>
          {columns.map((col) => (
            <TableHead key={col} className="text-xs">
              {col}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.row}>
            <TableCell>{r.row}</TableCell>
            {columns.map((col) => (
              <TableCell key={col} className="text-xs max-w-[150px] truncate">
                {r.data[col] ?? ""}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Import Preview Dialog ────────────────────────────

export interface ImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preview: ImportPreview | null;
  onConfirm: () => void;
  importing: boolean;
  importType: string;
}

export function ImportPreviewDialog({
  open,
  onOpenChange,
  preview,
  onConfirm,
  importing,
  importType,
}: ImportPreviewDialogProps) {
  if (!preview) return null;

  const totalRows =
    preview.valid_rows.length + preview.error_rows.length + preview.skip_rows.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Preview — {importType}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 mb-4">
          <Card className="flex-1 p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{preview.valid_rows.length}</div>
            <div className="text-xs text-muted-foreground">Valid</div>
          </Card>
          <Card className="flex-1 p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{preview.error_rows.length}</div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </Card>
          <Card className="flex-1 p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{preview.skip_rows.length}</div>
            <div className="text-xs text-muted-foreground">Skipped</div>
          </Card>
          <Card className="flex-1 p-3 text-center">
            <div className="text-2xl font-bold">{totalRows}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </Card>
        </div>

        <Tabs defaultValue="valid" className="flex-1">
          <TabsList className="w-full">
            <TabsTrigger value="valid" className="flex-1">
              Valid ({preview.valid_rows.length})
            </TabsTrigger>
            <TabsTrigger value="errors" className="flex-1">
              Errors ({preview.error_rows.length})
            </TabsTrigger>
            <TabsTrigger value="skipped" className="flex-1">
              Skipped ({preview.skip_rows.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[300px] mt-2">
            <TabsContent value="valid">
              {preview.valid_rows.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No valid rows.</p>
              ) : (
                <>
                  <PreviewTable
                    rows={preview.valid_rows.slice(0, 50).map((r) => ({
                      row: r.row_number,
                      data: r.data,
                    }))}
                  />
                  {preview.valid_rows.length > 50 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Showing first 50 of {preview.valid_rows.length} rows
                    </p>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="errors">
              {preview.error_rows.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No errors.</p>
              ) : (
                <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.error_rows.slice(0, 50).map((r) => (
                      <TableRow key={r.row_number}>
                        <TableCell>{r.row_number}</TableCell>
                        <TableCell>
                          {r.errors.map((e, i) => (
                            <Badge key={i} variant="destructive" className="mr-1 mb-1 text-xs">
                              {e}
                            </Badge>
                          ))}
                        </TableCell>
                        <TableCell className="text-xs font-mono max-w-[200px] truncate">
                          {Object.values(r.data).filter(Boolean).join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.error_rows.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Showing first 50 of {preview.error_rows.length} rows
                  </p>
                )}
                </>
              )}
            </TabsContent>

            <TabsContent value="skipped">
              {preview.skip_rows.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No skipped rows.</p>
              ) : (
                <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.skip_rows.slice(0, 50).map((r) => (
                      <TableRow key={r.row_number}>
                        <TableCell>{r.row_number}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {r.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono max-w-[200px] truncate">
                          {Object.values(r.data).filter(Boolean).join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.skip_rows.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Showing first 50 of {preview.skip_rows.length} rows
                  </p>
                )}
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={importing || preview.valid_rows.length === 0}
          >
            {importing
              ? "Importing…"
              : `Import ${preview.valid_rows.length} row${preview.valid_rows.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
