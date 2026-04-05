import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { Plus, Search, X, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/DatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import { useSaleStore } from "@/stores/saleStore";
import { useSales } from "@/hooks/useSales";
import { SaleDetailModal } from "./SaleDetailModal";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";

export function SalesHistoryPage() {
  const navigate = useNavigate();
  const { fetchSales } = useSales();
  const {
    filters,
    setFilter,
    resetFilters,
    filteredSales,
    loading,
    sales: rawSales,
    page,
    pageSize,
    totalCount,
    setPage,
  } = useSaleStore();

  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const sales = useMemo(() => filteredSales(), [rawSales, filters]);

  const openDetail = (id: number) => {
    setSelectedSaleId(id);
    setDetailOpen(true);
  };

  const { format: formatCurrency } = useCurrency();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales History"
        description="View and manage past sales transactions."
        actions={
          <Button onClick={() => navigate("/sales/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            New Sale
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer or sale #..."
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.paymentType}
          onValueChange={(v) => v && setFilter("paymentType", v as typeof filters.paymentType)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="installment">Installment</SelectItem>
          </SelectContent>
        </Select>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <DatePicker
            value={filters.dateFrom}
            onChange={(v) => setFilter("dateFrom", v)}
            className="w-[150px]"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <DatePicker
            value={filters.dateTo}
            onChange={(v) => setFilter("dateTo", v)}
            className="w-[150px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={filters.includeVoided}
            onCheckedChange={(c) => {
              setFilter("includeVoided", !!c);
              fetchSales();
            }}
          />
          <Label className="text-sm">Show voided</Label>
        </div>

        {(filters.search || filters.paymentType !== "all" || filters.dateFrom || filters.dateTo || filters.includeVoided) && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1">
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableSkeleton cols={6} rows={5} />
          </Table>
        </div>
      ) : sales.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No sales found"
          description="Sales will appear here once recorded."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow
                  key={sale.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(sale.id)}
                >
                  <TableCell className="font-mono text-muted-foreground">
                    {sale.id}
                  </TableCell>
                  <TableCell>{formatDate(sale.sale_date)}</TableCell>
                  <TableCell>{sale.customer_name ?? "Walk-in"}</TableCell>
                  <TableCell>
                    <Badge variant={sale.payment_type === "cash" ? "default" : "secondary"}>
                      {sale.payment_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(sale.total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={sale.status === "voided" ? "destructive" : "outline"}>
                      {sale.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SaleDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        saleId={selectedSaleId}
        onVoided={fetchSales}
      />
      <Pagination
        page={page}
        pageSize={pageSize}
        total={totalCount}
        onPageChange={setPage}
      />
    </div>
  );
}
