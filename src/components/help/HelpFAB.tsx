import { CircleHelp } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

export function HelpFAB() {
  const setHelpSheetOpen = useUIStore((s) => s.setHelpSheetOpen);

  return (
    <button
      onClick={() => setHelpSheetOpen(true)}
      aria-label="Open help"
      title="Help for this page"
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "flex h-10 w-10 items-center justify-center rounded-full",
        "bg-primary text-primary-foreground shadow-lg",
        "transition-all hover:scale-105 hover:shadow-xl active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      <CircleHelp className="h-5 w-5" />
    </button>
  );
}
