import { useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";
import {
  Search,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  CreditCard,
  XCircle,
  Download,
  ChevronDown,
  FileSpreadsheet,
} from "lucide-react";

import { useAccounts } from "@/hooks/useAccounts";
import { useAccountStore } from "@/stores/accountStore";
import { formatDate, formatProductSummary } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import { accountStatusVariant } from "@/lib/badgeVariants";

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
import { HelpTip } from "@/components/help/HelpTip";
import { FirstTimeHint } from "@/components/help/FirstTimeHint";
import { downloadCsv } from "@/lib/csv";
import { toExcel } from "@/lib/export";

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

  const loadAccounts = useCallback(() => {
    fetchAccounts(
      statusFilter === "all" ? undefined : statusFilter,
      typeFilter === "all" ? undefined : typeFilter,
      search || undefined
    );
  }, [fetchAccounts, page, pageSize, statusFilter, typeFilter, search]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleStatusChange = (value: string | null) => {
    if (!value) return;
    setStatusFilter(value as "all" | "open" | "overdue" | "paid" | "defaulted");
  };

  const { format: formatCurrency } = useCurrency();
  return (
    <div className="space-y-6">
      <FirstTimeHint />
      <PageHeader
        title="Accounts / Receivables"
        description="Track all open installment accounts."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 h-9 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => downloadCsv(accounts, "accounts", [
                { key: "customer_name", label: "Customer" },
                { key: "product_summary", label: "Products" },
                { key: "principal", label: "Principal" },
                { key: "balance_remaining", label: "Balance" },
                { key: "status", label: "Status" },
                { key: "start_date", label: "Start Date" },
              ])}>
                <Download className="mr-2 h-4 w-4" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toExcel({
                filename: "accounts",
                sheetName: "Accounts",
                headers: ["Customer", "Products", "Principal", "Balance", "Status", "Start Date"],
                rows: accounts.map((a) => [
                  a.customer_name,
                  a.product_summary,
                  a.principal,
                  a.balance_remaining,
                  a.status,
                  a.start_date ?? "",
                ]),
              })}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
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
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Balance <HelpTip text="Live running balance — starts at total owed and decreases with each payment." /></TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Next Due</TableHead>
              <TableHead>Status <HelpTip text="Open = payments remaining. Paid = settled. Overdue = missed payments. Defaulted = severely delinquent." /></TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          {loading ? (
            <TableSkeleton cols={7} rows={5} />
          ) : (
            <TableBody>
              {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    icon={CreditCard}
                    title="No accounts found"
                    description="Accounts are created when installment sales are made."
                  />
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
                  <TableCell className="max-w-[200px] truncate">{formatProductSummary(a.product_summary)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(a.balance_remaining)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      Installment
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.next_due_date ? formatDate(a.next_due_date) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.is_overdue ? "destructive" : accountStatusVariant[a.status] ?? "outline"}>
                      {a.is_overdue ? "OVERDUE" : a.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent"
                        title="Account actions"
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
          )}
        </Table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={search ? accounts.length : totalCount}
        onPageChange={setPage}
      />
    </div>
  );
}
