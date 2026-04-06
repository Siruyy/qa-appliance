import { useState, useEffect } from "react";
import { invoke } from "@/lib/invoke";
import { formatDateTime } from "@/lib/formatters";
import { extractErrorMessage } from "@/lib/error";
import type { StockMovement } from "@/types/stock-movement";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Search,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Filter to a specific product (optional) */
  productId?: number;
}

const REASON_LABELS: Record<string, string> = {
  sale: "Sale",
  void: "Sale Voided",
  adjustment: "Manual Adjust",
  initial: "Initial Stock",
  backfill: "Backfill",
};

export function StockMovementLog({ open, onClose, productId }: Props) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);

    const args: Record<string, unknown> = { limit: 500 };
    if (productId) args.product_id = productId;

    invoke<StockMovement[]>("get_stock_movements", args)
      .then(setMovements)
      .catch((e) => setError(extractErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [open, productId]);

  const filtered = search.trim()
    ? movements.filter(
        (m) =>
          m.product_name.toLowerCase().includes(search.toLowerCase()) ||
          (m.variant_label ?? "").toLowerCase().includes(search.toLowerCase()) ||
          m.reason.toLowerCase().includes(search.toLowerCase()) ||
          (m.notes ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : movements;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Stock Movement History</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search product, reason, or notes…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">+/-</TableHead>
                <TableHead>Product / Variant</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Qty Change</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-destructive py-8">
                    {error}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {search ? "No movements match your search" : "No stock movements recorded yet"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {m.delta > 0 ? (
                        <ArrowUpCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{m.product_name}</div>
                      {m.variant_label && (
                        <div className="text-xs text-muted-foreground">{m.variant_label}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {REASON_LABELS[m.reason] ?? m.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      <span className={m.delta > 0 ? "text-green-600" : "text-red-500"}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.reference_type && m.reference_id
                        ? `${m.reference_type} #${m.reference_id}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {m.notes || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(m.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="text-xs text-muted-foreground text-right">
            Showing {filtered.length} of {movements.length} movement(s)
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
