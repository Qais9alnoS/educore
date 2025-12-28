import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AdvancedCalendarProps {
  selected?: Date | null;
  onSelect?: (date: Date) => void;
  className?: string;
  disabled?: (date: Date) => boolean;
  minDate?: Date;
  maxDate?: Date;
}

export const AdvancedCalendar: React.FC<AdvancedCalendarProps> = ({
  selected,
  onSelect,
  className,
  disabled,
  minDate,
  maxDate,
}) => {
  const [view, setView] = useState<"month" | "year" | "decade">("month");
  const [displayDate, setDisplayDate] = useState<Date>(selected || new Date());

  const currentYear = displayDate.getFullYear();
  const currentMonth = displayDate.getMonth();

  // Get the allowed year range
  const minYear = minDate ? minDate.getFullYear() : null;
  const maxYear = maxDate ? maxDate.getFullYear() : null;

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

  // Arabic day names
  const dayNames = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

  // Check if date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Check if date is selected
  const isSelected = (date: Date): boolean => {
    if (!selected) return false;
    return (
      date.getDate() === selected.getDate() &&
      date.getMonth() === selected.getMonth() &&
      date.getFullYear() === selected.getFullYear()
    );
  };

  // Check if date is disabled
  const isDateDisabled = (date: Date): boolean => {
    if (disabled && disabled(date)) return true;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);

    while (current <= lastDay || current.getDay() !== 0) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  // Generate years for decade view
  const generateYears = () => {
    const startYear = Math.floor(currentYear / 10) * 10;
    const years: number[] = [];
    for (let i = startYear; i < startYear + 10; i++) {
      years.push(i);
    }
    return years;
  };

  // Month View
  const renderMonthView = () => {
    const days = generateCalendarDays();
    
    // Calculate if we can navigate to previous/next month
    const prevDate = new Date(currentYear, currentMonth - 1, 1);
    const nextDate = new Date(currentYear, currentMonth + 1, 1);
    const canGoPrev = !minDate || prevDate >= minDate;
    const canGoNext = !maxDate || nextDate <= maxDate;

    return (
      <div className="space-y-4">
        {/* Header with navigation */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setDisplayDate(
                new Date(currentYear, currentMonth - 1, 1)
              )
            }
            disabled={!canGoPrev}
            className="h-9 w-9 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <button
            onClick={() => setView("year")}
            className="flex-1 text-center py-2 rounded-lg hover:bg-primary/10 transition-colors"
          >
            <div className="font-semibold text-foreground">
              {monthNames[currentMonth]} {currentYear}
            </div>
          </button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setDisplayDate(
                new Date(currentYear, currentMonth + 1, 1)
              )
            }
            disabled={!canGoNext}
            className="h-9 w-9 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            const isCurrentMonth = date.getMonth() === currentMonth;
            const isTodayDate = isToday(date);
            const isSelectedDate = isSelected(date);
            const isDisabledDate = isDateDisabled(date);

            return (
              <button
                key={index}
                onClick={() => {
                  if (!isDisabledDate && onSelect) {
                    onSelect(date);
                  }
                }}
                disabled={isDisabledDate}
                className={cn(
                  "h-9 rounded-lg font-semibold text-sm transition-all duration-200",
                  "flex items-center justify-center",
                  // Base styles
                  isDisabledDate
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "cursor-pointer",
                  // Current month
                  isCurrentMonth
                    ? "text-foreground"
                    : "text-muted-foreground/60",
                  // Selected
                  isSelectedDate
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                    : isTodayDate
                      ? "bg-accent/20 text-accent border-2 border-accent hover:bg-accent/30"
                      : isCurrentMonth
                        ? "hover:bg-primary/10"
                        : "hover:bg-muted/50"
                )}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Year View (Month Selection)
  const renderYearView = () => {
    // Calculate if we can navigate to previous/next year
    const canGoPrev = !minYear || (currentYear - 1) >= minYear;
    const canGoNext = !maxYear || (currentYear + 1) <= maxYear;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setDisplayDate(
                new Date(currentYear - 1, currentMonth, 1)
              )
            }
            disabled={!canGoPrev}
            className="h-9 w-9 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <button
            onClick={() => setView("decade")}
            className="flex-1 text-center py-2 rounded-lg hover:bg-primary/10 transition-colors"
          >
            <div className="font-semibold text-foreground">{currentYear}</div>
          </button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setDisplayDate(
                new Date(currentYear + 1, currentMonth, 1)
              )
            }
            disabled={!canGoNext}
            className="h-9 w-9 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Months grid */}
        <div className="grid grid-cols-3 gap-2">
          {monthNames.map((month, index) => {
            const monthDate = new Date(currentYear, index, 1);
            const isDisabledMonth = 
              (minDate && monthDate < minDate) || 
              (maxDate && monthDate > maxDate);
            const isSelectedMonth = selected && selected.getMonth() === index && selected.getFullYear() === currentYear;
            return (
              <button
                key={month}
                onClick={() => {
                  setDisplayDate(new Date(currentYear, index, 1));
                  setView("month");
                }}
                disabled={isDisabledMonth}
                className={cn(
                  "py-2 px-3 rounded-lg font-semibold text-sm transition-all duration-200",
                  isDisabledMonth
                    ? "text-muted-foreground/40 cursor-not-allowed opacity-50"
                    : "hover:bg-primary/10 cursor-pointer",
                  isSelectedMonth
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-foreground"
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

  // Decade View (Year Selection)
  const renderDecadeView = () => {
    const years = generateYears();
    const decadeStart = years[0];
    const decadeEnd = years[years.length - 1];
    
    // Calculate if we can navigate to previous/next decade
    const canGoPrev = !minYear || (decadeStart - 10) >= minYear;
    const canGoNext = !maxYear || (decadeEnd + 10) <= maxYear;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setDisplayDate(
                new Date(currentYear - 10, currentMonth, 1)
              )
            }
            disabled={!canGoPrev}
            className="h-9 w-9 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="flex-1 text-center py-2 rounded-lg">
            <div className="font-semibold text-foreground">
              {decadeStart} - {decadeEnd}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setDisplayDate(
                new Date(currentYear + 10, currentMonth, 1)
              )
            }
            disabled={!canGoNext}
            className="h-9 w-9 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Years grid */}
        <div className="grid grid-cols-2 gap-2">
          {years.map((year) => {
            const isDisabledYear = 
              (minYear && year < minYear) || 
              (maxYear && year > maxYear);
            const isSelectedYear = selected && selected.getFullYear() === year;
            return (
              <button
                key={year}
                onClick={() => {
                  setDisplayDate(new Date(year, currentMonth, 1));
                  setView("year");
                }}
                disabled={isDisabledYear}
                className={cn(
                  "py-2 px-3 rounded-lg font-semibold text-sm transition-all duration-200",
                  isDisabledYear
                    ? "text-muted-foreground/40 cursor-not-allowed opacity-50"
                    : "hover:bg-primary/10 cursor-pointer",
                  isSelectedYear
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-foreground"
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
        "w-full max-w-sm p-4 rounded-2xl border border-border bg-card",
        "shadow-lg space-y-4",
        className
      )}
    >
      {/* Quick "Today" button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const today = new Date();
          setDisplayDate(today);
          if (onSelect) {
            onSelect(today);
          }
          setView("month");
        }}
        className="w-full h-9 rounded-lg hover:bg-primary/10"
      >
        <Calendar className="h-4 w-4 ml-2" />
        اليوم
      </Button>

      {/* Calendar content */}
      {view === "month" && renderMonthView()}
      {view === "year" && renderYearView()}
      {view === "decade" && renderDecadeView()}
    </div>
  );
};

export default AdvancedCalendar;
