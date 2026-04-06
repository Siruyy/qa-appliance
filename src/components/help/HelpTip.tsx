import { CircleHelp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTipProps {
  text: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  /** Render inline next to a label vs standalone */
  inline?: boolean;
}

export function HelpTip({ text, side = "top", className, inline = true }: HelpTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className={cn(
          "text-muted-foreground/60 hover:text-muted-foreground transition-colors",
          inline && "inline-flex align-middle ml-1",
          className
        )}
        aria-label="Help"
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
