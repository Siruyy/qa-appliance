import { CircleHelp } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Hide the page-level help button */
  hideHelp?: boolean;
}

export function PageHeader({ title, description, actions, hideHelp }: PageHeaderProps) {
  const setHelpSheetOpen = useUIStore((s) => s.setHelpSheetOpen);

  return (
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground font-heading">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {!hideHelp && (
          <button
            onClick={() => setHelpSheetOpen(true)}
            className="mt-1.5 rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-muted-foreground"
            aria-label="Help for this page"
            title="Help for this page"
          >
            <CircleHelp className="h-4 w-4" />
          </button>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
