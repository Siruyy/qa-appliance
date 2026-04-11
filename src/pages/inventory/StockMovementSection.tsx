import { useState, useEffect, useMemo } from "react";
import { invoke } from "@/lib/invoke";
import { formatDateTime, formatVariantLabel } from "@/lib/formatters";
import { extractErrorMessage } from "@/lib/error";
import type { StockMovement } from "@/types/stock-movement";
import type { ProductVariant } from "@/types/product";

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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Search,
  ArrowUpDown,
} from "lucide-react";

const REASON_LABELS: Record<string, string> = {
  sale: "Sale",
  void: "Sale Voided",
  adjustment: "Manual Adjust",
  initial: "Initial Stock",
  backfill: "Backfill",
};

const PAGE_SIZE = 15;

interface Props {
  productId: number;
  variants: ProductVariant[];
}

export function StockMovementSection({ productId, variants }: Props) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [variantFilter, setVariantFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError(null);
    invoke<StockMovement[]>("get_stock_movements", { productId, limit: 500 })
      .then(setMovements)
      .catch((e) => setError(extractErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [productId]);

  const filtered = useMemo(() => {
    let result = movements;
    if (variantFilter !== "all") {
      result = result.filter((m) => String(m.variant_id) === variantFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.reason.toLowerCase().includes(q) ||
          (m.variant_label ?? "").toLowerCase().includes(q) ||
          (m.notes ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [movements, variantFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reason, notes…"
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        {variants.length > 1 && (
          <Select value={variantFilter} onValueChange={(v) => { setVariantFilter(v ?? "all"); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All variants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All variants</SelectItem>
              {variants.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.sku || `Variant #${v.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ArrowUpDown className="h-8 w-8 mb-2" />
          <p className="text-sm">{search || variantFilter !== "all" ? "No movements match your filters" : "No stock movements recorded yet"}</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">+/-</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {m.delta > 0 ? (
                        <ArrowUpCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatVariantLabel(m.variant_label) || `Variant #${m.variant_id}`}
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
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              {filtered.length === 0
                ? "No results"
                : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} movement(s)`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹ Prev
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next ›
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
