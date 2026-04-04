import { useEffect, useState } from "react";
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
import { formatCurrency, formatDate } from "@/lib/formatters";
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

  const fetchDetail = async () => {
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
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/customers")}>
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

      {/* Open Accounts */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <CreditCard className="h-5 w-5" />
          Open Accounts ({openAccounts.length})
        </h2>
        {openAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open accounts.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {openAccounts.map((acct) => (
              <AccountMiniCard
                key={acct.id}
                account={acct}
                onClick={() => navigate(`/accounts/${acct.id}`)}
              />
            ))}
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
              {sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{formatDate(s.sale_date)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {s.items_summary || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(s.total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {s.payment_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={s.status === "voided" ? "destructive" : "secondary"}
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <Separator />

      {/* Payment History */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Banknote className="h-5 w-5" />
          Payment History ({payments.length})
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded.</p>
        ) : (
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
              {payments.map((p) => (
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
