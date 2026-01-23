import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, AlertCircle, CalendarDays, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Alert, AlertDescription } from '../ui/alert';
import { ConfirmationDialog } from '../ui/confirmation-dialog';
import { AcademicYearDatePicker } from '../ui/academic-year-date-picker';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';

interface Holiday {
  id: number;
  holiday_date: string;
  session_type: string;
  holiday_name?: string;
  notes?: string;
}

interface HolidayManagementProps {
  academicYearId: number;
  sessionType: 'morning' | 'evening';
  selectedDate: string;
  academicYearRange?: { start: number; end: number } | null;
}

interface DailySummary {
  total_present: number;
  total_absent: number;
  total_actions: number;
}

export function HolidayManagement({ academicYearId, sessionType, selectedDate: propSelectedDate, academicYearRange }: HolidayManagementProps) {
  const { toast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showDialog, setShowDialog] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [notes, setNotes] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date(propSelectedDate || new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null);
  const [pastDateConfirmOpen, setPastDateConfirmOpen] = useState(false);
  const [pendingPastDate, setPendingPastDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchHolidays();
  }, [academicYearId, sessionType]);

  useEffect(() => {
    // تحديث التقويم ليظهر الشهر المحدد من الصفحة الرئيسية
    if (propSelectedDate) {
      setCurrentMonth(new Date(propSelectedDate));
    }
  }, [propSelectedDate]);

  const fetchHolidays = async () => {
    try {
      setError(null);
      const response = await api.get(`/daily/holidays?academic_year_id=${academicYearId}&session_type=${sessionType}`);

      if (response.data && Array.isArray(response.data)) {
        setHolidays(response.data as Holiday[]);
      } else {
        setHolidays([]);
      }
    } catch (error: any) {

      setError('حدث خطأ أثناء تحميل العطل. سيتم إنشاء جدول العطل عند إضافة أول عطلة.');
      setHolidays([]);
    }
  };

  const checkPastDateData = async (dateStr: string): Promise<boolean> => {
    try {
      // التحقق من وجود بيانات حضور في هذا التاريخ
      const response = await api.get(`/daily/summary/${dateStr}?academic_year_id=${academicYearId}`);
      const data = response.data as DailySummary;

      // إذا كان هناك حضور أو إجراءات
      if (data && (data.total_present > 0 || data.total_absent > 0 || data.total_actions > 0)) {
        return true;
      }
      return false;
    } catch (error) {
      // إذا حدث خطأ، نفترض عدم وجود بيانات
      return false;
    }
  };

  const handleDateClick = async (dateStr: string) => {
    const existing = holidays.find(h => h.holiday_date === dateStr);
    const selectedDateObj = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // التحقق من أن التاريخ ليس في نهاية الأسبوع الافتراضية
    const dayOfWeek = selectedDateObj.getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // الجمعة أو السبت

    if (existing) {
      // حذف العطلة
      setHolidayToDelete(existing);
      setDeleteConfirmOpen(true);
    } else {
      // منع إضافة عطلة في أيام نهاية الأسبوع الافتراضية
      if (isWeekend) {
        toast({
          title: 'غير مسموح',
          description: 'لا يمكنك إضافة عطلة في أيام نهاية الأسبوع الافتراضية',
          variant: 'destructive',
        });
        return;
      }

      // التحقق إذا كان تاريخ سابق
      if (selectedDateObj < today) {
        const hasData = await checkPastDateData(dateStr);
        if (hasData) {
          setPendingPastDate(dateStr);
          setPastDateConfirmOpen(true);
          return;
        }
      }

      // إضافة عطلة جديدة
      setSelectedDate(dateStr);
      setShowDialog(true);
    }
  };

  const handleSaveHoliday = async () => {
    setLoading(true);
    try {
      await api.post('/daily/holidays', {
        academic_year_id: academicYearId,
        session_type: sessionType,
        holiday_date: selectedDate,
        holiday_name: holidayName || null,
        notes: notes || null
      });

      setShowDialog(false);
      resetForm();
      await fetchHolidays(); // تحديث العطل بعد الحفظ
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حفظ العطلة',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteHoliday = async () => {
    if (!holidayToDelete) return;

    try {
      await api.delete(`/daily/holidays/${holidayToDelete.id}`);
      setDeleteConfirmOpen(false);
      setHolidayToDelete(null);
      fetchHolidays();
      toast({
        title: 'نجح',
        description: 'تم حذف العطلة بنجاح',
      });
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حذف العطلة',
        variant: 'destructive',
      });
      setDeleteConfirmOpen(false);
      setHolidayToDelete(null);
    }
  };

  const handleConfirmPastDate = () => {
    if (pendingPastDate) {
      setSelectedDate(pendingPastDate);
      setShowDialog(true);
      setPastDateConfirmOpen(false);
      setPendingPastDate(null);
    }
  };

  const resetForm = () => {
    setSelectedDate('');
    setHolidayName('');
    setNotes('');
  };

  const generateCalendarDates = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // أول يوم في الشهر
    const firstDay = new Date(year, month, 1);
    // آخر يوم في الشهر
    const lastDay = new Date(year, month + 1, 0);

    // يوم الأسبوع لأول يوم (0 = الأحد)
    const startDayOfWeek = firstDay.getDay();

    // إضافة أيام فارغة في البداية
    const dates: (Date | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      dates.push(null);
    }

    // إضافة أيام الشهر
    for (let day = 1; day <= lastDay.getDate(); day++) {
      dates.push(new Date(year, month, day));
    }

    return dates;
  };

  const canGoToPreviousMonth = (): boolean => {
    if (!academicYearRange) return true;
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const minDate = new Date(academicYearRange.start, 0, 1);
    return prevMonth >= minDate;
  };

  const canGoToNextMonth = (): boolean => {
    if (!academicYearRange) return true;
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const maxDate = new Date(academicYearRange.end, 11, 31);
    return nextMonth <= maxDate;
  };

  const goToPreviousMonth = () => {
    if (canGoToPreviousMonth()) {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    }
  };

  const goToNextMonth = () => {
    if (canGoToNextMonth()) {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    }
  };

  const goToToday = () => {
    const today = new Date();
    if (!academicYearRange) {
      setCurrentMonth(today);
      return;
    }
    const minDate = new Date(academicYearRange.start, 0, 1);
    const maxDate = new Date(academicYearRange.end, 11, 31);
    if (today >= minDate && today <= maxDate) {
      setCurrentMonth(today);
    }
  };

  const handleDatePickerSelect = (date: Date) => {
    setCurrentMonth(date);
    setShowDatePicker(false);
  };

  const isHoliday = (dateStr: string, dateObj?: Date) => {
    // استخدام الكائن Date إذا تم تمريره، وإلا إنشاء واحد جديد
    const date = dateObj || new Date(dateStr + 'T00:00:00');
    const dayOfWeek = date.getDay();

    // التحقق من العطل المسجلة في قاعدة البيانات أولاً
    const holiday = holidays.find(h => h.holiday_date === dateStr);

    // إذا كانت هناك عطلة مسجلة، نعيدها
    if (holiday) {
      return { isHoliday: true, isDefault: false, holiday };
    }

    // الجمعة (5) والسبت (6) كعطلة افتراضية - في JS: 0=الأحد، 5=الجمعة، 6=السبت
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      return { isHoliday: true, isDefault: true, holiday: null };
    }

    return { isHoliday: false, isDefault: false, holiday: null };
  };

  const isToday = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelectedDate = (date: Date | null): boolean => {
    if (!date || !propSelectedDate) return false;
    const selected = new Date(propSelectedDate);
    return date.getDate() === selected.getDate() &&
           date.getMonth() === selected.getMonth() &&
           date.getFullYear() === selected.getFullYear();
  };

  const formatMonthYear = (date: Date): string => {
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getArabicDayName = (date: Date): string => {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[date.getDay()];
  };

  const today = new Date();

  return (
    <Card className="ios-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              إدارة أيام العطلة
            </CardTitle>
            <CardDescription className="mt-1">
              قم بإضافة أو إزالة أيام العطل للفترة {sessionType === 'morning' ? 'الصباحية' : 'المسائية'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Calendar Container */}
        <div className="space-y-0">
          {/* Calendar Card Wrapper */}
          <div className="rounded-3xl border border-border bg-background overflow-hidden">
            {/* Header with Month/Year Navigation */}
            <div className="flex items-center justify-between gap-3 p-6 border-b border-border bg-muted/40">
              {/* Previous Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousMonth}
                disabled={!canGoToPreviousMonth()}
                className="h-10 w-10 p-0 rounded-2xl hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-primary" />
              </Button>

              {/* Month/Year Display - Clickable for date picker */}
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <button className="flex-1 text-center py-3 px-4 hover:bg-muted transition-colors rounded-2xl group">
                    <div className="text-lg font-bold text-foreground">
                      {formatMonthYear(currentMonth)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      اختر الشهر والسنة
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border shadow-lg rounded-3xl" align="center">
                  {academicYearRange && (
                    <AcademicYearDatePicker
                      minYear={academicYearRange.start}
                      maxYear={academicYearRange.end}
                      selected={currentMonth}
                      onSelect={handleDatePickerSelect}
                    />
                  )}
                </PopoverContent>
              </Popover>

              {/* Next Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextMonth}
                disabled={!canGoToNextMonth()}
                className="h-10 w-10 p-0 rounded-2xl hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-primary" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0 border-b border-border bg-background">
              {['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((day, idx) => (
                <div
                  key={day}
                  className={`text-center font-semibold text-xs py-3 text-muted-foreground ${
                    idx !== 6 ? 'border-r border-border' : ''
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="divide-y divide-border">
              {Array.from({ length: Math.ceil(generateCalendarDates().length / 7) }).map((_, weekIdx) => (
                <div key={`week-${weekIdx}`} className="grid grid-cols-7 gap-0 divide-x divide-border">
                  {generateCalendarDates().slice(weekIdx * 7, (weekIdx + 1) * 7).map((date, dayIdx) => {
                    if (!date) {
                      return (
                        <div
                          key={`empty-${weekIdx}-${dayIdx}`}
                          className="aspect-square bg-muted/20 p-0"
                        />
                      );
                    }

                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    const { isHoliday: isHol, isDefault, holiday } = isHoliday(dateStr, date);
                    const isTodayDate = isToday(date);
                    const isSelected = isSelectedDate(date);

                    return (
                      <button
                        key={dateStr}
                        onClick={() => handleDateClick(dateStr)}
                        className={`
                          aspect-square p-2 font-semibold transition-colors duration-200 relative
                          flex flex-col items-center justify-center gap-0.5 text-center
                          border-0 overflow-hidden group
                          ${
                            isSelected
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                              : isHol
                              ? 'bg-yellow-50/70 dark:bg-yellow-950/15 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20'
                                : isTodayDate
                                  ? 'bg-accent/20 text-foreground hover:bg-accent/30'
                                  : 'bg-background text-foreground hover:bg-muted'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        title={holiday?.holiday_name || (isDefault ? 'عطلة نهاية الأسبوع' : '')}
                      >
                        <span className="text-sm font-bold leading-tight">{date.getDate()}</span>
                        {isHol && (
                          <span className="text-xs leading-none">
                            {isDefault ? '●' : '◆'}
                          </span>
                        )}
                        {!isDefault && holiday?.holiday_name && (
                          <span className="text-[8px] font-semibold line-clamp-1 w-full leading-tight">
                            {holiday.holiday_name}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend - Outside the calendar card */}
          <div className="mt-6 p-6 rounded-3xl border border-border bg-card">
            <p className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              دليل الألوان والرموز
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-background border-2 border-border flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-foreground">1</span>
                </div>
                <span className="text-sm text-muted-foreground">يوم عادي</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/20 border-2 border-accent flex items-center justify-center flex-shrink-0">
                  <span className="text-base text-accent">●</span>
                </div>
                <span className="text-sm text-muted-foreground">اليوم</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-50/70 dark:bg-yellow-950/15 border-2 border-yellow-400/40 text-yellow-800 dark:text-yellow-200 flex items-center justify-center flex-shrink-0 text-base">
                  ●
                </div>
                <span className="text-sm text-muted-foreground">عطلة</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary border-2 border-primary text-primary-foreground flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  ●
                </div>
                <span className="text-sm text-muted-foreground">مختار</span>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl">إضافة عطلة</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {selectedDate && new Date(selectedDate).toLocaleDateString('ar-EG', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="holidayName" className="text-foreground">
                  اسم العطلة (اختياري)
                </Label>
                <Input
                  id="holidayName"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="مثال: عيد الفطر، عيد الأضحى..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-foreground">
                  ملاحظات (اختياري)
                </Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات إضافية..."
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
                disabled={loading}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleSaveHoliday}
                disabled={loading}
              >
                {loading ? 'جاري الحفظ...' : 'حفظ العطلة'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Holiday Confirmation Dialog */}
        <ConfirmationDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="حذف العطلة"
          description="هل تريد إلغاء هذه العطلة؟"
          confirmText="حذف"
          cancelText="إلغاء"
          variant="destructive"
          onConfirm={confirmDeleteHoliday}
        />

        {/* Past Date Confirmation Dialog */}
        <ConfirmationDialog
          open={pastDateConfirmOpen}
          onOpenChange={setPastDateConfirmOpen}
          title="تحذير"
          description="⚠️ هذا التاريخ يحتوي على بيانات حضور أو إجراءات. هل تريد المتابعة وجعله عطلة؟"
          confirmText="المتابعة"
          cancelText="إلغاء"
          onConfirm={handleConfirmPastDate}
        />
      </CardContent>
    </Card>
  );
}
