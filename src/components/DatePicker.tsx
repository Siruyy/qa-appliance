import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** ISO date string (YYYY-MM-DD) */
  value: string;
  /** Receives ISO date string (YYYY-MM-DD) */
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "h-8 w-[150px] justify-start gap-2 text-left font-normal",
              !value && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="h-3.5 w-3.5" />
        {value ? format(selected!, "MM/dd/yyyy") : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          selected={selected}
          onSelect={(day) => {
            if (day) {
              onChange(format(day, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
          defaultMonth={selected}
          startMonth={new Date(2000, 0)}
          endMonth={new Date(2050, 11)}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
