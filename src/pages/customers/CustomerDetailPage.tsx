import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Archive,
  RotateCcw,
  Phone,
  MapPin,
  StickyNote,
  CreditCard,
  ShoppingCart,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";

import { useCustomers } from "@/hooks/useCustomers";
import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import { saleStatusVariant, paymentTypeVariant } from "@/lib/badgeVariants";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import type { CustomerDetail } from "@/types/customer";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { CustomerFormModal } from "./CustomerFormModal";
import { AccountMiniCard } from "./AccountMiniCard";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCustomerById, archiveCustomer, restoreCustomer } = useCustomers();

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const { format: formatCurrency } = useCurrency();

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getCustomerById(Number(id));
      setDetail(data);
    } catch (error) {
      toast.error(error as string);
    } finally {
      setLoading(false);
    }
  }, [id, getCustomerById]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Customer not found.
      </div>
    );
  }

  const { customer, sales, accounts, payments } = detail;

  const handleArchive = async () => {
    try {
      await archiveCustomer(customer.id);
      toast.success("Customer archived");
      navigate("/customers");
    } catch (error) {
      toast.error(error as string);
    }
  };

  const handleRestore = async () => {
    try {
      await restoreCustomer(customer.id);
      toast.success("Customer restored");
      await fetchDetail();
    } catch (error) {
      toast.error(error as string);
    }
  };

  const openAccounts = accounts.filter((a) => a.status === "open");
  const closedAccounts = accounts.filter((a) => a.status !== "open");

  const ITEMS_PER_PAGE = 10;
  const [salesPage, setSalesPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const paginatedSales = useMemo(() => sales.slice(0, salesPage * ITEMS_PER_PAGE), [sales, salesPage]);
  const paginatedPayments = useMemo(() => payments.slice(0, paymentsPage * ITEMS_PER_PAGE), [payments, paymentsPage]);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[
        { label: "Customers", to: "/customers" },
        { label: customer.name },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/customers")} aria-label="Back to customers">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              {!customer.is_active && (
                <Badge variant="secondary">Archived</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-4 w-4" /> Edit
          </Button>
          {customer.is_active && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/sales/new?customer_id=${customer.id}`)}
            >
              <ShoppingCart className="mr-1 h-4 w-4" /> New Sale
            </Button>
          )}
          {customer.is_active ? (
            <Button variant="outline" size="sm" onClick={handleArchive}>
              <Archive className="mr-1 h-4 w-4" /> Archive
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleRestore}>
              <RotateCcw className="mr-1 h-4 w-4" /> Restore
            </Button>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
        {customer.phone && (
          <span className="flex items-center gap-1">
            <Phone className="h-4 w-4" /> {customer.phone}
          </span>
        )}
        {customer.address && (
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" /> {customer.address}
          </span>
        )}
        {customer.notes && (
          <span className="flex items-center gap-1">
            <StickyNote className="h-4 w-4" /> {customer.notes}
          </span>
        )}
      </div>

      <Separator />

      {/* Accounts */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <CreditCard className="h-5 w-5" />
          Accounts ({accounts.length})
        </h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts.</p>
        ) : (
          <div className="space-y-4">
            {openAccounts.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Open ({openAccounts.length})</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {openAccounts.map((acct) => (
                    <AccountMiniCard
                      key={acct.id}
                      account={acct}
                      onClick={() => navigate(`/accounts/${acct.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
            {closedAccounts.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Closed / Paid / Defaulted ({closedAccounts.length})</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {closedAccounts.map((acct) => (
                    <AccountMiniCard
                      key={acct.id}
                      account={acct}
                      onClick={() => navigate(`/accounts/${acct.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <Separator />

      {/* Sales History */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <ShoppingCart className="h-5 w-5" />
          Sales History ({sales.length})
        </h2>
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales recorded.</p>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{formatDate(s.sale_date)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {s.items_summary || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(s.total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={paymentTypeVariant[s.payment_type] ?? "outline"} className="capitalize">
                      {s.payment_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={saleStatusVariant[s.status] ?? "secondary"}
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {paginatedSales.length < sales.length && (
            <div className="mt-2 text-center">
              <Button variant="ghost" size="sm" onClick={() => setSalesPage((p) => p + 1)}>
                Show more ({sales.length - paginatedSales.length} remaining)
              </Button>
            </div>
          )}
          </>
        )}
      </section>

      <Separator />

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Banknote className="h-5 w-5" />
          Payment History ({payments.length})
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded.</p>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.payment_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(p.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {p.type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>#{p.account_id}</TableCell>
                  <TableCell className="max-w-[150px] truncate text-muted-foreground">
                    {p.notes || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {paginatedPayments.length < payments.length && (
            <div className="mt-2 text-center">
              <Button variant="ghost" size="sm" onClick={() => setPaymentsPage((p) => p + 1)}>
                Show more ({payments.length - paginatedPayments.length} remaining)
              </Button>
            </div>
          )}
          </>
        )}
      </section>

      {/* Edit Modal */}
      {editing && (
        <CustomerFormModal
          customer={customer}
          onClose={() => {
            setEditing(false);
            fetchDetail();
          }}
        />
      )}
    </div>
  );
}
