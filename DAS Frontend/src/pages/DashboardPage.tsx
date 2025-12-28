import React, { useState, useEffect, useCallback } from 'react';
import { HistoryCard } from '@/components/history/HistoryCard';
import {
  DashboardFilterBar,
  QuickStatsGrid,
  SessionComparisonCard,
  FinancialSummaryCard,
  QuickActionsPanel,
  FinanceTrendsCard,
  AcademicPerformanceCard,
  StudentDistributionCard,
  SessionFilter,
  PeriodFilter
} from '@/components/dashboard';
import FinanceAnalyticsDashboard from '@/components/analytics/FinanceAnalyticsDashboard';
import SchoolGradesChart from '@/components/dashboard/SchoolGradesChart';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar, LayoutDashboard, GraduationCap } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { state: authState } = useAuth();
  const userRole = authState.user?.role;

  // Set initial session filter based on role
  const getInitialSessionFilter = (): SessionFilter => {
    if (userRole === 'morning_school') return 'morning';
    if (userRole === 'evening_school') return 'evening';
    return 'both';
  };

  const [sessionFilter, setSessionFilter] = useState<SessionFilter>(getInitialSessionFilter());
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('monthly');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [academicYearId, setAcademicYearId] = useState<number>(1);
  const [academicYearName, setAcademicYearName] = useState<string>('');

  // Check if user is director or finance
  const isDirector = userRole === 'director';
  const isFinance = userRole === 'finance';
  const isMorningSchool = userRole === 'morning_school';
  const isEveningSchool = userRole === 'evening_school';

  // Dashboard data state
  const [dashboardData, setDashboardData] = useState<any>({
    quickStats: {
      students: { morning: 0, evening: 0, total: 0 },
      teachers: { morning: 0, evening: 0, total: 0 },
      classes: { morning: 0, evening: 0, total: 0 },
      activities: 0,
      netProfit: 0
    },
    sessionData: {
      morning: { students: 0, teachers: 0, classes: 0 },
      evening: { students: 0, teachers: 0, classes: 0 }
    },
    financial: {
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      collectionRate: 0
    },
    attendance: {
      students: [],
      teachers: []
    },
    financeTrends: {
      incomeTrends: null,
      expenseTrends: null
    },
    academicPerformance: {
      subjectPerformance: [],
      examStatistics: {}
    },
    distribution: {
      by_grade: [],
      by_gender: [],
      by_transportation: [],
      by_section: []
    }
  });

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const storedYearId = localStorage.getItem('selected_academic_year_id');
      const storedYearName = localStorage.getItem('selected_academic_year_name');
      const yearId = storedYearId ? parseInt(storedYearId) : 1;
      setAcademicYearId(yearId);
      if (storedYearName) {
        setAcademicYearName(storedYearName);
      }

      // Build query parameters
      const params: Record<string, string> = {
        academic_year_id: yearId.toString(),
        period_type: periodFilter
      };

      // Only add session_type if a specific session is selected (not 'both')
      if (sessionFilter !== 'both') {
        params.session_type = sessionFilter;
      }

      const queryParams = new URLSearchParams(params).toString();

      // When viewing both sessions, we need to fetch attendance data separately for morning and evening
      const promises = [
        api.get(`/analytics/overview?${queryParams}`),
        api.get(`/analytics/students/distribution?${queryParams}`),
        api.get(`/analytics/academic/performance?${queryParams}`)
      ];

      // Only fetch finance data for directors (morning/evening school users don't have permission)
      if (isDirector) {
        promises.push(
          api.get(`/analytics/finance/overview?${queryParams}`),
          api.get(`/analytics/finance/income-trends?${queryParams}`),
          api.get(`/analytics/finance/expense-trends?${queryParams}`)
        );
      }

      // Add attendance API calls
      if (sessionFilter === 'both') {
        // Fetch morning and evening attendance separately
        const morningParams = new URLSearchParams({ ...params, session_type: 'morning' }).toString();
        const eveningParams = new URLSearchParams({ ...params, session_type: 'evening' }).toString();
        promises.push(
          api.get(`/analytics/attendance?${morningParams}`),
          api.get(`/analytics/attendance?${eveningParams}`)
        );
      } else {
        // Fetch for specific session
        promises.push(api.get(`/analytics/attendance?${queryParams}`));
      }

      const results = await Promise.all(promises);

      let overviewRes, distributionRes, academicRes, financialRes, incomeRes, expenseRes;

      if (isDirector) {
        [
          overviewRes,
          distributionRes,
          academicRes,
          financialRes,
          incomeRes,
          expenseRes
        ] = results.slice(0, 6);
      } else {
        [
          overviewRes,
          distributionRes,
          academicRes
        ] = results.slice(0, 3);
        // Set empty finance data for non-directors
        financialRes = { data: { data: { summary: {}, collection: {} } } };
        incomeRes = { data: null };
        expenseRes = { data: null };
      }

      // Handle attendance data based on session filter
      const attendanceStartIndex = isDirector ? 6 : 3;
      let attendanceRes = results[attendanceStartIndex];

      // Process and set data
      const overview = (overviewRes.data as any) || {};
      // financialRes.data has shape { success, data: { summary, collection, ... } }
      const financialWrapper = (financialRes.data as any) || {};
      const financial = financialWrapper.data || financialWrapper;
      let attendance: any;

      if (sessionFilter === 'both') {
        const morningAttendanceRes = results[attendanceStartIndex];
        const eveningAttendanceRes = results[attendanceStartIndex + 1];
        const morningData = morningAttendanceRes.data as any || {};
        const eveningData = eveningAttendanceRes.data as any || {};

        // Merge morning and evening attendance data
        const morningAttendance = morningData.student_attendance || [];
        const eveningAttendance = eveningData.student_attendance || [];

        // Create a map of dates with both morning and evening rates
        const dateMap = new Map();

        morningAttendance.forEach((record: any) => {
          dateMap.set(record.date, {
            date: record.date,
            morning_rate: record.attendance_rate,
            morning_total: record.total,
            morning_present: record.present,
            morning_absent: record.absent
          });
        });

        eveningAttendance.forEach((record: any) => {
          const existing = dateMap.get(record.date);
          if (existing) {
            existing.evening_rate = record.attendance_rate;
            existing.evening_total = record.total;
            existing.evening_present = record.present;
            existing.evening_absent = record.absent;
          } else {
            dateMap.set(record.date, {
              date: record.date,
              evening_rate: record.attendance_rate,
              evening_total: record.total,
              evening_present: record.present,
              evening_absent: record.absent
            });
          }
        });

        attendance = {
          student_attendance: Array.from(dateMap.values()).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
          ),
          teacher_attendance: morningData.teacher_attendance || eveningData.teacher_attendance || [],
          top_absent_students: morningData.top_absent_students || []
        };
      } else {
        attendance = attendanceRes.data as any || {};
        // Add session-specific rate field
        if (attendance.student_attendance) {
          attendance.student_attendance = attendance.student_attendance.map((record: any) => ({
            ...record,
            [`${sessionFilter}_rate`]: record.attendance_rate
          }));
        }
      }

      setDashboardData({
        quickStats: {
          students: {
            morning: overview.morning_students || 0,
            evening: overview.evening_students || 0,
            total: overview.total_students || 0
          },
          teachers: {
            morning: overview.morning_teachers || 0,
            evening: overview.evening_teachers || 0,
            total: overview.total_teachers || 0
          },
          classes: {
            morning: overview.morning_classes || 0,
            evening: overview.evening_classes || 0,
            total: overview.total_classes || 0
          },
          activities: overview.total_activities || 0,
          netProfit: financial.summary?.net_profit || 0
        },
        sessionData: {
          morning: {
            students: overview.morning_students || 0,
            teachers: overview.morning_teachers || 0,
            classes: overview.morning_classes || 0
          },
          evening: {
            students: overview.evening_students || 0,
            teachers: overview.evening_teachers || 0,
            classes: overview.evening_classes || 0
          }
        },
        financial: {
          totalIncome: financial.summary?.total_income || 0,
          totalExpenses: financial.summary?.total_expenses || 0,
          netProfit: financial.summary?.net_profit || 0,
          collectionRate: financial.collection?.collection_rate || 0
        },
        attendance: {
          students: attendance.student_attendance || [],
          teachers: attendance.teacher_attendance || []
        },
        financeTrends: {
          incomeTrends: incomeRes.data || null,
          expenseTrends: expenseRes.data || null
        },
        academicPerformance: {
          subjectPerformance: (academicRes.data as any)?.subject_performance || [],
          examStatistics: (academicRes.data as any)?.exam_statistics || {}
        },
        distribution: (distributionRes.data as any) || {
          by_grade: [],
          by_gender: [],
          by_transportation: [],
          by_section: []
        }
      });

      setLastUpdated(new Date());
    } catch (error) {

    } finally {
      setLoading(false);
    }
  }, [periodFilter, sessionFilter]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh mechanism (always enabled - every 30 seconds)
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchDashboardData();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  // Handle session filter change - prevent changing if locked to specific session
  const handleSessionChange = (newSession: SessionFilter) => {
    // Morning/Evening school users cannot change their locked session
    if (isMorningSchool || isEveningSchool) return;
    setSessionFilter(newSession);
  };

  // Get current date in Arabic
  const today = new Date();
  const arabicDate = format(today, 'EEEE، dd MMMM yyyy', { locale: ar });

  // If finance role, show Finance Analytics Dashboard
  if (isFinance) {
    return (
      <div className="min-h-screen bg-background p-6" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Page Header with Date */}
          <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <LayoutDashboard className="h-8 w-8 text-primary" />
              لوحة التحكم
            </h1>
            <p className="text-muted-foreground mt-1">نظرة شاملة على الأداء المالي للمدرسة</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Academic Year Badge */}
            {academicYearName && (
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 dark:bg-primary/20 border border-primary/30 rounded-lg">
                <GraduationCap className="h-4 w-4 text-primary" />
                <div className="text-right">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                    العام الدراسي
                  </p>
                  <p className="text-sm font-bold text-primary">
                    {academicYearName}
                  </p>
                </div>
              </div>
            )}

            {/* Current Date Display */}
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <div className="text-right">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  اليوم
                </p>
                <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                  {arabicDate}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Panel for Finance */}
        <QuickActionsPanel
          loading={loading}
          academicYearId={academicYearId}
          sessionFilter="both"
          userRole="finance"
        />

        {/* Finance Analytics Dashboard */}
        <FinanceAnalyticsDashboard compact={false} hideHeader={true} academicYearId={academicYearId} />
      </div>
    </div>
  );
  }

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header with Date */}
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            لوحة التحكم
          </h1>
          <p className="text-muted-foreground mt-1">
            {isDirector ? 'نظرة شاملة على جميع جوانب المدرسة' :
             isMorningSchool ? 'نظرة شاملة على المدرسة الصباحية' :
             'نظرة شاملة على المدرسة المسائية'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Academic Year Badge */}
          {academicYearName && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 dark:bg-primary/20 border border-primary/30 rounded-lg">
              <GraduationCap className="h-4 w-4 text-primary" />
              <div className="text-right">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                  العام الدراسي
                </p>
                <p className="text-sm font-bold text-primary">
                  {academicYearName}
                </p>
              </div>
            </div>
          )}

          {/* Current Date Display */}
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <div className="text-right">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                اليوم
              </p>
              <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                {arabicDate}
              </p>
            </div>
          </div>
        </div>
        </div>

        {/* Filter Bar - Only show for directors */}
        {isDirector && (
        <DashboardFilterBar
          sessionFilter={sessionFilter}
          periodFilter={periodFilter}
          onSessionChange={handleSessionChange}
          onPeriodChange={setPeriodFilter}
          onRefresh={handleRefresh}
          lastUpdated={lastUpdated}
          sessionFilterDisabled={false}
        />
      )}

      {/* Quick Stats Grid */}
      <QuickStatsGrid
        students={dashboardData.quickStats.students}
        teachers={dashboardData.quickStats.teachers}
        classes={dashboardData.quickStats.classes}
        activities={dashboardData.quickStats.activities}
        sessionFilter={sessionFilter}
        loading={loading}
      />

      {/* Quick Actions - Full Width */}
      <QuickActionsPanel
        loading={loading}
        academicYearId={academicYearId}
        sessionFilter={sessionFilter}
        userRole={userRole}
      />

      {/* History Card - Full Width with fixed height for internal scrolling (Director only) */}
      {isDirector && (
        <div className="h-[500px]">
          <HistoryCard />
        </div>
      )}

      {/* Main Analytics Card - Full Width */}
      <SessionComparisonCard
        morning={dashboardData.sessionData.morning}
        evening={dashboardData.sessionData.evening}
        sessionFilter={sessionFilter}
        distributionData={dashboardData.distribution.by_section}
        genderData={dashboardData.distribution.by_gender}
        transportData={dashboardData.distribution.by_transportation}
        attendanceData={dashboardData.attendance.students}
        loading={loading}
        periodFilter={periodFilter}
        onPeriodChange={setPeriodFilter}
        academicYearName={academicYearName}
      />

      {/* School Grades Chart - Full Width (علامات الطلاب) */}
      <SchoolGradesChart
        academicYearId={academicYearId}
        sessionFilter={sessionFilter}
      />

      {/* Financial Overview - Embed full financial analytics UI (Director only) */}
      {isDirector && (
        <div className="mt-2">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">نظرة مالية شاملة</h2>
            </div>
            <div className="p-4">
              <FinanceAnalyticsDashboard compact hideHeader academicYearId={academicYearId} />
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};