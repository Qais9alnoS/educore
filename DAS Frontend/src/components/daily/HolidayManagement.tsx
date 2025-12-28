import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, AlertCircle, CalendarDays } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Alert, AlertDescription } from '../ui/alert';
import { ConfirmationDialog } from '../ui/confirmation-dialog';
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
}

interface DailySummary {
  total_present: number;
  total_absent: number;
  total_actions: number;
}

export function HolidayManagement({ academicYearId, sessionType, selectedDate: propSelectedDate }: HolidayManagementProps) {
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

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
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
          <Button
            onClick={goToToday}
            variant="outline"
            size="sm"
          >
            <CalendarDays className="w-4 h-4 ml-2" />
            العودة لليوم
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* شريط التنقل بين الأشهر - محسّن */}
        <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-2xl border border-primary/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPreviousMonth}
            className="h-9 w-9 p-0 hover:bg-primary/10 transition-all"
          >
            <ChevronRight className="h-5 w-5 text-primary" />
          </Button>

          <div className="text-center flex-1 cursor-pointer group">
            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
              {formatMonthYear(currentMonth)}
            </h3>
            {currentMonth.getMonth() === today.getMonth() &&
             currentMonth.getFullYear() === today.getFullYear() && (
              <p className="text-xs text-accent font-medium mt-1">
                {getArabicDayName(today)} - {today.getDate()}
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextMonth}
            className="h-9 w-9 p-0 hover:bg-primary/10 transition-all"
          >
            <ChevronLeft className="h-5 w-5 text-primary" />
          </Button>
        </div>

        {/* أسماء الأيام */}
        <div className="grid grid-cols-7 gap-2 mb-3">
          {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((day, idx) => (
            <div
              key={day}
              className="text-center font-semibold text-xs py-2 rounded-lg text-muted-foreground hover:text-primary transition-colors"
              title={['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][idx]}
            >
              {day}
            </div>
          ))}
        </div>

        {/* أيام التقويم - تصميم محسّن */}
        <div className="grid grid-cols-7 gap-2 p-3 bg-muted/30 rounded-2xl border border-border/50">
          {generateCalendarDates().map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            // استخدام التوقيت المحلي بدلاً من UTC
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
                  aspect-square p-2 text-center rounded-xl font-semibold text-sm
                  transition-all duration-200 relative overflow-hidden group
                  ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40'
                      : isHol
                        ? 'bg-accent/20 text-accent hover:bg-accent/30 border border-accent/40'
                        : 'bg-card text-foreground hover:bg-primary/10 border border-border/50'
                  }
                  ${
                    isTodayDate && !isSelected
                      ? 'ring-2 ring-accent ring-offset-2 ring-offset-background'
                      : ''
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                title={holiday?.holiday_name || (isDefault ? 'عطلة نهاية الأسبوع' : '')}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-bold">{date.getDate()}</span>
                  {isHol && (
                    <>
                      <span className="text-[8px] font-semibold opacity-75">
                        {isDefault ? '●' : '◆'}
                      </span>
                      {!isDefault && (
                        <span className="text-[7px] font-semibold opacity-75 line-clamp-1 w-full">
                          {holiday?.holiday_name || 'عطلة'}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* تنبيه الخطأ */}
        {error && (
          <Alert className="mt-4 border-accent bg-accent/10">
            <AlertCircle className="h-4 w-4 text-accent" />
            <AlertDescription className="text-accent-foreground">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* معلومات توضيحية - محسّنة */}
        <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-2xl border border-primary/20">
          <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            دليل الألوان والرموز
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-card border border-border/50"></div>
              <span>يوم عادي</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-[10px]">
                ●
              </div>
              <span>عطلة</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                ●
              </div>
              <span>مختار</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-card ring-2 ring-accent ring-offset-2 ring-offset-background"></div>
              <span>اليوم</span>
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
