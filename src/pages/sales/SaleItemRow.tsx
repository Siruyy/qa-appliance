import { useState } from "react";
import { Minus, Plus, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/hooks/useCurrency";
import type { CartItem, DiscountType } from "@/types/sale";
import type { SerialNumber } from "@/types/serial";

interface SaleItemRowProps {
  item: CartItem;
  availableSerials?: SerialNumber[];
  onUpdateQty: (variantId: number, qty: number) => void;
  onRemove: (variantId: number) => void;
  onSetItemDiscount: (variantId: number, value: number, type: DiscountType) => void;
  onSetSerial?: (variantId: number, serialNo: string | undefined) => void;
}

export function SaleItemRow({ item, availableSerials, onUpdateQty, onRemove, onSetItemDiscount, onSetSerial }: SaleItemRowProps) {
  const { format: formatCurrency } = useCurrency();
  const [showDiscount, setShowDiscount] = useState(item.item_discount_value > 0);

  return (
    <>
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
              aria-label="Decrease quantity"
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
              aria-label="Increase quantity"
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
        <td className="py-2 px-3 text-right font-medium">
          {formatCurrency(item.subtotal)}
          {item.item_discount > 0 && (
            <div className="text-xs text-destructive">
              -{formatCurrency(item.item_discount)}
            </div>
          )}
        </td>
        <td className="py-2 px-3 text-center">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${showDiscount ? "text-primary" : "text-muted-foreground"}`}
              aria-label="Toggle item discount"
              onClick={() => {
                if (showDiscount) {
                  onSetItemDiscount(item.variant_id, 0, "peso");
                }
                setShowDiscount(!showDiscount);
              }}
            >
              <Tag className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              aria-label="Remove item"
              onClick={() => onRemove(item.variant_id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
      {showDiscount && (
        <tr className="border-b bg-muted/30">
          <td colSpan={5} className="py-1.5 px-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground whitespace-nowrap">Item discount:</span>
              <Input
                type="number"
                min={0}
                step={item.item_discount_type === "percent" ? 1 : 10}
                max={item.item_discount_type === "percent" ? 100 : item.unit_price * item.quantity}
                value={item.item_discount_value || ""}
                onChange={(e) =>
                  onSetItemDiscount(item.variant_id, parseFloat(e.target.value) || 0, item.item_discount_type)
                }
                className="h-7 w-24"
              />
              <Button
                type="button"
                variant={item.item_discount_type === "peso" ? "default" : "outline"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onSetItemDiscount(item.variant_id, item.item_discount_value, "peso")}
              >
                ₱
              </Button>
              <Button
                type="button"
                variant={item.item_discount_type === "percent" ? "default" : "outline"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onSetItemDiscount(item.variant_id, item.item_discount_value, "percent")}
              >
                %
              </Button>
              {item.item_discount_type === "percent" && item.item_discount_value > 0 && (
                <span className="text-xs text-muted-foreground">
                  = {formatCurrency(item.item_discount)}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
      {availableSerials && availableSerials.length > 0 && onSetSerial && (
        <tr className="border-b bg-muted/20">
          <td colSpan={5} className="py-1.5 px-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground whitespace-nowrap">
                Serial #<span className="text-destructive ml-0.5">*</span>:
              </span>
              <Select
                value={item.serial_no ?? ""}
                onValueChange={(val) => onSetSerial(item.variant_id, val || undefined)}
              >
                <SelectTrigger
                  className={`h-7 w-52 text-xs ${
                    !item.serial_no ? "border-destructive ring-destructive/20" : ""
                  }`}
                >
                  <SelectValue placeholder="Required — select serial…" />
                </SelectTrigger>
                <SelectContent>
                  {availableSerials.map((s) => (
                    <SelectItem key={s.id} value={s.serial_no}>
                      {s.serial_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
