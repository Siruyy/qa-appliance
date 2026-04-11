import { useState, useEffect, useCallback } from "react";
import { invoke } from "@/lib/invoke";
import { formatDate } from "@/lib/formatters";
import { extractErrorMessage } from "@/lib/error";
import type { SerialNumber } from "@/types/serial";
import type { ProductVariant } from "@/types/product";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Hash,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  variants: ProductVariant[];
}

interface VariantSerials {
  variant: ProductVariant;
  serials: SerialNumber[];
  loading: boolean;
}

export function SerialNumberSection({ variants }: Props) {
  const [variantSerials, setVariantSerials] = useState<VariantSerials[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [addingFor, setAddingFor] = useState<number | null>(null);
  const [newSerialsText, setNewSerialsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SerialNumber | null>(null);

  const fetchSerials = useCallback(async () => {
    const results = await Promise.all(
      variants.map(async (variant) => {
        try {
          const serials = await invoke<SerialNumber[]>("get_serial_numbers", {
            variantId: variant.id,
            status: null,
          });
          return { variant, serials, loading: false };
        } catch {
          return { variant, serials: [], loading: false };
        }
      })
    );
    setVariantSerials(results);
  }, [variants]);

  useEffect(() => {
    setVariantSerials(variants.map((v) => ({ variant: v, serials: [], loading: true })));
    fetchSerials();
  }, [fetchSerials]);

  const toggleExpand = (variantId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  };

  const handleAddSerials = async (variantId: number) => {
    const parsed = newSerialsText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length === 0) return;

    setSaving(true);
    try {
      await invoke<SerialNumber[]>("add_serial_numbers", {
        variantId: variantId,
        serials: parsed,
      });
      toast.success(`Added ${parsed.length} serial(s)`);
      setAddingFor(null);
      setNewSerialsText("");
      await fetchSerials();
    } catch (e) {
      toast.error(extractErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await invoke<void>("delete_serial_number", { id: deleteTarget.id });
      toast.success(`Deleted serial ${deleteTarget.serial_no}`);
      setDeleteTarget(null);
      await fetchSerials();
    } catch (e) {
      toast.error(extractErrorMessage(e));
    }
  };

  const totalSerials = variantSerials.reduce((sum, vs) => sum + vs.serials.length, 0);
  const showLoading = variantSerials.some((vs) => vs.loading);

  if (showLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (totalSerials === 0 && variants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Hash className="h-8 w-8 mb-2" />
        <p className="text-sm">No variants to track serials for</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {variantSerials.map(({ variant, serials }) => {
        const isOpen = expanded.has(variant.id);
        const inStock = serials.filter((s) => s.status === "in_stock").length;
        const sold = serials.filter((s) => s.status === "sold").length;
        const label = variant.sku || `Variant #${variant.id}`;

        return (
          <Collapsible
            key={variant.id}
            open={isOpen}
            onOpenChange={() => toggleExpand(variant.id)}
          >
            <div className="flex items-center justify-between rounded-md border p-3">
              <CollapsibleTrigger
                className="flex items-center gap-2 text-sm font-medium hover:text-primary"
              >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Package className="h-4 w-4" />
                  {label}
                  <span className="text-muted-foreground font-normal">
                    — {serials.length} serial(s)
                    {serials.length > 0 && (
                      <span className="ml-1">
                        ({inStock} in stock, {sold} sold)
                      </span>
                    )}
                  </span>
                </CollapsibleTrigger>

              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  const toggling = addingFor === variant.id;
                  setAddingFor(toggling ? null : variant.id);
                  setNewSerialsText("");
                  if (!toggling) {
                    setExpanded((prev) => new Set(prev).add(variant.id));
                  }
                }}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Serials
              </Button>
            </div>

            <CollapsibleContent>
              <div className="ml-6 mt-2 space-y-3">
                {/* Add serials form */}
                {addingFor === variant.id && (
                  <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                    <Textarea
                      placeholder="One per line or comma-separated"
                      rows={3}
                      value={newSerialsText}
                      onChange={(e) => setNewSerialsText(e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {newSerialsText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).length} serial(s)
                      </span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setAddingFor(null); setNewSerialsText(""); }}>
                          Cancel
                        </Button>
                        <Button size="sm" disabled={saving || !newSerialsText.trim()} onClick={() => handleAddSerials(variant.id)}>
                          {saving ? "Saving…" : "Add"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Serials table */}
                {serials.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No serials registered for this variant.</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Serial Number</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Added</TableHead>
                          <TableHead>Sold</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serials.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-sm">{s.serial_no}</TableCell>
                            <TableCell>
                              <Badge variant={s.status === "in_stock" ? "default" : "secondary"}>
                                {s.status === "in_stock" ? "In Stock" : "Sold"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(s.added_at)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {s.sold_at ? formatDate(s.sold_at) : "—"}
                            </TableCell>
                            <TableCell>
                              {s.status === "in_stock" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setDeleteTarget(s)}
                                  aria-label={`Delete serial ${s.serial_no}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Serial Number</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete serial <span className="font-mono font-bold">{deleteTarget?.serial_no}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
