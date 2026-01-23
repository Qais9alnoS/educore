import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AcademicYearDatePickerProps {
  minYear: number;
  maxYear: number;
  selected?: Date | null;
  onSelect?: (date: Date) => void;
  className?: string;
}

export const AcademicYearDatePicker: React.FC<AcademicYearDatePickerProps> = ({
  minYear,
  maxYear,
  selected,
  onSelect,
  className,
}) => {
  const [view, setView] = useState<"month" | "year">("month");
  const [displayDate, setDisplayDate] = useState<Date>(selected || new Date());

  const currentYear = displayDate.getFullYear();
  const currentMonth = displayDate.getMonth();

  // Arabic month names
  const monthNames = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];

  // Check if selected
  const isSelected = (date: Date): boolean => {
    if (!selected) return false;
    return (
      date.getDate() === selected.getDate() &&
      date.getMonth() === selected.getMonth() &&
      date.getFullYear() === selected.getFullYear()
    );
  };

  // Month View - Only shows month selection, not individual days
  const renderMonthView = () => {
    const canGoPrev = currentYear - 1 >= minYear;
    const canGoNext = currentYear + 1 <= maxYear;

    return (
      <div className="space-y-4 p-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDisplayDate(new Date(currentYear - 1, currentMonth, 1))}
            disabled={!canGoPrev}
            className="h-9 w-9 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <button
            onClick={() => setView("year")}
            className="flex-1 text-center py-2 rounded-lg hover:bg-primary/10 transition-colors"
          >
            <div className="font-semibold text-lg text-foreground">
              {currentYear}
            </div>
          </button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDisplayDate(new Date(currentYear + 1, currentMonth, 1))}
            disabled={!canGoNext}
            className="h-9 w-9 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Months grid - 4 columns for better layout */}
        <div className="grid grid-cols-3 gap-2">
          {monthNames.map((month, index) => {
            const monthDate = new Date(currentYear, index, 1);
            const isSelectedMonth =
              selected &&
              selected.getMonth() === index &&
              selected.getFullYear() === currentYear;

            return (
              <button
                key={month}
                onClick={() => {
                  const newDate = new Date(currentYear, index, 1);
                  if (onSelect) {
                    onSelect(newDate);
                  }
                }}
                className={cn(
                  "py-3 px-2 rounded-2xl font-semibold text-sm transition-colors duration-200 border",
                  isSelectedMonth
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground hover:bg-muted border-border"
                )}
              >
                {month}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Year View - Select between the two academic years
  const renderYearView = () => {
    const years: number[] = [];
    for (let i = minYear; i <= maxYear; i++) {
      years.push(i);
    }

    return (
      <div className="space-y-4 p-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 text-center py-2">
            <div className="font-semibold text-lg text-foreground">
              اختر السنة
            </div>
          </div>
        </div>

        {/* Years grid */}
        <div className="grid grid-cols-2 gap-3">
          {years.map((year) => {
            const isSelectedYear = selected && selected.getFullYear() === year;

            return (
              <button
                key={year}
                onClick={() => {
                  setDisplayDate(new Date(year, currentMonth, 1));
                  setView("month");
                }}
                className={cn(
                  "py-4 px-3 rounded-2xl font-semibold text-base transition-colors duration-200 border",
                  isSelectedYear
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground hover:bg-muted border-border"
                )}
              >
                {year}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-3xl border border-border bg-card shadow-lg",
        className
      )}
    >
      {view === "month" ? renderMonthView() : renderYearView()}
    </div>
  );
};
