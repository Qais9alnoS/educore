import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { HolidayManagement } from '@/components/daily/HolidayManagement';
import { StudentAttendance } from '@/components/daily/StudentAttendance';
import { TeacherAttendance } from '@/components/daily/TeacherAttendance';
import { StudentActions } from '@/components/daily/StudentActions';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

interface AcademicYear {
  id: number;
  year_name: string;
  is_active: boolean;
}

export default function DailyPage() {
  const { state } = useAuth();
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null);
  const [sessionType, setSessionType] = useState<'morning' | 'evening'>('morning');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dateKey, setDateKey] = useState<number>(0);
  const [allowedSessions, setAllowedSessions] = useState<('morning' | 'evening')[]>([]);
  const [isHoliday, setIsHoliday] = useState<boolean>(false);
  const [holidayInfo, setHolidayInfo] = useState<any>(null);
  const [academicYearRange, setAcademicYearRange] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    fetchActiveAcademicYear();
    determineAllowedSessions();
  }, [state.user]);

  const extractYearRange = (yearLabel: string): { start: number; end: number } | null => {
    // Extract years from format like "2024-2025"
    const match = yearLabel.match(/(\d{4})-(\d{4})/);
    if (match) {
      return {
        start: parseInt(match[1], 10),
        end: parseInt(match[2], 10)
      };
    }
    return null;
  };

  useEffect(() => {
    if (academicYear) {
      checkIfHoliday();
    }
  }, [selectedDate, academicYear, sessionType]);

  const fetchActiveAcademicYear = async () => {
    try {
      const storedYearId = localStorage.getItem('selected_academic_year_id');
      const storedYearName = localStorage.getItem('selected_academic_year_name');

      if (storedYearId) {
        const parsedId = parseInt(storedYearId, 10);
        if (!isNaN(parsedId)) {
          setAcademicYear({
            id: parsedId,
            year_name: storedYearName || '',
            is_active: true
          });
          const range = extractYearRange(storedYearName || '');
          setAcademicYearRange(range);
          return;
        }
      }

      const response = await api.get('/academic/years?active=true');
      const years = response.data as AcademicYear[];
      if (years.length > 0) {
        const year = years[0];
        setAcademicYear(year);
        const range = extractYearRange(year.year_name);
        setAcademicYearRange(range);
      }
    } catch (error) {

    }
  };

  const determineAllowedSessions = () => {
    if (!state.user) return;

    // المدير يملك صلاحية لرؤية كلا الفترتين
    if (state.user.role === 'admin' || state.user.role === 'director') {
      setAllowedSessions(['morning', 'evening']);
      // تحديد الفترة بناءً على الوقت
      const hour = new Date().getHours();
      setSessionType(hour >= 12 ? 'evening' : 'morning');
    } else {
      // للمشرفين، تحديد الفترة بناءً على session_type الخاص بهم
      const userSession = state.user.session_type || 'morning';
      setAllowedSessions([userSession]);
      setSessionType(userSession);
    }
  };

  const checkIfHoliday = async () => {
    try {
      // التحقق من الجمعة والسبت
      const date = new Date(selectedDate);
      const dayOfWeek = date.getDay();

      if (dayOfWeek === 5 || dayOfWeek === 6) {
        setIsHoliday(true);
        setHolidayInfo({ type: 'weekend', name: 'عطلة نهاية الأسبوع' });
        return;
      }

      // التحقق من العطل المسجلة
      const response = await api.get(
        `/daily/holidays?academic_year_id=${academicYear.id}&session_type=${sessionType}&date=${selectedDate}`
      );

      if (response.data && Array.isArray(response.data)) {
        const holiday = response.data.find((h: any) => h.holiday_date === selectedDate);
        if (holiday) {
          setIsHoliday(true);
          setHolidayInfo(holiday);
          return;
        }
      }

      setIsHoliday(false);
      setHolidayInfo(null);
    } catch (error) {

      setIsHoliday(false);
      setHolidayInfo(null);
    }
  };

  if (!academicYear) {
    return (
      <div className="min-h-screen bg-background p-6" dir="rtl">
        <div className="max-w-7xl mx-auto">
          <Card className="ios-card">
            <CardContent className="pt-6">
              <div className="flex justify-center items-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">جاري التحميل...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Date Display */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <CalendarDays className="h-8 w-8 text-primary" />
              الصفحة اليومية
            </h1>
            <p className="text-muted-foreground mt-1">
              إدارة الحضور والغياب والإجراءات اليومية - {academicYear.year_name}
            </p>
          </div>

          {/* Date Display Badge - Top Left */}
          <Card className="ios-card border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 shrink-0" key={dateKey}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Calendar className="w-4 h-4 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ar', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </span>
                  {sessionType && (
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {sessionType === 'morning' ? 'الفترة الصباحية' : 'الفترة المسائية'}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Date and Session Selector */}
        <Card className="ios-card">
          <CardHeader>
            <CardTitle>اختيار التاريخ والفترة</CardTitle>
            <CardDescription>حدد التاريخ والفترة الدراسية للعرض</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-picker" className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  التاريخ
                </Label>
                <DatePicker
                  value={new Date(selectedDate)}
                  onChange={(date) => {
                    if (date) {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      setSelectedDate(dateStr);
                      setDateKey(prev => prev + 1);
                    }
                  }}
                  minDate={academicYearRange ? new Date(academicYearRange.start, 0, 1) : undefined}
                  maxDate={academicYearRange ? new Date(academicYearRange.end, 11, 31) : undefined}
                  className="w-full"
                />
              </div>

              {allowedSessions.length > 1 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    الفترة الدراسية
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSessionType('morning')}
                      variant={sessionType === 'morning' ? 'default' : 'outline'}
                      className={`flex-1 ${sessionType === 'morning' ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : ''}`}
                    >
                      الفترة الصباحية
                    </Button>
                    <Button
                      onClick={() => setSessionType('evening')}
                      variant={sessionType === 'evening' ? 'default' : 'outline'}
                      className="flex-1"
                    >
                      الفترة المسائية
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="holidays" className="space-y-6">
          <Card className="ios-card">
            <CardContent className="pt-6">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="holidays">إدارة أيام العطلة</TabsTrigger>
                <TabsTrigger value="attendance">الحضور والغياب</TabsTrigger>
                <TabsTrigger value="actions">الإجراءات السريعة</TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>

          <TabsContent value="holidays" className="space-y-6">
            <HolidayManagement
              academicYearId={academicYear.id}
              sessionType={sessionType}
              selectedDate={selectedDate}
              academicYearRange={academicYearRange}
            />
          </TabsContent>

          <TabsContent value="attendance" className="space-y-6">
            {isHoliday ? (
              <Card className="ios-card border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950">
                <CardContent className="py-12">
                  <div className="text-center space-y-4">
                    <div>
                      <h3 className="text-2xl font-bold text-orange-700 dark:text-orange-300 mb-2">
                        يوم عطلة
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-lg">
                        {holidayInfo?.holiday_name || holidayInfo?.name || 'لا يوجد حضور في أيام العطل'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <StudentAttendance
                  academicYearId={academicYear.id}
                  sessionType={sessionType}
                  selectedDate={selectedDate}
                />

                <TeacherAttendance
                  academicYearId={academicYear.id}
                  sessionType={sessionType}
                  selectedDate={selectedDate}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="actions" className="space-y-6">
            <StudentActions
              academicYearId={academicYear.id}
              sessionType={sessionType}
              selectedDate={selectedDate}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
