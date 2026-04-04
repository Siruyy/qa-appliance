import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import {
  Search,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  CreditCard,
  XCircle,
} from "lucide-react";

import { useAccounts } from "@/hooks/useAccounts";
import { useAccountStore } from "@/stores/accountStore";
import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableSkeleton } from "@/components/TableSkeleton";
const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "default",
  paid: "secondary",
  defaulted: "destructive",
};

export function AccountsPage() {
  const navigate = useNavigate();
  const { fetchAccounts } = useAccounts();
  const {
    loading,
    search,
    statusFilter,
    typeFilter,
    setSearch,
    setStatusFilter,
    setTypeFilter,
    filteredAccounts,
    overdueCount,
    accounts: rawAccounts,
    page,
    pageSize,
    totalCount,
    setPage,
  } = useAccountStore();

  const accounts = useMemo(() => filteredAccounts(), [rawAccounts, search, statusFilter, typeFilter]);
  const overdue = useMemo(() => overdueCount(), [rawAccounts]);

  useEffect(() => {
    fetchAccounts(
      statusFilter === "all" ? undefined : statusFilter,
      typeFilter === "all" ? undefined : typeFilter,
      search || undefined
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter, typeFilter, search]);

  const handleStatusChange = (value: string | null) => {
    if (!value) return;
    setStatusFilter(value as "all" | "open" | "overdue" | "paid" | "defaulted");
  };

  const handleTypeChange = (value: string | null) => {
    if (!value) return;
    setTypeFilter(value as "all" | "installment" | "utang");
  };

  const { format: formatCurrency } = useCurrency();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts / Receivables"
        description="Track all open installment and utang accounts."
      />

      {overdue > 0 && (
        <div
          className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 cursor-pointer hover:bg-destructive/10 transition-colors"
          onClick={() => setStatusFilter("overdue")}
        >
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">
            {overdue} account{overdue !== 1 ? "s are" : " is"} overdue.{" "}
            <span className="underline">View overdue →</span>
          </span>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customer name..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="defaulted">Defaulted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="installment">Installment</SelectItem>
            <SelectItem value="utang">Utang</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Next Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton cols={7} rows={5} />
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No accounts found
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((a) => (
                <TableRow
                  key={a.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/accounts/${a.id}`)}
                >
                  <TableCell className="font-medium">{a.customer_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{a.product_summary}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(a.balance_remaining)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {a.has_schedule ? "Installment" : "Utang"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.next_due_date ? formatDate(a.next_due_date) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.is_overdue ? "destructive" : statusVariant[a.status] ?? "outline"}>
                      {a.is_overdue ? "OVERDUE" : a.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/accounts/${a.id}`)}>
                          <Eye className="mr-2 h-4 w-4" /> View Detail
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/accounts/${a.id}?action=pay`)}>
                          <CreditCard className="mr-2 h-4 w-4" /> Record Payment
                        </DropdownMenuItem>
                        {a.status === "open" && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/accounts/${a.id}?action=default`);
                            }}
                          >
                            <XCircle className="mr-2 h-4 w-4" /> Mark Defaulted
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={totalCount}
        onPageChange={setPage}
      />
    </div>
  );
}
