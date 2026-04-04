import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/formatters";
import type { CartItem } from "@/types/sale";

interface SaleItemRowProps {
  item: CartItem;
  onUpdateQty: (variantId: number, qty: number) => void;
  onRemove: (variantId: number) => void;
}

export function SaleItemRow({ item, onUpdateQty, onRemove }: SaleItemRowProps) {
  return (
    <tr className="border-b">
      <td className="py-2 px-3">
        <div className="font-medium">{item.product_name}</div>
        {item.variant_label && (
          <div className="text-xs text-muted-foreground">{item.variant_label}</div>
        )}
      </td>
      <td className="py-2 px-3 text-right">{formatCurrency(item.unit_price)}</td>
      <td className="py-2 px-3">
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onUpdateQty(item.variant_id, Math.max(1, item.quantity - 1))}
            disabled={item.quantity <= 1}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            type="number"
            min={1}
            max={item.stock_qty}
            value={item.quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val) && val >= 1 && val <= item.stock_qty) {
                onUpdateQty(item.variant_id, val);
              }
            }}
            className="h-7 w-14 text-center px-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onUpdateQty(item.variant_id, Math.min(item.stock_qty, item.quantity + 1))}
            disabled={item.quantity >= item.stock_qty}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground text-center mt-0.5">
          {item.stock_qty} in stock
        </div>
      </td>
      <td className="py-2 px-3 text-right font-medium">{formatCurrency(item.subtotal)}</td>
      <td className="py-2 px-3 text-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onRemove(item.variant_id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
