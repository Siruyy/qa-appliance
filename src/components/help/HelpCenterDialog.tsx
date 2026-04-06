import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useUIStore } from "@/stores/uiStore";
import {
  helpArticles,
  searchArticles,
  groupByCategory,
  categoryLabels,
  type HelpArticle,
} from "@/lib/help-content";
import {
  Search,
  BookOpen,
  Lightbulb,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

export function HelpCenterDialog() {
  const open = useUIStore((s) => s.helpCenterOpen);
  const setOpen = useUIStore((s) => s.setHelpCenterOpen);
  const [query, setQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

  const results = useMemo(() => searchArticles(query), [query]);
  const grouped = useMemo(() => groupByCategory(results), [results]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery("");
      setSelectedArticle(null);
    }
    setOpen(next);
  };

  const handleBack = () => setSelectedArticle(null);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            Help Center
          </DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        {!selectedArticle && (
          <div className="px-6 pt-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search help topics..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>
        )}

        <ScrollArea className="h-[60vh] px-6 pb-6">
          {selectedArticle ? (
            /* ─── Article Detail View ──────────────────────────── */
            <div className="space-y-5 pt-2 pb-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to all topics
              </button>

              <div>
                <h2 className="text-lg font-semibold">{selectedArticle.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedArticle.summary}
                </p>
              </div>

              {selectedArticle.tips.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                    Tips & How-To
                  </h3>
                  <div className="space-y-3">
                    {selectedArticle.tips.map((tip, i) => (
                      <div key={i} className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-sm font-medium mb-1">{tip.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {tip.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {selectedArticle.faq.length > 0 && (
                <section>
                  <Separator className="mb-4" />
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
                    <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
                    Common Questions
                  </h3>
                  <div className="space-y-3">
                    {selectedArticle.faq.map((item, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium">{item.question}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                          {item.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            /* ─── Browse / Search View ─────────────────────────── */
            <div className="space-y-4 pt-2 pb-4">
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No help topics match "{query}"
                  </p>
                </div>
              ) : (
                Object.entries(grouped).map(([cat, articles]) => (
                  <section key={cat}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {categoryLabels[cat] ?? cat}
                    </h3>
                    <div className="space-y-1">
                      {articles.map((article) => (
                        <button
                          key={article.id}
                          onClick={() => setSelectedArticle(article)}
                          className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {article.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {article.summary}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-foreground transition-colors ml-2" />
                        </button>
                      ))}
                    </div>
                    <Separator className="mt-3" />
                  </section>
                ))
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {helpArticles.length} help topics available
          </span>
          <Badge variant="outline" className="text-[10px]">
            Ctrl+/ or F1
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
