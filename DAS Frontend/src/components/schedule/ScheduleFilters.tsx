import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { classesApi, schedulesApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Class } from '@/types/school';

interface ScheduleFiltersProps {
  onComplete: (data: {
    academicYearId: number;
    sessionType: string;
    gradeLevel: string;
    gradeNumber: number;
    classId: number;
    section: string;
  }) => void;
  onExistingScheduleChange?: (hasExisting: boolean, replaceConfirmed: boolean) => void;
}

const GRADE_LEVELS = {
  primary: { label: 'ابتدائي', grades: [1, 2, 3, 4, 5, 6] },
  intermediate: { label: 'متوسط', grades: [1, 2, 3] },
  secondary: { label: 'ثانوي', grades: [1, 2, 3] }
};

const SESSIONS = [
  { value: 'morning', label: 'صباحي' },
  { value: 'evening', label: 'مسائي' }
];

export const ScheduleFilters: React.FC<ScheduleFiltersProps> = ({ onComplete, onExistingScheduleChange }) => {
  // Get user info from AuthContext
  const { state } = useAuth();
  const userRole = (state.user?.role as string) || '';

  // State
  const [academicYearId, setAcademicYearId] = useState<number | null>(null);
  const [sessionType, setSessionType] = useState<string>('');
  const [gradeLevel, setGradeLevel] = useState<string>('');
  const [gradeNumber, setGradeNumber] = useState<number | null>(null);
  const [section, setSection] = useState<string>('');
  const [classId, setClassId] = useState<number | null>(null);

  // Data
  const [classes, setClasses] = useState<Class[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Existing schedule detection
  const [hasExistingSchedule, setHasExistingSchedule] = useState(false);
  const [existingScheduleInfo, setExistingScheduleInfo] = useState<{ totalPeriods: number } | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [isDeletingSchedule, setIsDeletingSchedule] = useState(false);

  // Validation
  const [isValid, setIsValid] = useState(false);
  const [autoCompleted, setAutoCompleted] = useState(false);

  // Load academic year on mount
  useEffect(() => {
    loadSelectedAcademicYear();
  }, []);

  // Auto-set session type based on user role
  useEffect(() => {
    if (!userRole) return;

    // Morning supervisors: auto-set to morning
    if (userRole === 'morning_supervisor' || userRole === 'morning_school') {
      setSessionType('morning');
    }
    // Evening supervisors: auto-set to evening
    else if (userRole === 'evening_supervisor' || userRole === 'evening_school') {
      setSessionType('evening');
    }
    // For director, sessionType remains empty so they can choose manually
  }, [userRole]);

  const loadSelectedAcademicYear = async () => {
    setLoading(true);
    try {
      // Get the globally selected academic year from localStorage
      const selectedYearId = localStorage.getItem('selected_academic_year_id');

      if (selectedYearId) {
        setAcademicYearId(parseInt(selectedYearId, 10));
      } else {
        toast({
          title: 'تنبيه',
          description: 'لم يتم اختيار سنة دراسية. يرجى اختيار سنة دراسية من صفحة إدارة السنوات الدراسية.',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل تحميل السنة الدراسية المختارة',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load classes when academic year and session type are selected
  useEffect(() => {
    if (academicYearId && sessionType) {
      loadClasses();
    }
  }, [academicYearId, sessionType]);

  const loadClasses = async () => {
    if (!academicYearId || !sessionType) return;

    setLoadingClasses(true);
    try {
      const response = await classesApi.getAll({
        academic_year_id: academicYearId,
        session_type: sessionType
      });

      if (response.success && response.data) {
        setClasses(response.data);
      } else {
        setClasses([]);
      }
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل تحميل الصفوف',
        variant: 'destructive'
      });
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  };

  // Filter classes when grade level is selected
  useEffect(() => {
    if (gradeLevel) {
      const filtered = classes.filter(c => c.grade_level === gradeLevel);
      setFilteredClasses(filtered);

      // Reset dependent selections
      setGradeNumber(null);
      setSection('');
      setClassId(null);
    } else {
      setFilteredClasses([]);
    }
  }, [gradeLevel, classes]);

  // Filter by grade number
  useEffect(() => {
    if (gradeLevel && gradeNumber) {
      const classesForGrade = classes.filter(
        c => c.grade_level === gradeLevel && c.grade_number === gradeNumber
      );

      // Get available sections
      const sections: string[] = [];
      classesForGrade.forEach(c => {
        const sectionCount = c.section_count || 1;
        for (let i = 0; i < sectionCount; i++) {
          const sectionNumber = String(i + 1); // 1, 2, 3, ...
          if (!sections.includes(sectionNumber)) {
            sections.push(sectionNumber);
          }
        }
      });

      setAvailableSections(sections.sort());

      // Reset section
      setSection('');
      setClassId(null);
    } else {
      setAvailableSections([]);
    }
  }, [gradeLevel, gradeNumber, classes]);

  // Find class ID when all selections are made
  useEffect(() => {
    if (academicYearId && sessionType && gradeLevel && gradeNumber && section) {
      const foundClass = classes.find(
        c =>
          c.academic_year_id === academicYearId &&
          c.session_type === sessionType &&
          c.grade_level === gradeLevel &&
          c.grade_number === gradeNumber
      );

      if (foundClass) {
        setClassId(foundClass.id);
        // Only set valid if there's no existing schedule OR replacement has been confirmed
        setIsValid(true);
      } else {
        setClassId(null);
        setIsValid(false);
      }
    } else {
      setIsValid(false);
    }
  }, [academicYearId, sessionType, gradeLevel, gradeNumber, section, classes]);

  // Check if there is already a saved schedule for this class/section
  useEffect(() => {
    // Reset state when selection changes
    setHasExistingSchedule(false);
    setExistingScheduleInfo(null);
    setReplaceConfirmed(false);
    setAutoCompleted(false);

    if (!academicYearId || !sessionType || !classId || !section) {
      return;
    }

    const checkExisting = async () => {
      setCheckingExisting(true);
      try {
        const response = await schedulesApi.getAll({
          academic_year_id: academicYearId,
          session_type: sessionType,
          class_id: classId
        });

        if (response.success && response.data) {
          const matching = (response.data as any[]).filter((s: any) => s.section === section);
          if (matching.length > 0) {
            setHasExistingSchedule(true);
            setExistingScheduleInfo({
              totalPeriods: matching.length
            });
          }
        }
      } catch (error) {

      } finally {
        setCheckingExisting(false);
      }
    };

    checkExisting();
  }, [academicYearId, sessionType, classId, section]);

  // Notify parent about existing schedule status changes
  useEffect(() => {
    if (onExistingScheduleChange) {
      onExistingScheduleChange(hasExistingSchedule, replaceConfirmed);
    }
  }, [hasExistingSchedule, replaceConfirmed, onExistingScheduleChange]);

  // Auto-complete step when selections are valid and overwrite (if any) is confirmed
  useEffect(() => {
    if (!isValid || !academicYearId || !classId || !gradeNumber) {
      setAutoCompleted(false);
      return;
    }

    // If there is an existing schedule, wait until user confirms replacement
    if (hasExistingSchedule && !replaceConfirmed) {
      setAutoCompleted(false);
      return;
    }

    if (autoCompleted) return;

    onComplete({
      academicYearId,
      sessionType,
      gradeLevel,
      gradeNumber,
      classId,
      section
    });
    setAutoCompleted(true);
  }, [
    isValid,
    academicYearId,
    sessionType,
    gradeLevel,
    gradeNumber,
    classId,
    section,
    hasExistingSchedule,
    replaceConfirmed,
    autoCompleted,
    onComplete
  ]);

  // Handle schedule replacement confirmation
  const handleReplaceConfirmation = async () => {
    if (!academicYearId || !sessionType || !classId || !section) return;

    setIsDeletingSchedule(true);
    try {
      // Use the proper delete endpoint that restores teacher availability
      const response = await schedulesApi.deleteClassSchedule({
        academic_year_id: academicYearId,
        session_type: sessionType,
        class_id: classId,
        section: section
      });

      if (response.success) {
        const teachersRestored = response.data?.restored_teachers || [];
        const deletedCount = response.data?.deleted_count || 0;
        const restoredInfo = teachersRestored.length > 0
          ? ` (تم استعادة أوقات فراغ ${teachersRestored.length} معلمين)`
          : '';

        toast({
          title: 'تم حذف الجدول القديم',
          description: `تم حذف ${deletedCount} حصة من الجدول القديم بنجاح${restoredInfo}`,
        });

        // Mark as confirmed and clear existing schedule flag
        setReplaceConfirmed(true);
        setHasExistingSchedule(false);
        setExistingScheduleInfo(null);
      }
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل حذف الجدول القديم. يرجى المحاولة مرة أخرى.',
        variant: 'destructive'
      });
    } finally {
      setIsDeletingSchedule(false);
    }
  };

  const availableGrades = gradeLevel ? GRADE_LEVELS[gradeLevel as keyof typeof GRADE_LEVELS]?.grades || [] : [];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Session Type Selection - Only show for director, auto-set for supervisors */}
      {userRole === 'director' ? (
        <div className="space-y-2">
          <Label htmlFor="session-type">الفترة *</Label>
          <Select
            value={sessionType}
            onValueChange={setSessionType}
            disabled={!academicYearId}
            required
          >
            <SelectTrigger id="session-type">
              <SelectValue placeholder="اختر الفترة" />
            </SelectTrigger>
            <SelectContent>
              {SESSIONS.map((session) => (
                <SelectItem key={session.value} value={session.value}>
                  {session.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-100">
            الفترة المحددة تلقائياً: <strong>{sessionType === 'morning' ? 'صباحي' : sessionType === 'evening' ? 'مسائي' : 'غير محدد'}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Grade Level Selection */}
      <div className="space-y-2">
        <Label htmlFor="grade-level">المرحلة</Label>
        <Select
          value={gradeLevel}
          onValueChange={setGradeLevel}
          disabled={!sessionType || loadingClasses}
        >
          <SelectTrigger id="grade-level">
            <SelectValue placeholder="اختر المرحلة" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(GRADE_LEVELS).map(([key, value]) => {
              const hasClasses = classes.some(c => c.grade_level === key);
              return (
                <SelectItem key={key} value={key} disabled={!hasClasses}>
                  {value.label}
                  {!hasClasses && (
                    <span className="mr-2 text-xs text-muted-foreground">
                      (لا توجد صفوف)
                    </span>
                  )}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {loadingClasses && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            جاري تحميل الصفوف...
          </p>
        )}
      </div>

      {/* Grade Number Selection */}
      <div className="space-y-2">
        <Label htmlFor="grade-number">الصف</Label>
        <Select
          value={gradeNumber?.toString() || ''}
          onValueChange={(value) => setGradeNumber(parseInt(value))}
          disabled={!gradeLevel}
        >
          <SelectTrigger id="grade-number">
            <SelectValue placeholder="اختر الصف" />
          </SelectTrigger>
          <SelectContent>
            {availableGrades.map((grade) => {
              const hasClass = filteredClasses.some(c => c.grade_number === grade);
              return (
                <SelectItem
                  key={grade}
                  value={grade.toString()}
                  disabled={!hasClass}
                >
                  الصف {grade}
                  {!hasClass && (
                    <span className="mr-2 text-xs text-muted-foreground">
                      (غير متوفر)
                    </span>
                  )}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Section Selection */}
      <div className="space-y-2">
        <Label htmlFor="section">الشعبة</Label>
        <Select
          value={section}
          onValueChange={setSection}
          disabled={!gradeNumber || availableSections.length === 0}
        >
          <SelectTrigger id="section">
            <SelectValue placeholder="اختر الشعبة" />
          </SelectTrigger>
          <SelectContent>
            {availableSections.map((sec) => (
              <SelectItem key={sec} value={sec}>
                شعبة {sec}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Validation Status */}
      {isValid && classId && !hasExistingSchedule && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-100">
            تم اختيار الصف بنجاح. يمكنك المتابعة للخطوة التالية.
          </AlertDescription>
        </Alert>
      )}

      {isValid && classId && hasExistingSchedule && replaceConfirmed && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-100">
            تم تأكيد استبدال الجدول. يمكنك المتابعة للخطوة التالية.
          </AlertDescription>
        </Alert>
      )}

      {gradeLevel && gradeNumber && section && !classId && (
        <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-100">
            لم يتم العثور على صف مطابق للاختيارات. يرجى التحقق من البيانات.
          </AlertDescription>
        </Alert>
      )}

      {/* Existing schedule warning */}
      {isValid && classId && section && hasExistingSchedule && (
        <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-100">
            يوجد بالفعل جدول محفوظ لهذا الصف والشعبة. سيتم استبدال جميع حصص الجدول القديم
            عند إنشاء وحفظ جدول جديد.
            {existingScheduleInfo && (
              <>
                {' '}حاليًا يحتوي الجدول على{' '}
                <strong>{existingScheduleInfo.totalPeriods}</strong> حصة.
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReplaceConfirmation}
                disabled={replaceConfirmed || isDeletingSchedule}
              >
                {isDeletingSchedule ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري الحذف...
                  </>
                ) : replaceConfirmed ? (
                  'تم تأكيد الاستبدال'
                ) : (
                  'تأكيد استبدال الجدول'
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Card */}
      {academicYearId && sessionType && gradeLevel && gradeNumber && section && (
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">ملخص الاختيار:</h4>
            <div className="space-y-2 text-sm text-blue-800 dark:text-blue-100">
              <div className="flex justify-between">
                <span className="text-blue-600 dark:text-blue-300">الفترة:</span>
                <span className="font-medium text-blue-900 dark:text-blue-100">
                  {SESSIONS.find(s => s.value === sessionType)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600 dark:text-blue-300">المرحلة:</span>
                <span className="font-medium text-blue-900 dark:text-blue-100">
                  {GRADE_LEVELS[gradeLevel as keyof typeof GRADE_LEVELS]?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600 dark:text-blue-300">الصف:</span>
                <span className="font-medium text-blue-900 dark:text-blue-100">الصف {gradeNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600 dark:text-blue-300">الشعبة:</span>
                <span className="font-medium text-blue-900 dark:text-blue-100">شعبة {section}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* لا يوجد زر متابعة هنا؛ الانتقال يتم عبر زر "التالي" في الـ Wizard بعد اكتمال هذه الخطوة */}
    </div>
  );
};

