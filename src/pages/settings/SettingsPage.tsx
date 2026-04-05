import { extractErrorMessage } from "@/lib/error";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "sonner";
import { CategoryManagement } from "./CategoryManagement";
import { DatabaseBackupRestore } from "./DatabaseBackupRestore";
import { AuditLogViewer } from "./AuditLogViewer";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Loader2 } from "lucide-react";

const AUTO_SAVE_DELAY = 1500;

export function SettingsPage() {
  const { settings, loading, loadSettings, updateSettingsBatch } =
    useSettingsStore();
  const [form, setForm] = useState(settings);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Object.keys(settings).length === 0) loadSettings();
  }, [loadSettings, settings]);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(settings),
    [form, settings]
  );

  const doSave = useCallback(async (formData: Record<string, string>) => {
    setSaveStatus("saving");
    try {
      const pairs: [string, string][] = Object.entries(formData).map(([k, v]) => [k, v]);
      await updateSettingsBatch(pairs);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      toast.error("Failed to save: " + extractErrorMessage(err));
      setSaveStatus("idle");
    }
  }, [updateSettingsBatch]);

  const handleChange = (key: string, value: string) => {
    const next = { ...form, [key]: value };
    setForm(next);

    // Debounced auto-save
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (JSON.stringify(next) !== JSON.stringify(settings)) {
        doSave(next);
      }
    }, AUTO_SAVE_DELAY);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Warn on unsaved changes when navigating away
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => (<Skeleton key={i} className="h-32 rounded-lg" />))}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Configure store information, financial defaults, and app preferences.
      </p>

      {/* Store Information */}
      <Card>
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store_name">Store Name</Label>
              <Input
                id="store_name"
                value={form.store_name}
                onChange={(e) => handleChange("store_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store_phone">Phone</Label>
              <Input
                id="store_phone"
                value={form.store_phone}
                onChange={(e) => handleChange("store_phone", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="store_address">Address</Label>
            <Input
              id="store_address"
              value={form.store_address}
              onChange={(e) => handleChange("store_address", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency_symbol">Currency Symbol</Label>
            <Input
              id="currency_symbol"
              value={form.currency_symbol}
              onChange={(e) => handleChange("currency_symbol", e.target.value)}
              className="w-24"
            />
          </div>
        </CardContent>
      </Card>

      {/* Financial Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default_interest_rate">
                Default Interest Rate (%)
              </Label>
              <Input
                id="default_interest_rate"
                type="number"
                min="0"
                step="0.5"
                value={form.default_interest_rate}
                onChange={(e) =>
                  handleChange("default_interest_rate", e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_penalty_rate">
                Default Penalty Rate (%)
              </Label>
              <Input
                id="default_penalty_rate"
                type="number"
                min="0"
                step="0.5"
                value={form.default_penalty_rate}
                onChange={(e) =>
                  handleChange("default_penalty_rate", e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_term_months">
                Default Term (months)
              </Label>
              <Input
                id="default_term_months"
                type="number"
                min="1"
                value={form.default_term_months}
                onChange={(e) =>
                  handleChange("default_term_months", e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_down_payment_pct">
                Default Down Payment (%)
              </Label>
              <Input
                id="default_down_payment_pct"
                type="number"
                min="0"
                max="100"
                value={form.default_down_payment_pct}
                onChange={(e) =>
                  handleChange("default_down_payment_pct", e.target.value)
                }
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="preset_terms">
              Preset Term Options (comma-separated months)
            </Label>
            <Input
              id="preset_terms"
              value={form.preset_terms}
              onChange={(e) => handleChange("preset_terms", e.target.value)}
              placeholder="3,6,12,18,24"
            />
            <p className="text-xs text-muted-foreground">
              These appear as quick-select options in the New Sale form.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Inventory */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
            <Input
              id="low_stock_threshold"
              type="number"
              min="0"
              value={form.low_stock_threshold}
              onChange={(e) =>
                handleChange("low_stock_threshold", e.target.value)
              }
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Variants at or below this quantity trigger low-stock alerts on the
              dashboard.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-save indicator */}
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground h-8">
        {saveStatus === "saving" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving…</span>
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <Check className="h-4 w-4 text-[var(--success)]" />
            <span className="text-[var(--success)]">Saved</span>
          </>
        )}
        {saveStatus === "idle" && isDirty && (
          <span>Unsaved changes — will auto-save</span>
        )}
      </div>

      <Separator />

      {/* Category Management */}
      <CategoryManagement />

      <Separator />

      {/* Database Backup & Restore */}
      <DatabaseBackupRestore />

      <Separator />

      {/* Audit Log */}
      <AuditLogViewer />
    </div>
  );
}
