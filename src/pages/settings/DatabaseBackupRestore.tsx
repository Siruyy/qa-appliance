import { useState, useEffect } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { invoke } from "@/lib/invoke";
import { toast } from "sonner";
import { Download, Upload, FolderOpen } from "lucide-react";
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
      toast.error("Backup failed: " + String(err));
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
      toast.error("Restore failed: " + String(err));
    } finally {
      setRestoreFile(null);
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
