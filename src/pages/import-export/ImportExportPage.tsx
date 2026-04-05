import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/PageHeader";
import { ExportSection } from "./ExportSection";
import { ImportSection } from "./ImportSection";
import { ImportHistory } from "./ImportHistory";

export function ImportExportPage() {
  return (
    <div className="space-y-8 p-1">
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
