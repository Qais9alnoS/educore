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

interface DateInputProps {
  value?: string | Date | null;
  onChange?: (dateString: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  label?: string;
  error?: string;
  required?: boolean;
}

/**
 * DateInput Component - A reusable date picker using AdvancedCalendar
 * Replaces type="date" inputs throughout the app
 * 
 * Usage:
 * <DateInput 
 *   value={dateValue}
 *   onChange={(dateStr) => setDateValue(dateStr)}
 *   label="Start Date"
 *   placeholder="Select a date"
 * />
 */
export function DateInput({
  value,
  onChange,
  placeholder = "اختر تاريخاً",
  className,
  disabled = false,
  minDate,
  maxDate,
  label,
  error,
  required = false,
}: DateInputProps) {
  // Parse value to Date object
  const parsedDate = React.useMemo(() => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value === "string") {
      const parsed = new Date(value);
      // Check if it's a valid date
      return !isNaN(parsed.getTime()) ? parsed : undefined;
    }
    return undefined;
  }, [value]);

  const handleDateSelect = (date: Date) => {
    if (onChange) {
      // Format as YYYY-MM-DD for input compatibility
      const formattedDate = format(date, "yyyy-MM-dd");
      onChange(formattedDate);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-foreground flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            disabled={disabled}
            className={cn(
              "w-full h-12 px-4 text-right font-normal rounded-2xl border-input bg-background hover:bg-background hover:border-primary/50 transition-all duration-200",
              !parsedDate && "text-muted-foreground",
              error && "border-red-500 hover:border-red-600",
              className
            )}
          >
            <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
            {parsedDate ? (
              format(parsedDate, "PPP", { locale: ar })
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-0 shadow-2xl" align="start">
          <AdvancedCalendar
            selected={parsedDate}
            onSelect={handleDateSelect}
            minDate={minDate}
            maxDate={maxDate}
          />
        </PopoverContent>
      </Popover>

      {error && (
        <p className="text-sm text-red-500 font-medium">{error}</p>
      )}
    </div>
  );
}

export default DateInput;
