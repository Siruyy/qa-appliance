import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";
import {
  Search,
  Plus,
  MoreHorizontal,
  Users,
  Pencil,
  Archive,
  RotateCcw,
  Eye,
  Download,
  Loader2,
  ChevronDown,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/error";
import { useCustomers } from "@/hooks/useCustomers";
import { useCustomerStore } from "@/stores/customerStore";
import { useCurrency } from "@/hooks/useCurrency";
import type { Customer } from "@/types/customer";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

import { CustomerFormModal } from "./CustomerFormModal";
import { downloadCsv } from "@/lib/csv";
import { toExcel } from "@/lib/export";

type ModalState =
  | { type: "none" }
  | { type: "form"; customer?: Customer };

export function CustomersPage() {
  const navigate = useNavigate();
  const { archiveCustomer, restoreCustomer } = useCustomers();
  const {
    filters,
    setFilter,
    filteredCustomers,
    loading,
    customers: rawCustomers,
    page,
    pageSize,
    totalCount,
    setPage,
  } = useCustomerStore();
  const customers = useMemo(() => filteredCustomers(), [rawCustomers, filters]);

  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleStatusChange = (value: string | null) => {
    if (!value) return;
    const status = value as "all" | "active" | "archived";
    setFilter("status", status);
  };

  const handleArchive = (customer: Customer) => {
    setArchiveTarget(customer);
  };

  const confirmArchive = async () => {
    if (!archiveTarget || isProcessing) return;
    const target = archiveTarget;
    setIsProcessing(true);
    try {
      await archiveCustomer(target.id);
      toast.success("Customer archived", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await restoreCustomer(target.id);
              toast.success("Customer restored");
            } catch (err) {
              toast.error(extractErrorMessage(err));
            }
          },
        },
      });
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setArchiveTarget(null);
      setIsProcessing(false);
    }
  };

  const handleRestore = async (id: number) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await restoreCustomer(id);
      toast.success("Customer restored");
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const { format: formatCurrency } = useCurrency();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Customer profiles, contact info, and linked accounts."
        actions={
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 h-9 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                Export
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={async () => {
                  setIsExporting(true);
                  try {
                    downloadCsv(customers, "customers", [
                      { key: "name", label: "Name" },
                      { key: "phone", label: "Phone" },
                      { key: "address", label: "Address" },
                      { key: "notes", label: "Notes" },
                      { key: "is_active", label: "Active" },
                    ]);
                  } finally { setIsExporting(false); }
                }}>
                  <Download className="mr-2 h-4 w-4" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  setIsExporting(true);
                  try {
                    await toExcel({
                      filename: "customers",
                      sheetName: "Customers",
                      headers: ["Name", "Phone", "Address", "Notes", "Active"],
                      rows: customers.map((c) => [
                        c.name,
                        c.phone ?? "",
                        c.address ?? "",
                        c.notes ?? "",
                        c.is_active ? "Yes" : "No",
                      ]),
                    });
                  } finally { setIsExporting(false); }
                }}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setModal({ type: "form" })}>
              <Plus className="mr-1 h-4 w-4" /> Add Customer
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or phone…"
            className="pl-9"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
          />
        </div>
        <Select value={filters.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description="Add your first customer to get started."
          action={
            <Button variant="outline" size="sm" onClick={() => setModal({ type: "form" })}>
              <Plus className="mr-1 h-4 w-4" /> Add Customer
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-center">Open Accounts</TableHead>
              <TableHead className="text-right">Total Balance</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => navigate(`/customers/${c.id}`)}
              >
                <TableCell className="font-medium">
                  {c.name}
                  {!c.is_active && (
                    <Badge variant="secondary" className="ml-2">
                      Archived
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{c.phone || "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {c.address || "—"}
                </TableCell>
                <TableCell className="text-center">
                  {c.open_accounts_count > 0 ? (
                    <Badge variant="outline">{c.open_accounts_count}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.total_balance > 0 ? formatCurrency(c.total_balance) : "—"}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent" title="Customer actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/customers/${c.id}`)}>
                        <Eye className="mr-2 h-4 w-4" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setModal({ type: "form", customer: c })}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      {c.is_active ? (
                        <DropdownMenuItem onClick={() => handleArchive(c)}>
                          <Archive className="mr-2 h-4 w-4" /> Archive
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleRestore(c.id)}>
                          <RotateCcw className="mr-2 h-4 w-4" /> Restore
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Modals */}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={filters.search ? customers.length : totalCount}
        onPageChange={setPage}
      />

      {modal.type === "form" && (
        <CustomerFormModal
          customer={modal.customer}
          onClose={() => setModal({ type: "none" })}
        />
      )}

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{archiveTarget?.name}&rdquo; will be hidden from active lists. You can restore them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive} disabled={isProcessing}>
              {isProcessing ? "Archiving…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
