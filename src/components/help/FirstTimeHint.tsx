import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getFirstTimeHint } from "@/lib/help-content";
import { useUIStore } from "@/stores/uiStore";
import { X, Lightbulb, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "qa-help-seen-pages";

function getSeenPages(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markPageSeen(route: string) {
  try {
    const seen = getSeenPages();
    if (!seen.includes(route)) {
      seen.push(route);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    }
  } catch {}
}

export function FirstTimeHint() {
  const { pathname } = useLocation();
  const setHelpSheetOpen = useUIStore((s) => s.setHelpSheetOpen);
  const [visible, setVisible] = useState(false);
  const [hint, setHint] = useState<ReturnType<typeof getFirstTimeHint>>(undefined);

  useEffect(() => {
    const pageHint = getFirstTimeHint(pathname);
    if (!pageHint) {
      setVisible(false);
      return;
    }

    const seen = getSeenPages();
    // Match using the hint's route key, not the full pathname
    if (seen.includes(pageHint.route)) {
      setVisible(false);
      return;
    }

    setHint(pageHint);
    setVisible(true);
  }, [pathname]);

  const dismiss = () => {
    if (hint) markPageSeen(hint.route);
    setVisible(false);
  };

  const openHelp = () => {
    dismiss();
    setHelpSheetOpen(true);
  };

  if (!visible || !hint) return null;

  return (
    <div
      className={cn(
        "relative mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4",
        "animate-in fade-in-0 slide-in-from-top-2 duration-300"
      )}
    >
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss tip"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex gap-3">
        <Lightbulb className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold mb-1.5">{hint.title}</p>
          <ul className="space-y-1">
            {hint.tips.map((tip, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-1.5">
                <span className="text-primary/60 shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openHelp}>
              <BookOpen className="h-3 w-3 mr-1" />
              Full Help
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={dismiss}>
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
