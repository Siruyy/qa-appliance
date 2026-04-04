import { useRef } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import type { SaleDetail } from "@/types/sale";

interface SaleReceiptProps {
  detail: SaleDetail;
  storeName?: string;
}

export function SaleReceipt({ detail, storeName = "Quality Appliance" }: SaleReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { format: formatCurrency } = useCurrency();
  const { sale, items, account } = detail;

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt — Sale #${sale.id}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: monospace; font-size: 12px; padding: 16px; width: 300px; }
            h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
            .sub { text-align: center; color: #555; margin-bottom: 12px; }
            hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .row.bold { font-weight: bold; }
            .items th { text-align: left; padding-bottom: 4px; }
            .items td { padding: 2px 0; vertical-align: top; }
            .items td:last-child { text-align: right; white-space: nowrap; }
            .footer { text-align: center; color: #777; margin-top: 12px; font-size: 11px; }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          <script>window.onload = function() { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div>
      {/* Hidden receipt content for printing */}
      <div ref={receiptRef} style={{ display: "none" }}>
        <h1>{storeName}</h1>
        <div className="sub">
          Sale #{sale.id} &bull; {formatDateTime(sale.sale_date)}
        </div>
        <hr />
        <div className="row">
          <span>Customer:</span>
          <span>{sale.customer_name ?? "Walk-in"}</span>
        </div>
        <div className="row">
          <span>Payment:</span>
          <span>{sale.payment_type}</span>
        </div>
        <hr />
        <table className="items" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Item</th>
              <th style={{ textAlign: "center" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.product_name}
                  {item.variant_label ? ` (${item.variant_label})` : ""}
                </td>
                <td style={{ textAlign: "center" }}>{item.quantity}</td>
                <td style={{ textAlign: "right" }}>{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr />
        <div className="row">
          <span>Subtotal</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="row">
            <span>Discount</span>
            <span>- {formatCurrency(sale.discount)}</span>
          </div>
        )}
        <div className="row bold">
          <span>TOTAL</span>
          <span>{formatCurrency(sale.total)}</span>
        </div>
        {account && (
          <>
            <hr />
            <div className="row">
              <span>Down Payment</span>
              <span>{formatCurrency(account.down_payment)}</span>
            </div>
            <div className="row">
              <span>Balance Remaining</span>
              <span>{formatCurrency(account.balance_remaining)}</span>
            </div>
            {account.monthly_amount && (
              <div className="row">
                <span>Monthly Payment</span>
                <span>{formatCurrency(account.monthly_amount)}</span>
              </div>
            )}
          </>
        )}
        {sale.notes && (
          <>
            <hr />
            <div>Notes: {sale.notes}</div>
          </>
        )}
        <div className="footer">Thank you for your purchase!</div>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="gap-2">
        <Printer className="h-4 w-4" />
        Print Receipt
      </Button>
    </div>
  );
}
