import * as React from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AdvancedCalendar } from "@/components/ui/advanced-calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "اختر تاريخاً",
  className,
  minDate,
  maxDate,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full h-12 px-4 text-right font-normal rounded-2xl border-input bg-background hover:bg-background hover:border-primary/50 transition-all duration-200",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
          {value ? (
            format(value, "PPP", { locale: ar })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-0 shadow-2xl" align="start">
        <AdvancedCalendar
          selected={value}
          onSelect={onChange}
          minDate={minDate}
          maxDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  );
}
