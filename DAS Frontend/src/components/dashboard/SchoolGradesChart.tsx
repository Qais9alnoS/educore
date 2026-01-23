import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LineChart from '@/components/analytics/LineChart';
import { analyticsApi } from '@/services/api';

interface GradeData {
  assignment_type: string;
  assignment_number: number;
  morning_sum: number;
  morning_count: number;
  evening_sum: number;
  evening_count: number;
  subject_name: string;
}

interface SchoolGradesChartProps {
  academicYearId: number;
  sessionFilter: 'morning' | 'evening' | 'both';
}

const SchoolGradesChart: React.FC<SchoolGradesChartProps> = ({
  academicYearId,
  sessionFilter
}) => {
  const [loading, setLoading] = useState(true);
  const [gradesData, setGradesData] = useState<GradeData[]>([]);

  useEffect(() => {
    fetchSchoolGrades();
  }, [academicYearId, sessionFilter]);

  const fetchSchoolGrades = async () => {
    setLoading(true);
    try {
      const response = await analyticsApi.getSchoolGrades(academicYearId);
      const data = response.data as GradeData[] || [];

      setGradesData(data);

    } catch (error) {

      // Set empty data when backend fails
      setGradesData([]);
    } finally {
      setLoading(false);
    }
  };

  // Group data by assignment type and number, then combine all subjects
  const groupedData = gradesData.reduce((acc, item) => {
    const key = `${item.assignment_type}_${item.assignment_number}`;
    if (!acc[key]) {
      acc[key] = {
        assignment_type: item.assignment_type,
        assignment_number: item.assignment_number,
        morning_sum: 0,
        morning_count: 0,
        evening_sum: 0,
        evening_count: 0,
        subjects: []
      };
    }
    acc[key].morning_sum += item.morning_sum;
    acc[key].morning_count += item.morning_count;
    acc[key].evening_sum += item.evening_sum;
    acc[key].evening_count += item.evening_count;
    acc[key].subjects.push(item.subject_name);
    return acc;
  }, {} as Record<string, any>);

  // Calculate overall averages and sort
  const processedGroups = Object.values(groupedData).map((group: any) => ({
    ...group,
    morning_average: group.morning_count > 0 ? Math.round((group.morning_sum / group.morning_count) * 10) / 10 : 0,
    evening_average: group.evening_count > 0 ? Math.round((group.evening_sum / group.evening_count) * 10) / 10 : 0,
    subject_count: group.subjects.length
  })).sort((a: any, b: any) => {
    // Sort by assignment type (مذاكرة first, then امتحان)
    if (a.assignment_type !== b.assignment_type) {
      return a.assignment_type === 'مذاكرة' ? -1 : 1;
    }
    // Then by assignment number
    return a.assignment_number - b.assignment_number;
  });

  // Prepare data for LineChart - fix DataPoint interface
  const chartData = processedGroups.map((group: any) => ({
    name: `${group.assignment_type} ${group.assignment_number}`,
    value: 0 // Placeholder value since we use series data
  }));

  const morningColor = '#F59E0B'; // Amber/Yellow
  const eveningColor = '#3B82F6'; // Blue

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-8 rounded"></div>
            <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-32 rounded"></div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Sun className="h-5 w-5 text-amber-500" />
            <Moon className="h-5 w-5 text-blue-500" />
          </div>
          علامات المدرسة
        </CardTitle>

        <p className="text-sm text-muted-foreground">
          متوسط علامات جميع الطلاب في جميع المواد لكل مذاكرة وامتحان (من 100)
        </p>
      </CardHeader>

      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">لا توجد بيانات علامات متاحة</p>
          </div>
        ) : (
          <div>
            {sessionFilter === 'both' && (
              <LineChart
                data={chartData}
                series={[
                  {
                    name: 'صباحي',
                    data: processedGroups.map(g => Math.round(g.morning_average * 10) / 10),
                    color: morningColor
                  },
                  {
                    name: 'مسائي',
                    data: processedGroups.map(g => Math.round(g.evening_average * 10) / 10),
                    color: eveningColor
                  }
                ]}
                height="400px"
                smooth
                loading={loading}
                yAxisLabel="متوسط العلامات (%)"
              />
            )}

            {sessionFilter === 'morning' && (
              <LineChart
                data={chartData}
                series={[
                  {
                    name: 'صباحي',
                    data: processedGroups.map(g => Math.round(g.morning_average * 10) / 10),
                    color: morningColor
                  }
                ]}
                height="400px"
                smooth
                loading={loading}
                yAxisLabel="متوسط العلامات (%)"
              />
            )}

            {sessionFilter === 'evening' && (
              <LineChart
                data={chartData}
                series={[
                  {
                    name: 'مسائي',
                    data: processedGroups.map(g => Math.round(g.evening_average * 10) / 10),
                    color: eveningColor
                  }
                ]}
                height="400px"
                smooth
                loading={loading}
                yAxisLabel="متوسط العلامات (%)"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SchoolGradesChart;
