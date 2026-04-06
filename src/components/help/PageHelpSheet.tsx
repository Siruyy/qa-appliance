import { useLocation } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/uiStore";
import { getPrimaryArticle } from "@/lib/help-content";
import { BookOpen, Lightbulb, HelpCircle, ExternalLink } from "lucide-react";

export function PageHelpSheet() {
  const open = useUIStore((s) => s.helpSheetOpen);
  const setOpen = useUIStore((s) => s.setHelpSheetOpen);
  const openCenter = useUIStore((s) => s.setHelpCenterOpen);
  const { pathname } = useLocation();

  const article = getPrimaryArticle(pathname);

  const handleBrowseAll = () => {
    setOpen(false);
    openCenter(true);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[400px] sm:w-[440px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            {article ? article.title : "Help"}
          </SheetTitle>
          {article && (
            <p className="text-sm text-muted-foreground">{article.summary}</p>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-160px)] px-6">
          {article ? (
            <div className="space-y-6 pb-6">
              {/* Tips */}
              {article.tips.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                    Tips & How-To
                  </h3>
                  <div className="space-y-3">
                    {article.tips.map((tip, i) => (
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

              {article.faq.length > 0 && (
                <>
                  <Separator />
                  <section>
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
                      <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
                      Common Questions
                    </h3>
                    <div className="space-y-3">
                      {article.faq.map((item, i) => (
                        <div key={i}>
                          <p className="text-sm font-medium">{item.question}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                            {item.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

              <Separator />

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleBrowseAll}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Browse All Help Topics
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HelpCircle className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No specific help available for this page.
              </p>
              <Button variant="outline" size="sm" onClick={handleBrowseAll}>
                Browse All Help Topics
              </Button>
            </div>
          )}
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 border-t bg-background px-6 py-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px]">
              Press F1 for Help Center
            </Badge>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
