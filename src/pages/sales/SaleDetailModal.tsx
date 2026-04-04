import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import type { SaleDetail } from "@/types/sale";
import { useSales } from "@/hooks/useSales";
import { Loader2 } from "lucide-react";

interface SaleDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: number | null;
  onVoided: () => void;
}

export function SaleDetailModal({ open, onOpenChange, saleId, onVoided }: SaleDetailModalProps) {
  const { getSaleById, voidSale } = useSales();
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const load = useCallback(async () => {
    if (!saleId) return;
    setLoading(true);
    const d = await getSaleById(saleId);
    setDetail(d);
    setLoading(false);
  }, [saleId, getSaleById]);

  // Load when opened
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && saleId) load();
    if (!isOpen) setDetail(null);
    onOpenChange(isOpen);
  };

  const handleVoid = async () => {
    if (!saleId) return;
    setVoiding(true);
    const ok = await voidSale(saleId);
    setVoiding(false);
    if (ok) {
      onOpenChange(false);
      onVoided();
    }
  };

  const sale = detail?.sale;

  const { format: formatCurrency } = useCurrency();
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sale #{saleId}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sale ? (
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Date: </span>
                {formatDateTime(sale.sale_date)}
              </div>
              <div>
                <span className="text-muted-foreground">Customer: </span>
                {sale.customer_name ?? "Walk-in"}
              </div>
              <div>
                <span className="text-muted-foreground">Payment: </span>
                <Badge variant={sale.payment_type === "cash" ? "default" : "secondary"}>
                  {sale.payment_type}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Status: </span>
                <Badge variant={sale.status === "voided" ? "destructive" : "default"}>
                  {sale.status}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div>
              <h4 className="font-medium mb-2 text-sm">Items</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-1">Product</th>
                    <th className="text-right py-1">Price</th>
                    <th className="text-center py-1">Qty</th>
                    <th className="text-right py-1">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detail?.items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-1.5">
                        {item.product_name}
                        {item.variant_label && (
                          <span className="text-muted-foreground ml-1">({item.variant_label})</span>
                        )}
                      </td>
                      <td className="text-right py-1.5">{formatCurrency(item.unit_price)}</td>
                      <td className="text-center py-1.5">{item.quantity}</td>
                      <td className="text-right py-1.5">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">- {formatCurrency(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
            </div>

            {/* Installment account info */}
            {detail?.account && (
              <>
                <Separator />
                <div className="space-y-1 text-sm">
                  <h4 className="font-medium">Installment Account</h4>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <span className="text-muted-foreground">Principal: </span>
                      {formatCurrency(detail.account.principal)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Down Payment: </span>
                      {formatCurrency(detail.account.down_payment)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Interest: </span>
                      {detail.account.interest_rate}%
                    </div>
                    <div>
                      <span className="text-muted-foreground">Balance: </span>
                      <span className="font-semibold">
                        {formatCurrency(detail.account.balance_remaining)}
                      </span>
                    </div>
                    {detail.account.term_months && (
                      <div>
                        <span className="text-muted-foreground">Term: </span>
                        {detail.account.term_months} months
                      </div>
                    )}
                    {detail.account.monthly_amount && (
                      <div>
                        <span className="text-muted-foreground">Monthly: </span>
                        {formatCurrency(detail.account.monthly_amount)}
                      </div>
                    )}
                  </div>
                  <Badge
                    variant={
                      detail.account.status === "paid"
                        ? "default"
                        : detail.account.status === "defaulted"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {detail.account.status}
                  </Badge>
                </div>
              </>
            )}

            {sale.notes && (
              <>
                <Separator />
                <div className="text-sm">
                  <span className="text-muted-foreground">Notes: </span>
                  {sale.notes}
                </div>
              </>
            )}

            {/* Actions */}
            {sale.status === "completed" && (
              <>
                <Separator />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleVoid}
                  disabled={voiding}
                >
                  {voiding ? "Voiding..." : "Void Sale"}
                </Button>
              </>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Sale not found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
