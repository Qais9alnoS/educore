import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  MoreVertical
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ScheduleAssignment {
  id: number;
  time_slot_id: number;
  day_of_week: number;
  period_number: number;
  subject_id: number;
  subject_name: string;
  teacher_id: number;
  teacher_name: string;
  room?: string;
  notes?: string;
  has_conflict?: boolean;
  conflict_type?: string;
}

interface WeeklyScheduleGridProps {
  scheduleId?: number;
  data?: {
    classId: number;
    academicYearId: number;
    sessionType: string;
  };
  assignments: ScheduleAssignment[];
  onAssignmentClick?: (assignment: ScheduleAssignment) => void;
  onAssignmentEdit?: (assignment: ScheduleAssignment) => void;
  onAssignmentDelete?: (assignmentId: number) => void;
  onSwapComplete?: () => void;
  readOnly?: boolean;
}

const DAYS = [
  { value: 1, label: 'الأحد', short: 'أحد' },
  { value: 2, label: 'الاثنين', short: 'إثنين' },
  { value: 3, label: 'الثلاثاء', short: 'ثلاثاء' },
  { value: 4, label: 'الأربعاء', short: 'أربعاء' },
  { value: 5, label: 'الخميس', short: 'خميس' }
];

const PERIODS = [
  { number: 1, start: '08:00', end: '08:45' },
  { number: 2, start: '08:50', end: '09:35' },
  { number: 3, start: '09:40', end: '10:25' },
  { number: 4, start: '10:30', end: '11:15' },
  { number: 5, start: '11:20', end: '12:05' },
  { number: 6, start: '12:10', end: '12:55' }
];

export const WeeklyScheduleGrid: React.FC<WeeklyScheduleGridProps> = ({
  scheduleId,
  data,
  assignments,
  onAssignmentClick,
  onAssignmentEdit,
  onAssignmentDelete,
  onSwapComplete,
  readOnly = false
}) => {
  const [selectedCell, setSelectedCell] = useState<ScheduleAssignment | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [draggedAssignment, setDraggedAssignment] = useState<ScheduleAssignment | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [isValidDrop, setIsValidDrop] = useState<boolean>(false);
  const [swapValidityCache, setSwapValidityCache] = useState<Map<string, boolean>>(new Map());
  const [swappingCells, setSwappingCells] = useState<{cell1: string, cell2: string} | null>(null);
  const [localAssignments, setLocalAssignments] = useState<ScheduleAssignment[]>(assignments);
  const viewMode = 'detailed'; // Always use detailed view
  
  // Custom drag state for Tauri compatibility
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{x: number, y: number} | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<{x: number, y: number} | null>(null);
  const [dragThreshold] = useState(5); // pixels to move before drag starts

  // Sync local assignments with props
  useEffect(() => {
    setLocalAssignments(assignments);
  }, [assignments]);

  // Create a grid map for quick lookup (use localAssignments for optimistic updates)
  const gridMap = new Map<string, ScheduleAssignment>();
  localAssignments.forEach(assignment => {
    const key = `${assignment.day_of_week}-${assignment.period_number}`;
    gridMap.set(key, assignment);
  });

  const handleCellClick = (assignment: ScheduleAssignment) => {
    // Only show details in readonly mode, don't allow edit/delete
    if (readOnly) {
      setSelectedCell(assignment);
      setShowDetailsDialog(true);
      onAssignmentClick?.(assignment);
    }
  };

  const handleEdit = () => {
    if (selectedCell) {
      onAssignmentEdit?.(selectedCell);
      setShowDetailsDialog(false);
    }
  };

  const handleDelete = () => {
    if (selectedCell) {
      onAssignmentDelete?.(selectedCell.id);
      setShowDetailsDialog(false);
      setSelectedCell(null);
      toast({
        title: 'تم الحذف',
        description: 'تم حذف الحصة بنجاح'
      });
    }
  };

  // Custom Mouse-based Drag Handlers for Tauri
  const handleMouseDown = (e: React.MouseEvent, assignment: ScheduleAssignment) => {
    if (readOnly || e.button !== 0) return; // Only left click
    
    e.preventDefault();
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDraggedAssignment(assignment);
    setSwapValidityCache(new Map());
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedAssignment || !dragStartPos) return;

    const deltaX = Math.abs(e.clientX - dragStartPos.x);
    const deltaY = Math.abs(e.clientY - dragStartPos.y);

    // Start dragging only after threshold
    if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
      setIsDragging(true);
    }

    if (isDragging) {
      setDragCurrentPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStartPos(null);
    setDragCurrentPos(null);
    setDraggedAssignment(null);
    setDragOverCell(null);
    setIsValidDrop(false);
    setSwapValidityCache(new Map());
  };

  // Add global mouse event listeners
  useEffect(() => {
    if (draggedAssignment) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!dragStartPos) return;

        const deltaX = Math.abs(e.clientX - dragStartPos.x);
        const deltaY = Math.abs(e.clientY - dragStartPos.y);

        if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
          setIsDragging(true);
        }

        if (isDragging) {
          setDragCurrentPos({ x: e.clientX, y: e.clientY });
        }
      };

      const handleGlobalMouseUp = () => {
        handleMouseUp();
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [draggedAssignment, dragStartPos, isDragging, dragThreshold]);

  const handleCellMouseEnter = async (day: number, period: number) => {
    if (readOnly || !draggedAssignment || !isDragging) return;

    const key = `${day}-${period}`;
    const targetAssignment = gridMap.get(key);

    // Can't drop on empty cells or on itself
    if (!targetAssignment || draggedAssignment.id === targetAssignment.id) {
      setDragOverCell(key);
      setIsValidDrop(false);
      return;
    }

    // Check cache first
    const cacheKey = `${draggedAssignment.id}-${targetAssignment.id}`;
    if (swapValidityCache.has(cacheKey)) {
      const isValid = swapValidityCache.get(cacheKey)!;
      setDragOverCell(key);
      setIsValidDrop(isValid);
      return;
    }

    // Set initial state while checking
    setDragOverCell(key);
    setIsValidDrop(false);

    // Call the validation API to check if swap is allowed
    try {
      const { schedulesApi } = await import('@/services/api');
      const result = await schedulesApi.checkSwapValidity(draggedAssignment.id, targetAssignment.id);
      const canSwap = result.success && result.data?.can_swap === true;
      setSwapValidityCache(prev => new Map(prev).set(cacheKey, canSwap));
      setIsValidDrop(canSwap);
    } catch (error) {
      setSwapValidityCache(prev => new Map(prev).set(cacheKey, true));
      setIsValidDrop(true);
    }
  };

  const handleCellMouseLeave = () => {
    if (!isDragging) return;
    setDragOverCell(null);
    setIsValidDrop(false);
  };

  const handleCellMouseUp = async (day: number, period: number) => {
    if (readOnly || !draggedAssignment || !isDragging) return;

    const key = `${day}-${period}`;
    const targetAssignment = gridMap.get(key);

    // Only allow swap if both cells have assignments
    if (!targetAssignment) {
      toast({
        title: 'غير مسموح',
        description: 'لا يمكن التبديل مع خانة فارغة',
        variant: 'destructive'
      });
      handleMouseUp();
      return;
    }

    // Don't swap with itself
    if (draggedAssignment.id === targetAssignment.id) {
      handleMouseUp();
      return;
    }

    // Check if this swap was validated as invalid
    const cacheKey = `${draggedAssignment.id}-${targetAssignment.id}`;
    if (swapValidityCache.has(cacheKey) && !swapValidityCache.get(cacheKey)) {
      handleMouseUp();
      return;
    }

    // Store cell keys for animation
    const draggedKey = `${draggedAssignment.day_of_week}-${draggedAssignment.period_number}`;
    const targetKey = key;

    // Call swap API
    try {
      const { schedulesApi } = await import('@/services/api');
      const result = await schedulesApi.swap(draggedAssignment.id, targetAssignment.id);

      if (result.success) {
        setSwappingCells({ cell1: draggedKey, cell2: targetKey });

        // Optimistically update local state
        setLocalAssignments(prev => {
          return prev.map(a => {
            if (a.id === draggedAssignment.id) {
              return {
                ...a,
                subject_id: targetAssignment.subject_id,
                subject_name: targetAssignment.subject_name,
                teacher_id: targetAssignment.teacher_id,
                teacher_name: targetAssignment.teacher_name,
              };
            }
            if (a.id === targetAssignment.id) {
              return {
                ...a,
                subject_id: draggedAssignment.subject_id,
                subject_name: draggedAssignment.subject_name,
                teacher_id: draggedAssignment.teacher_id,
                teacher_name: draggedAssignment.teacher_name,
              };
            }
            return a;
          });
        });

        setTimeout(() => {
          setSwappingCells(null);
          if (onSwapComplete) {
            onSwapComplete();
          }
        }, 400);
      } else {
        throw new Error(result.message || 'حدث خطأ اثناء تبديل الحصص');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'حدث خطأ اثناء تبديل الحصص';
      toast({
        title: 'خطأ',
        description: errorMsg,
        variant: 'destructive'
      });
    } finally {
      handleMouseUp();
    }
  };


  const renderCell = (day: number, period: number) => {
    const key = `${day}-${period}`;
    const assignment = gridMap.get(key);
    const isDragOver = dragOverCell === key;
    const isDragging = draggedAssignment?.id === assignment?.id;
    const isSwapping = swappingCells && (swappingCells.cell1 === key || swappingCells.cell2 === key);

    if (!assignment) {
      return (
        <div
          onMouseEnter={() => handleCellMouseEnter(day, period)}
          onMouseLeave={handleCellMouseLeave}
          onMouseUp={() => handleCellMouseUp(day, period)}
          className={cn(
            "h-full min-h-[90px] p-3 border border-dashed border-gray-200 dark:border-slate-600/50 rounded-lg bg-gray-50 dark:bg-slate-800/30 hover:bg-gray-100 dark:hover:bg-slate-700/40 transition-colors flex items-center justify-center select-none",
            isDragOver && !isValidDrop && "bg-red-100 dark:bg-red-900/40 border-red-400 dark:border-red-600 animate-pulse"
          )}
          style={{
            pointerEvents: 'auto',
            touchAction: 'none'
          }}
        >
          <span className="text-xs text-gray-400 dark:text-slate-400">فارغ</span>
        </div>
      );
    }

    const hasConflict = assignment.has_conflict;

    const isThisCellDragging = draggedAssignment?.id === assignment?.id && isDragging;

    return (
      <div
        onMouseDown={(e) => handleMouseDown(e, assignment)}
        onMouseEnter={() => handleCellMouseEnter(day, period)}
        onMouseLeave={handleCellMouseLeave}
        onMouseUp={() => handleCellMouseUp(day, period)}
        className={cn(
          "h-full min-h-[90px] p-3 rounded-lg transition-all cursor-move group relative select-none",
          hasConflict
            ? "bg-red-50 dark:bg-red-950 border-2 border-red-300 dark:border-red-700"
            : "bg-blue-50 dark:bg-slate-800/90 border border-blue-200 dark:border-slate-600/50",
          !readOnly && !isSwapping && "hover:opacity-80 active:scale-95",
          isThisCellDragging && "opacity-30 scale-95",
          isDragOver && isValidDrop && "animate-wiggle border-green-500 dark:border-emerald-400 border-2 bg-green-50 dark:bg-slate-700/80",
          isDragOver && !isValidDrop && "border-red-500 dark:border-red-400 border-2 bg-red-50 dark:bg-slate-800",
          isSwapping && "animate-swap-pulse ring-2 ring-emerald-500 dark:ring-emerald-400 ring-offset-2 dark:ring-offset-slate-900"
        )}
        style={{
          animation: isDragOver && isValidDrop
            ? 'wiggle 0.5s ease-in-out infinite'
            : isSwapping
              ? 'swapPulse 0.4s ease-in-out'
              : undefined,
          transition: 'all 0.3s ease-in-out',
          pointerEvents: 'auto',
          touchAction: 'none'
        }}
      >
        {/* Conflict Indicator */}
        {hasConflict && (
          <div className="absolute -top-1 -right-1">
            <div className="bg-red-500 text-white rounded-full p-1">
              <AlertTriangle className="h-3 w-3" />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="space-y-2">
          {/* Subject Name */}
          <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-1">
            {assignment.subject_name}
          </div>

          {/* Teacher Name */}
          {viewMode === 'detailed' && (
            <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="line-clamp-1">{assignment.teacher_name}</span>
            </div>
          )}

          {/* Room (if exists) */}
          {viewMode === 'detailed' && assignment.room && (
            <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span>{assignment.room}</span>
            </div>
          )}

          {/* Status Badge */}
          <div className="flex items-center gap-1 mt-2">
            {hasConflict ? (
              <Badge variant="destructive" className="text-[10px] py-0 h-4">
                تعارض
              </Badge>
            ) : (
              <Badge className="bg-green-500 text-white text-[10px] py-0 h-4">
                <CheckCircle2 className="h-2 w-2 ml-1" />
                صحيح
              </Badge>
            )}
          </div>
        </div>

      </div>
    );
  };

  return (
    <div className="space-y-4" dir="rtl" onMouseMove={handleMouseMove}>
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">الجدول الأسبوعي</h3>
        </div>
      </div>

      {/* Schedule Grid - Columns: Periods, Rows: Days */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-blue-500 dark:bg-gradient-to-r dark:from-slate-800 dark:to-slate-700">
                  <th className="p-3 text-white font-semibold text-sm border-b border-gray-200 dark:border-slate-600/50 min-w-[100px]">
                    <div className="flex items-center justify-center gap-2">
                      <Calendar className="h-4 w-4" />
                      اليوم
                    </div>
                  </th>
                  {PERIODS.map((period) => (
                    <th
                      key={period.number}
                      className="p-3 text-white font-semibold text-sm border-b border-gray-200 dark:border-slate-600/50 last:border-l-0"
                    >
                      <div className="text-center">
                        <div>الحصة {period.number}</div>
                        <div className="text-xs font-normal mt-1 opacity-90">
                          {period.start} - {period.end}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, dayIndex) => (
                  <tr
                    key={day.value}
                    className="border-b border-gray-200 dark:border-slate-700/50 last:border-b-0"
                  >
                    {/* Day Column */}
                    <td className="p-3 border-l border-gray-200 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/50">
                      <div className="text-center">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {day.label}
                        </div>
                      </div>
                    </td>

                    {/* Period Cells */}
                    {PERIODS.map((period) => (
                      <td
                        key={period.number}
                        className="p-2.5 border-l border-gray-200 dark:border-slate-700/50 last:border-l-0 dark:bg-slate-900/20"
                      >
                        {renderCell(day.value, period.number)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Footer */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 border-blue-200 dark:border-slate-700/50">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-900 dark:text-gray-100">
                {assignments.length}
              </div>
              <div className="text-xs text-blue-600 dark:text-gray-400">إجمالي الحصص</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-900 dark:text-gray-100">
                {assignments.filter(a => !a.has_conflict).length}
              </div>
              <div className="text-xs text-green-600 dark:text-gray-400">حصص صحيحة</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-900 dark:text-gray-100">
                {assignments.filter(a => a.has_conflict).length}
              </div>
              <div className="text-xs text-red-600 dark:text-gray-400">تعارضات</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-900 dark:text-gray-100">
                {new Set(assignments.map(a => a.teacher_id)).size}
              </div>
              <div className="text-xs text-purple-600 dark:text-gray-400">معلمين</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dragging Ghost Element */}
      {isDragging && draggedAssignment && dragCurrentPos && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: dragCurrentPos.x - 75,
            top: dragCurrentPos.y - 30
          }}
        >
          <div className="bg-blue-500 dark:bg-slate-700 text-white p-3 rounded-lg shadow-2xl border-2 border-blue-600 dark:border-slate-500 min-w-[150px] opacity-90 scale-110">
            <div className="font-semibold text-sm">{draggedAssignment.subject_name}</div>
            <div className="text-xs mt-1 opacity-90">{draggedAssignment.teacher_name}</div>
          </div>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل الحصة</DialogTitle>
          </DialogHeader>
          {selectedCell && (
            <div className="space-y-4">
              {/* Subject */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600 mb-1">المادة</div>
                <div className="text-lg font-semibold text-blue-900">
                  {selectedCell.subject_name}
                </div>
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">اليوم</div>
                  <div className="font-medium">
                    {DAYS.find(d => d.value === selectedCell.day_of_week)?.label}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">الحصة</div>
                  <div className="font-medium">
                    الحصة {selectedCell.period_number}
                  </div>
                </div>
              </div>

              {/* Teacher */}
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-green-600 mb-1 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  المعلم
                </div>
                <div className="text-lg font-semibold text-green-900">
                  {selectedCell.teacher_name}
                </div>
              </div>

              {/* Room */}
              {selectedCell.room && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="text-sm text-purple-600 mb-1 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    القاعة
                  </div>
                  <div className="font-medium text-purple-900">{selectedCell.room}</div>
                </div>
              )}

              {/* Notes */}
              {selectedCell.notes && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="text-sm text-yellow-600 mb-1">ملاحظات</div>
                  <div className="text-sm text-yellow-900">{selectedCell.notes}</div>
                </div>
              )}

              {/* Conflict Warning */}
              {selectedCell.has_conflict && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                    <AlertTriangle className="h-5 w-5" />
                    تحذير: يوجد تعارض
                  </div>
                  <div className="text-sm text-red-600">
                    {selectedCell.conflict_type || 'تعارض في الجدول'}
                  </div>
                </div>
              )}

              {/* Actions */}
              {!readOnly && (
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleEdit} className="flex-1">
                    <Edit2 className="h-4 w-4 ml-2" />
                    تعديل
                  </Button>
                  <Button
                    onClick={handleDelete}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 ml-2" />
                    حذف
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

