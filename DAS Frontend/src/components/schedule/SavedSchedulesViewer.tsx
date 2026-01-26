import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  Calendar,
  Trash2,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { schedulesApi, classesApi, subjectsApi, teachersApi } from '@/services/api';
import { WeeklyScheduleGrid } from './WeeklyScheduleGrid';
import { ScheduleExporter } from './ScheduleExporter';

interface SavedSchedule {
  id: number;
  academic_year_id: number;
  session_type: string;
  class_id: number;
  section: string;
  name?: string;
  status: string;
  created_at: string;
  total_periods?: number;
}

interface SavedSchedulesViewerProps {
  academicYearId?: number;
  sessionType?: 'morning' | 'evening';
  preselectedScheduleId?: number;
}

export const SavedSchedulesViewer: React.FC<SavedSchedulesViewerProps> = ({
  academicYearId,
  sessionType,
  preselectedScheduleId
}) => {
  const [schedules, setSchedules] = useState<SavedSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<SavedSchedule | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [scheduleAssignments, setScheduleAssignments] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<SavedSchedule | null>(null);
  const [showExporter, setShowExporter] = useState(false);
  const [scheduleToExport, setScheduleToExport] = useState<SavedSchedule | null>(null);

  // Fetch saved schedules
  useEffect(() => {
    fetchSchedules();
  }, [academicYearId, sessionType]);

  // Auto-open preselected schedule
  useEffect(() => {
    if (preselectedScheduleId && schedules.length > 0) {

      const schedule = schedules.find(s => s.id === preselectedScheduleId);
      if (schedule) {

        handleViewSchedule(schedule);

        // Clear navigation state to prevent re-triggering
        window.history.replaceState({}, document.title);
      } else {

      }
    }
  }, [preselectedScheduleId, schedules]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (academicYearId) {
        filters.academic_year_id = academicYearId;
      }
      if (sessionType) {
        filters.session_type = sessionType;
      }

      const response = await schedulesApi.getAll(filters);

      if (response.success && response.data) {
        // Group schedules by class and section
        const groupedSchedules = new Map<string, SavedSchedule>();

        response.data.forEach((schedule: any) => {
          const key = `${schedule.class_id}-${schedule.section}`;
          if (!groupedSchedules.has(key)) {
            groupedSchedules.set(key, {
              id: schedule.id,
              academic_year_id: schedule.academic_year_id,
              session_type: schedule.session_type,
              class_id: schedule.class_id,
              section: schedule.section,
              name: schedule.name,
              status: schedule.status || 'published',
              created_at: schedule.created_at,
              total_periods: 1
            });
          } else {
            const existing = groupedSchedules.get(key)!;
            existing.total_periods = (existing.total_periods || 0) + 1;
          }
        });

        setSchedules(Array.from(groupedSchedules.values()));
      }
    } catch (error: any) {

      toast({
        title: "خطأ في تحميل الجداول",
        description: error.message || "حدث خطأ أثناء تحميل الجداول المحفوظة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportSchedule = (schedule: SavedSchedule) => {
    setScheduleToExport(schedule);
    setShowExporter(true);
  };

  const handleViewSchedule = async (schedule: SavedSchedule) => {
    setSelectedSchedule(schedule);
    setLoadingDetails(true);
    setShowViewer(true);

    try {
      // Fetch schedule details
      const schedulesResponse = await schedulesApi.getAll({
        academic_year_id: schedule.academic_year_id,
        session_type: schedule.session_type,
        class_id: schedule.class_id
      });

      if (schedulesResponse.success && schedulesResponse.data) {
        const schedules = schedulesResponse.data.filter(
          (s: any) => s.section === schedule.section
        );

        // Fetch subjects and teachers for mapping
        const subjectsResponse = await subjectsApi.getAll();
        const teachersResponse = await teachersApi.getAll();

        const subjectsMap = new Map();
        const teachersMap = new Map();

        if (subjectsResponse.success && subjectsResponse.data) {
          subjectsResponse.data.forEach((s: any) =>
            subjectsMap.set(s.id, s.subject_name)
          );
        }

        if (teachersResponse.success && teachersResponse.data) {
          teachersResponse.data.forEach((t: any) =>
            teachersMap.set(t.id, t.full_name)
          );
        }

        // Transform to assignments
        const assignments = schedules.map((s: any) => ({
          id: s.id,
          time_slot_id: s.id,
          day_of_week: s.day_of_week,
          period_number: s.period_number,
          subject_id: s.subject_id,
          subject_name: subjectsMap.get(s.subject_id) || 'مادة غير محددة',
          teacher_id: s.teacher_id,
          teacher_name: teachersMap.get(s.teacher_id) || 'معلم غير محدد',
          room: s.room,
          notes: s.notes,
          has_conflict: false
        }));

        setScheduleAssignments(assignments);
      }
    } catch (error: any) {

      toast({
        title: "خطأ في عرض الجدول",
        description: error.message || "حدث خطأ أثناء عرض تفاصيل الجدول",
        variant: "destructive"
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  // Silent refresh without loading indicator (for swap animation)
  const handleSwapComplete = async () => {
    if (!selectedSchedule) return;

    try {
      // Fetch schedule details silently (no loading state)
      const schedulesResponse = await schedulesApi.getAll({
        academic_year_id: selectedSchedule.academic_year_id,
        session_type: selectedSchedule.session_type,
        class_id: selectedSchedule.class_id
      });

      if (schedulesResponse.success && schedulesResponse.data) {
        const schedules = schedulesResponse.data.filter(
          (s: any) => s.section === selectedSchedule.section
        );

        // Fetch subjects and teachers for mapping
        const subjectsResponse = await subjectsApi.getAll();
        const teachersResponse = await teachersApi.getAll();

        const subjectsMap = new Map();
        const teachersMap = new Map();

        if (subjectsResponse.success && subjectsResponse.data) {
          subjectsResponse.data.forEach((s: any) =>
            subjectsMap.set(s.id, s.subject_name)
          );
        }

        if (teachersResponse.success && teachersResponse.data) {
          teachersResponse.data.forEach((t: any) =>
            teachersMap.set(t.id, t.full_name)
          );
        }

        // Transform to assignments
        const assignments = schedules.map((s: any) => ({
          id: s.id,
          time_slot_id: s.id,
          day_of_week: s.day_of_week,
          period_number: s.period_number,
          subject_id: s.subject_id,
          subject_name: subjectsMap.get(s.subject_id) || 'مادة غير محددة',
          teacher_id: s.teacher_id,
          teacher_name: teachersMap.get(s.teacher_id) || 'معلم غير محدد',
          room: s.room,
          notes: s.notes,
          has_conflict: false
        }));

        setScheduleAssignments(assignments);
      }
    } catch (error: any) {

      // Silent fail - the optimistic update already shows the correct data
    }
  };

  const handleDeleteSchedule = async (schedule: SavedSchedule) => {
    setScheduleToDelete(schedule);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!scheduleToDelete) return;

    try {
      // Use the new specific delete endpoint with teacher availability restoration
      const response = await schedulesApi.deleteClassSchedule({
        academic_year_id: scheduleToDelete.academic_year_id,
        session_type: scheduleToDelete.session_type,
        class_id: scheduleToDelete.class_id,
        section: scheduleToDelete.section
      });

      if (response.success) {
        const teachersRestored = response.data?.restored_teachers || [];
        const restoredInfo = teachersRestored.length > 0
          ? ` (تم استعادة أوقات فراغ ${teachersRestored.length} معلمين)`
          : '';

        toast({
          title: "تم الحذف بنجاح",
          description: `تم حذف الجدول بنجاح (${response.data?.deleted_count || 0} حصة)${restoredInfo}`
        });

        fetchSchedules();
      }
    } catch (error: any) {
      toast({
        title: "خطأ في الحذف",
        description: error.message || "حدث خطأ أثناء حذف الجدول",
        variant: "destructive"
      });
    } finally {
      setDeleteConfirmOpen(false);
      setScheduleToDelete(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 ml-1" />منشور</Badge>;
      case 'draft':
        return <Badge variant="secondary"><Clock className="h-3 w-3 ml-1" />مسودة</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <FileText className="h-16 w-16 mx-auto text-gray-300" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">لا توجد جداول محفوظة</h3>
              <p className="text-sm text-muted-foreground mt-2">
                قم بإنشاء جدول جديد من تبويب "إنشاء جدول جديد"
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              الجداول المحفوظة ({schedules.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto" dir="rtl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right min-w-[100px]">الصف</TableHead>
                  <TableHead className="text-right min-w-[80px]">الشعبة</TableHead>
                  <TableHead className="text-right min-w-[100px]">الفترة</TableHead>
                  <TableHead className="text-right min-w-[120px]">تاريخ الإنشاء</TableHead>
                  <TableHead className="text-right min-w-[120px]">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow 
                    key={`${schedule.class_id}-${schedule.section}`}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewSchedule(schedule)}
                  >
                    <TableCell className="font-medium text-right">
                      الصف {schedule.class_id}
                    </TableCell>
                    <TableCell className="text-right">{schedule.section}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">
                        {schedule.session_type === 'morning' ? 'صباحي' : 'مسائي'}
                      </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(schedule.created_at).toLocaleDateString('ar-SA')}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                        onClick={() => handleExportSchedule(schedule)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => handleDeleteSchedule(schedule)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Viewer Dialog */}
      <Dialog open={showViewer} onOpenChange={setShowViewer}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="pr-12">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              عرض الجدول - الصف {selectedSchedule?.class_id} شعبة {selectedSchedule?.section}
            </DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <WeeklyScheduleGrid
              scheduleId={selectedSchedule?.id}
              data={{
                classId: selectedSchedule?.class_id || 0,
                academicYearId: selectedSchedule?.academic_year_id || 0,
                sessionType: selectedSchedule?.session_type || 'morning'
              }}
              assignments={scheduleAssignments}
              onSwapComplete={handleSwapComplete}
              readOnly={false}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="حذف الجدول"
        description="هل أنت متأكد من حذف هذا الجدول؟"
        confirmText="حذف"
        cancelText="إلغاء"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      {/* Export Dialog */}
      {showExporter && scheduleToExport && (
        <ScheduleExporter
          open={showExporter}
          onOpenChange={setShowExporter}
          scheduleId={scheduleToExport.id}
          scheduleName={`جدول الصف ${scheduleToExport.class_id} شعبة ${scheduleToExport.section}`}
        />
      )}
    </>
  );
};

