import { extractErrorMessage } from "@/lib/error";
import { useState, useEffect } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invoke } from "@/lib/invoke";
import { toast } from "sonner";
import { Download, Upload, FolderOpen, TriangleAlert } from "lucide-react";
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

export function DatabaseBackupRestore() {
  const [dbPath, setDbPath] = useState("");
  const [backing, setBacking] = useState(false);
  const [restoreFile, setRestoreFile] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState<"idle" | "warn" | "confirm">("idle");
  const [resetInput, setResetInput] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    invoke<string>("get_database_path").then(setDbPath).catch(() => {});
  }, []);

  const handleBackup = async () => {
    const dest = await save({
      title: "Save Database Backup",
      defaultPath: `qa-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: "SQLite Database", extensions: ["db"] }],
    });
    if (!dest) return;

    setBacking(true);
    try {
      await invoke<string>("backup_database", { destPath: dest });
      toast.success("Database backed up successfully");
    } catch (err) {
      toast.error("Backup failed: " + extractErrorMessage(err));
    } finally {
      setBacking(false);
    }
  };

  const handleRestoreSelect = async () => {
    const file = await open({
      title: "Select Database Backup",
      filters: [{ name: "SQLite Database", extensions: ["db"] }],
      multiple: false,
      directory: false,
    });
    if (file) setRestoreFile(file);
  };

  const handleRestoreConfirm = async () => {
    if (!restoreFile) return;
    try {
      const msg = await invoke<string>("restore_database", { srcPath: restoreFile });
      toast.success(msg);
    } catch (err) {
      toast.error("Restore failed: " + extractErrorMessage(err));
    } finally {
      setRestoreFile(null);
    }
  };

  const handleResetConfirm = async () => {
    setResetting(true);
    try {
      const msg = await invoke<string>("reset_database");
      toast.success(msg);
    } catch (err) {
      toast.error("Reset failed: " + extractErrorMessage(err));
    } finally {
      setResetting(false);
      setResetStep("idle");
      setResetInput("");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ fontFamily: "var(--font-heading)" }}>
            Database
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dbPath && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">{dbPath}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleBackup} disabled={backing}>
              <Download className="mr-2 h-4 w-4" />
              {backing ? "Backing up…" : "Backup Database"}
            </Button>
            <Button variant="outline" onClick={handleRestoreSelect}>
              <Upload className="mr-2 h-4 w-4" />
              Restore from Backup
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Backups create a copy of the entire database. Restoring will replace
            all current data — the app should be restarted after a restore.
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle
            className="text-base flex items-center gap-2 text-destructive"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <TriangleAlert className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Permanently erase <strong>all data</strong> (products, customers, sales,
            accounts, payments) and start with a blank database. The schema is kept — only
            records are deleted.
          </p>
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive space-y-1">
            <p className="font-semibold">Before you reset:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Create a backup using the <strong>Backup Database</strong> button above.</li>
              <li>This action <strong>cannot be undone</strong>.</li>
              <li>The app must be restarted after resetting.</li>
            </ul>
          </div>
          <Button
            variant="destructive"
            className="mt-1"
            onClick={() => setResetStep("warn")}
          >
            <TriangleAlert className="mr-2 h-4 w-4" />
            Reset Database
          </Button>
        </CardContent>
      </Card>

      {/* Step 1 — initial warning */}
      <AlertDialog open={resetStep === "warn"} onOpenChange={(o) => !o && setResetStep("idle")}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 shrink-0" />
              Reset the entire database?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              This will permanently delete <strong>all</strong> products, customers,
              sales, installment accounts, payments, and settings.
              <span className="block font-medium text-foreground mt-2">
                Have you made a backup? There is no way to recover this data.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full"
              onClick={() => setResetStep("confirm")}
            >
              I have a backup — continue
            </AlertDialogAction>
            <AlertDialogCancel className="w-full mt-0">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 2 — type RESET to confirm */}
      <AlertDialog open={resetStep === "confirm"} onOpenChange={(o) => { if (!o) { setResetStep("idle"); setResetInput(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Type RESET to confirm
            </AlertDialogTitle>
            <AlertDialogDescription>
              Type <strong>RESET</strong> in the box below to permanently erase all data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={resetInput}
            onChange={(e) => setResetInput(e.target.value)}
            placeholder="RESET"
            className="mt-1"
            autoFocus
          />
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel onClick={() => setResetInput("")}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={resetInput !== "RESET" || resetting}
              onClick={handleResetConfirm}
            >
              {resetting ? "Resetting…" : "Erase all data"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore confirmation dialog */}
      <AlertDialog open={!!restoreFile} onOpenChange={(o) => !o && setRestoreFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Database?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace <strong>all current data</strong> with the backup.
              This action cannot be undone. The app should be restarted after restoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
