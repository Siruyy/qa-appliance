import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
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
} from "lucide-react";
import { toast } from "sonner";

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

  const handleStatusChange = (value: string | null) => {
    if (!value) return;
    const status = value as "all" | "active" | "archived";
    setFilter("status", status);
  };

  const handleArchive = (customer: Customer) => {
    setArchiveTarget(customer);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archiveCustomer(archiveTarget.id);
      toast.success("Customer archived");
    } catch (error) {
      toast.error(error as string);
    } finally {
      setArchiveTarget(null);
    }
  };

  const handleRestore = async (id: number) => {
    try {
      await restoreCustomer(id);
      toast.success("Customer restored");
    } catch (error) {
      toast.error(error as string);
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
            <Button variant="outline" onClick={() => {
              downloadCsv(customers, "customers", [
                { key: "name", label: "Name" },
                { key: "phone", label: "Phone" },
                { key: "email", label: "Email" },
                { key: "address", label: "Address" },
                { key: "is_active", label: "Active" },
              ]);
            }}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
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
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Users className="h-10 w-10 opacity-40" />
          <p>No customers found.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModal({ type: "form" })}
          >
            <Plus className="mr-1 h-4 w-4" /> Add your first customer
          </Button>
        </div>
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
                    <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
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
        total={totalCount}
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
