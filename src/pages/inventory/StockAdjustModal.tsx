import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { ProductVariant } from "@/types/product";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  variant: ProductVariant;
  onAdjust: (id: number, delta: number) => Promise<void>;
  onClose: () => void;
}

export function StockAdjustModal({ variant, onAdjust, onClose }: Props) {
  const [delta, setDelta] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const newQty = variant.stock_qty + delta;
  const isValid = delta !== 0 && newQty >= 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      await onAdjust(variant.id, delta);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const attrs = variant.attributes
    ? Object.values(variant.attributes as Record<string, string>).join(", ")
    : variant.sku ?? `Variant #${variant.id}`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{attrs}</p>

          <div className="flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setDelta((d) => d - 1)}
              disabled={newQty <= 0}
            >
              <Minus className="h-4 w-4" />
            </Button>

            <div className="w-24 text-center">
              <Label className="text-xs text-muted-foreground">Adjustment</Label>
              <Input
                type="number"
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value) || 0)}
                className="text-center text-lg font-semibold tabular-nums"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setDelta((d) => d + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex justify-between text-sm px-2">
            <span className="text-muted-foreground">
              Current: <span className="font-medium text-foreground">{variant.stock_qty}</span>
            </span>
            <span className="text-muted-foreground">
              New:{" "}
              <span className={`font-medium ${newQty < 0 ? "text-destructive" : "text-foreground"}`}>
                {newQty}
              </span>
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? "Updating…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
