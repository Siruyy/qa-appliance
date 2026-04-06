import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/PageHeader";
import { ExportSection } from "./ExportSection";
import { ImportSection } from "./ImportSection";
import { ImportHistory } from "./ImportHistory";
import { FirstTimeHint } from "@/components/help/FirstTimeHint";

export function ImportExportPage() {
  return (
    <div className="space-y-8 p-1">
      <FirstTimeHint />
      <PageHeader
        title="Import / Export"
        description="Bulk data import and export tools for backup and data migration."
      />

      <ExportSection />
      <Separator />
      <ImportSection />
      <Separator />
      <ImportHistory />
    </div>
  );
}
