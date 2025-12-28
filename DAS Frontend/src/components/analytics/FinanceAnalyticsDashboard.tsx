import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import BarChart from './BarChart';
import PieChart from './PieChart';
import { financeManagerApi } from '../../services/api';
import { FinanceManagerDashboard } from '@/types/school';

type PeriodType = 'weekly' | 'monthly' | 'yearly';

interface FinanceAnalyticsDashboardProps {
  compact?: boolean;
  hideHeader?: boolean;
  academicYearId?: number; // Optional prop to pass academic year from parent
}

const FinanceAnalyticsDashboard: React.FC<FinanceAnalyticsDashboardProps> = ({
  compact = false,
  hideHeader = false,
  academicYearId: propAcademicYearId
}) => {
  const [period, setPeriod] = useState<PeriodType>('monthly');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<FinanceManagerDashboard | null>(null);
  const [academicYear, setAcademicYear] = useState<number | null>(null);
  const [chartData, setChartData] = useState<{categories: string[], incomeData: number[], expenseData: number[]}>({categories: [], incomeData: [], expenseData: []});
  const [incomeCompletion, setIncomeCompletion] = useState<{completed_income: number, incomplete_income: number}>({completed_income: 0, incomplete_income: 0});

  // Load selected academic year from prop or localStorage on mount
  useEffect(() => {
    if (propAcademicYearId) {
      // If passed as prop, use it (this ensures sync with parent DashboardPage)
      setAcademicYear(propAcademicYearId);
    } else {
      // Otherwise read from localStorage
      const storedYearId = localStorage.getItem('selected_academic_year_id');
      if (storedYearId) {
        const yearId = parseInt(storedYearId);
        setAcademicYear(yearId);
      }
    }
  }, [propAcademicYearId]);

  // Listen for changes in academic year selection within the app
  // We rely on the custom `academicYearChanged` event dispatched in AcademicYearManagementPage/App
  // Only listen if not receiving prop (to avoid conflicts)
  useEffect(() => {
    if (propAcademicYearId) {
      // If using prop, don't listen to events (prop will update)
      return;
    }

    const handleAcademicYearChanged = () => {
      const storedYearId = localStorage.getItem('selected_academic_year_id');
      if (storedYearId) {
        const yearId = parseInt(storedYearId);
        setAcademicYear(yearId);
      }
    };

    window.addEventListener('academicYearChanged', handleAcademicYearChanged);
    return () => {
      window.removeEventListener('academicYearChanged', handleAcademicYearChanged);
    };
  }, [propAcademicYearId]);

  useEffect(() => {
    if (academicYear) {
      fetchFinancialData();
    }
  }, [academicYear]);

  useEffect(() => {
    if (academicYear) {
      fetchChartData();
      fetchIncomeCompletionData();
    }
  }, [period, academicYear]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const response = await financeManagerApi.getDashboard(academicYear);
      setDashboard(response.data);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      // For weekly/monthly, restrict to the currently selected academic year.
      // For yearly ("سنوات"), fetch data across all academic years.
      const academicYearForRequest = period === 'yearly' ? null : academicYear;
      console.log('[FinanceAnalytics] Fetching chart data:', { period, academicYear, academicYearForRequest });
      
      const response = await financeManagerApi.getTransactionsByPeriod(academicYearForRequest, period);
      console.log('[FinanceAnalytics] Chart data response:', response.data);
      
      setChartData({
        categories: response.data.periods || [],
        incomeData: response.data.income_data || [],
        expenseData: response.data.expense_data || []
      });
    } catch (error) {
      console.error('[FinanceAnalytics] Error fetching chart data:', error);
      setChartData({categories: [], incomeData: [], expenseData: []});
    }
  };

  const fetchIncomeCompletionData = async () => {
    try {
      const response = await financeManagerApi.getIncomeCompletionStats(academicYear);
      setIncomeCompletion(response.data);
    } catch (error) {

      setIncomeCompletion({completed_income: 0, incomplete_income: 0});
    }
  };

  // Chart data is now fetched from backend with real transaction dates

  const netProfit = Number(dashboard?.net_profit || 0);
  const totalIncome = Number(dashboard?.summary?.total_income || 0);
  const totalExpenses = Number(dashboard?.summary?.total_expenses || 0);

  return (
    <div className={compact ? 'space-y-6' : 'container mx-auto p-6 space-y-6'}>
      {/* Header */}
      {!hideHeader && (
        <div>
          <h1 className="text-3xl font-bold text-foreground">التحليلات المالية</h1>
          <p className="text-muted-foreground mt-1">نظرة شاملة على الأداء المالي للمدرسة</p>
        </div>
      )}

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* الإيرادات */}
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500">
          <CardContent className="p-6">
            <div className="absolute top-4 left-4">
              <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="text-right mt-2">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">الإيرادات</p>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-1"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
              ) : (
                <>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                    {totalIncome.toLocaleString('ar-SY')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">ل.س</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* المصروفات */}
        <Card className="relative overflow-hidden border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="absolute top-4 left-4">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/40">
                <Wallet className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="text-right mt-2">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">المصروفات</p>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-1"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
              ) : (
                <>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                    {totalExpenses.toLocaleString('ar-SY')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">ل.س</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* صافي الربح */}
        <Card className={`relative overflow-hidden border-l-4 ${netProfit >= 0 ? 'border-l-blue-500' : 'border-l-amber-500'}`}>
          <CardContent className="p-6">
            <div className="absolute top-4 left-4">
              <div className={`p-3 rounded-lg ${netProfit >= 0 ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-amber-100 dark:bg-amber-900/40'}`}>
                {netProfit >= 0 ? (
                  <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                )}
              </div>
            </div>
            <div className="text-right mt-2">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">صافي الربح</p>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-1"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
              ) : (
                <>
                  <p className={`text-3xl font-bold mb-1 ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {netProfit.toLocaleString('ar-SY')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">ل.س</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid - 2 columns equal size */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart Section */}
        <Card className="h-full">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>الإيرادات والمصروفات</CardTitle>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">مدة زمنية</span>
              <div className="inline-flex rounded-full border border-border bg-muted/40 p-1">
                {(
                  [
                    { value: 'weekly', label: 'أسابيع' },
                    { value: 'monthly', label: 'أشهر' },
                    { value: 'yearly', label: 'سنوات' }
                  ] as { value: PeriodType; label: string }[]
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPeriod(value)}
                    className={`min-w-[70px] rounded-full px-4 py-1 text-sm font-medium transition-colors ${
                      period === value
                        ? 'bg-primary text-primary-foreground shadow'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              data={chartData.categories.map((name, index) => ({ name, value: 0 }))}
              series={[
                {
                  name: 'الإيرادات',
                  data: chartData.incomeData,
                  color: '#10b981'
                },
                {
                  name: 'المصروفات',
                  data: chartData.expenseData,
                  color: '#ef4444'
                }
              ]}
              categories={chartData.categories}
              height="550px"
              loading={loading}
              showLegend={true}
            />
          </CardContent>
        </Card>

        {/* Income Completion Donut Chart */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle>حالة الأرباح</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart
              data={[
                { name: 'أرباح مكتملة', value: incomeCompletion.completed_income },
                { name: 'ديون مستحقة', value: incomeCompletion.incomplete_income }
              ]}
              colors={['#3B82F6', '#F59E0B']}
              height="550px"
              donut
              loading={loading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FinanceAnalyticsDashboard;
