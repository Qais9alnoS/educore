import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  User,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  BookOpen,
  Filter,
  RefreshCw
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TeacherAvailabilityPanelProps {
  academicYearId: number;
  sessionType: string;
  classId?: number;
  onTeacherSelect?: (teacher: Teacher) => void;
}

interface Teacher {
  id: number;
  full_name: string;
  specialization: string;
  free_time_slots: TimeSlot[];
  assigned_subjects: string[];
  total_weekly_periods: number;
  available_periods: number;
  assigned_periods: number;
}

interface TimeSlot {
  day: number;
  period: number;
  is_free: boolean;
  assigned_to?: {
    subject_name: string;
    class_name: string;
  };
}

const DAYS = [
  { value: 1, label: 'الأحد' },
  { value: 2, label: 'الاثنين' },
  { value: 3, label: 'الثلاثاء' },
  { value: 4, label: 'الأربعاء' },
  { value: 5, label: 'الخميس' }
];

const PERIODS = [1, 2, 3, 4, 5, 6];

const AVAILABILITY_COLORS = {
  free: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800', label: 'فارغ' },
  busy: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800', label: 'مشغول' },
  partial: { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800', label: 'جزئي' }
};

export const TeacherAvailabilityPanel: React.FC<TeacherAvailabilityPanelProps> = ({
  academicYearId,
  sessionType,
  classId,
  onTeacherSelect
}) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'busy'>('all');

  useEffect(() => {
    loadTeachers();
  }, [academicYearId, sessionType]);

  useEffect(() => {
    filterTeachersList();
  }, [searchQuery, teachers, filterMode]);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/teachers/availability?` +
        `academic_year_id=${academicYearId}&` +
        `session_type=${sessionType}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('das_token')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTeachers(data);
      } else {
        throw new Error('فشل تحميل بيانات المعلمين');
      }
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filterTeachersList = () => {
    let filtered = teachers;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.specialization?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Availability filter
    if (filterMode === 'available') {
      filtered = filtered.filter(t => t.available_periods > 0);
    } else if (filterMode === 'busy') {
      filtered = filtered.filter(t => t.available_periods === 0);
    }

    setFilteredTeachers(filtered);
  };

  const getAvailabilityStatus = (teacher: Teacher): 'free' | 'busy' | 'partial' => {
    const utilizationRate = teacher.total_weekly_periods > 0
      ? teacher.assigned_periods / teacher.total_weekly_periods
      : 0;

    if (utilizationRate === 0) return 'free';
    if (utilizationRate >= 0.9) return 'busy';
    return 'partial';
  };

  const getTimeSlotStatus = (teacher: Teacher, day: number, period: number): TimeSlot | null => {
    return teacher.free_time_slots.find(slot => slot.day === day && slot.period === period) || null;
  };

  const handleTeacherClick = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setShowDetailsDialog(true);
    onTeacherSelect?.(teacher);
  };

  const renderTeacherGrid = (teacher: Teacher) => {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-6 gap-1">
          {/* Header row with period numbers */}
          <div className="text-xs font-medium text-gray-600 text-center">الحصة</div>
          {PERIODS.map(period => (
            <div key={period} className="text-xs font-medium text-gray-600 text-center">
              {period}
            </div>
          ))}
        </div>

        {/* Rows for each day */}
        {DAYS.map(day => (
          <div key={day.value} className="grid grid-cols-6 gap-1">
            {/* Day label */}
            <div className="text-xs font-medium text-gray-600 flex items-center">
              {day.label.substring(0, 3)}
            </div>

            {/* Time slots */}
            {PERIODS.map(period => {
              const slot = getTimeSlotStatus(teacher, day.value, period);
              const isFree = slot?.is_free !== false;
              const color = isFree ? AVAILABILITY_COLORS.free : AVAILABILITY_COLORS.busy;

              return (
                <TooltipProvider key={period}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "h-6 rounded border cursor-pointer transition-colors",
                          color.bg,
                          color.border
                        )}
                      >
                        {!isFree && slot?.assigned_to && (
                          <div className="h-full flex items-center justify-center">
                            <BookOpen className="h-3 w-3 text-red-600" />
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-1">
                        <p className="font-medium">{day.label} - الحصة {period}</p>
                        {isFree ? (
                          <p className="text-green-600">فارغ</p>
                        ) : (
                          <>
                            <p className="text-red-600">مشغول</p>
                            {slot?.assigned_to && (
                              <>
                                <p>المادة: {slot.assigned_to.subject_name}</p>
                                <p>الصف: {slot.assigned_to.class_name}</p>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderTeacherCard = (teacher: Teacher) => {
    const status = getAvailabilityStatus(teacher);
    const statusConfig = AVAILABILITY_COLORS[status];

    return (
      <Card
        key={teacher.id}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => handleTeacherClick(teacher)}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Teacher Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-full", statusConfig.bg)}>
                  <User className={cn("h-5 w-5", statusConfig.text)} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{teacher.full_name}</h4>
                  <p className="text-sm text-gray-600">{teacher.specialization || 'غير محدد'}</p>
                </div>
              </div>
              <Badge className={cn(statusConfig.bg, statusConfig.text, statusConfig.border)}>
                {statusConfig.label}
              </Badge>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="p-2 bg-blue-50 rounded">
                <div className="font-bold text-blue-900">{teacher.total_weekly_periods}</div>
                <div className="text-xs text-blue-600">إجمالي</div>
              </div>
              <div className="p-2 bg-green-50 rounded">
                <div className="font-bold text-green-900">{teacher.available_periods}</div>
                <div className="text-xs text-green-600">متاح</div>
              </div>
              <div className="p-2 bg-red-50 rounded">
                <div className="font-bold text-red-900">{teacher.assigned_periods}</div>
                <div className="text-xs text-red-600">مشغول</div>
              </div>
            </div>

            {/* Availability Grid */}
            {renderTeacherGrid(teacher)}

            {/* Assigned Subjects */}
            {teacher.assigned_subjects && teacher.assigned_subjects.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-600 mb-1">المواد المعينة:</p>
                <div className="flex flex-wrap gap-1">
                  {teacher.assigned_subjects.map((subject, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {subject}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل بيانات المعلمين...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              توفر المعلمين
            </CardTitle>
            <Button size="sm" variant="outline" onClick={loadTeachers}>
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="بحث عن معلم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={filterMode === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterMode('all')}
              >
                الكل ({teachers.length})
              </Button>
              <Button
                size="sm"
                variant={filterMode === 'available' ? 'default' : 'outline'}
                onClick={() => setFilterMode('available')}
                className={filterMode === 'available' ? 'bg-green-600' : ''}
              >
                متاحين ({teachers.filter(t => t.available_periods > 0).length})
              </Button>
              <Button
                size="sm"
                variant={filterMode === 'busy' ? 'default' : 'outline'}
                onClick={() => setFilterMode('busy')}
                className={filterMode === 'busy' ? 'bg-red-600' : ''}
              >
                مشغولين ({teachers.filter(t => t.available_periods === 0).length})
              </Button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm">
            <span className="font-medium text-gray-700">المؤشرات:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span className="text-gray-600">فارغ</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
              <span className="text-gray-600">مشغول</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
              <span className="text-gray-600">جزئي</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teachers List */}
      <div className="h-[600px] overflow-y-auto">
        {filteredTeachers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700">لا توجد نتائج</p>
              <p className="text-sm text-gray-500 mt-1">
                {searchQuery
                  ? 'لم يتم العثور على معلمين بهذا الاسم'
                  : 'لا يوجد معلمون مسجلون'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeachers.map(renderTeacherCard)}
          </div>
        )}
      </div>

      {/* Teacher Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="sm:max-w-[700px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              تفاصيل توفر المعلم
            </DialogTitle>
          </DialogHeader>
          {selectedTeacher && (
            <div className="space-y-4">
              {/* Teacher Info */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900">{selectedTeacher.full_name}</h3>
                <p className="text-sm text-blue-600">{selectedTeacher.specialization}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-blue-900">
                      {selectedTeacher.total_weekly_periods}
                    </div>
                    <div className="text-xs text-blue-600">إجمالي الحصص</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-green-900">
                      {selectedTeacher.available_periods}
                    </div>
                    <div className="text-xs text-green-600">حصص متاحة</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-red-900">
                      {selectedTeacher.assigned_periods}
                    </div>
                    <div className="text-xs text-red-600">حصص مشغولة</div>
                  </CardContent>
                </Card>
              </div>

              {/* Full Week Grid */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">الجدول الأسبوعي</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderTeacherGrid(selectedTeacher)}
                </CardContent>
              </Card>

              {/* Assigned Subjects */}
              {selectedTeacher.assigned_subjects && selectedTeacher.assigned_subjects.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">المواد المعينة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedTeacher.assigned_subjects.map((subject, index) => (
                        <Badge key={index} variant="secondary">
                          <BookOpen className="h-3 w-3 ml-1" />
                          {subject}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

