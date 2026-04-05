import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Pagination } from "@/components/Pagination";
import { formatDate } from "@/lib/formatters";

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  sale_created: { label: "Sale Created", variant: "default" },
  sale_voided: { label: "Sale Voided", variant: "destructive" },
  payment_recorded: { label: "Payment", variant: "secondary" },
  penalty_applied: { label: "Penalty", variant: "outline" },
};

export function AuditLogViewer() {
  const { entries, total, loading, page, setPage, pageSize, fetchAuditLog } =
    useAuditLog();
  const [actionFilter, setActionFilter] = useState<string>("");
  const [entityFilter, setEntityFilter] = useState<string>("");

  useEffect(() => {
    fetchAuditLog(
      actionFilter || undefined,
      entityFilter || undefined
    );
  }, [fetchAuditLog, actionFilter, entityFilter]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
        <p className="text-sm text-muted-foreground">
          Financial operation history — sales, payments, voids, and penalties.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Select value={actionFilter} onValueChange={(v: string | null) => { setActionFilter(!v || v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="sale_created">Sale Created</SelectItem>
              <SelectItem value="sale_voided">Sale Voided</SelectItem>
              <SelectItem value="payment_recorded">Payment</SelectItem>
              <SelectItem value="penalty_applied">Penalty</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={(v: string | null) => { setEntityFilter(!v || v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="account">Account</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No audit entries found.
          </p>
        ) : (
          <>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Date</TableHead>
                    <TableHead className="w-36">Action</TableHead>
                    <TableHead className="w-24">Entity</TableHead>
                    <TableHead className="w-16 text-right">ID</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => {
                    const actionInfo = ACTION_LABELS[e.action] ?? {
                      label: e.action,
                      variant: "outline" as const,
                    };
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(e.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={actionInfo.variant}>
                            {actionInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {e.entity_type}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {e.entity_id ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {e.details ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
