import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, Calendar, Edit2, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { api } from '@/services/api';
import type { Student, StudentAcademic, Class, AcademicYear, Subject } from '@/types/school';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type GradeType =
  | 'board_grades'
  | 'recitation_grades'
  | 'first_quiz_grade'
  | 'midterm_grades'
  | 'second_quiz_grade'
  | 'final_exam_grades'
  | 'behavior_grade'
  | 'activity_grade';

type AbsenceData = {
  student_id: number;
  absence_days: number;
  absence_dates: string[];
};

const StudentAcademicInfoPage = () => {
  const { refreshToken, state: authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<number | null>(null);
  const [selectedSessionType, setSelectedSessionType] = useState<'morning' | 'evening' | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [isTotalView, setIsTotalView] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [academicRecords, setAcademicRecords] = useState<Map<number, StudentAcademic>>(new Map());
  const [absenceRecords, setAbsenceRecords] = useState<Map<number, AbsenceData>>(new Map());
  const [totalAcademicRecords, setTotalAcademicRecords] = useState<Map<number, StudentAcademic>>(new Map());
  const [grades, setGrades] = useState<Map<string, string>>(new Map());
  const [pendingGrades, setPendingGrades] = useState<Map<string, { studentId: number, subjectId: number, gradeType: GradeType, grade: number }>>(new Map());
  const [newAbsenceDate, setNewAbsenceDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState<boolean>(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [highlightedStudentId, setHighlightedStudentId] = useState<number | null>(null);
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);
  const [pendingSwitchAction, setPendingSwitchAction] = useState<'subject' | 'total' | null>(null);
  const [pendingSwitchValue, setPendingSwitchValue] = useState<any>(null);
  const studentRowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  
  // Max grades for each type (default 100)
  const [maxGrades, setMaxGrades] = useState<Record<GradeType, number>>({
    board_grades: 100,
    recitation_grades: 100,
    first_quiz_grade: 100,
    midterm_grades: 100,
    second_quiz_grade: 100,
    final_exam_grades: 100,
    behavior_grade: 100,
    activity_grade: 100,
  });
  
  // حفظ العلامات القصوى الأصلية (لكل مادة واحدة) - لاستخدامها في حساب المجموع
  const [baseMaxGrades, setBaseMaxGrades] = useState<Record<GradeType, number>>({
    board_grades: 100,
    recitation_grades: 100,
    first_quiz_grade: 100,
    midterm_grades: 100,
    second_quiz_grade: 100,
    final_exam_grades: 100,
    behavior_grade: 100,
    activity_grade: 100,
  });
  
  // Passing thresholds for each type (default 50% - can be percentage or absolute value)
  const [passingThresholds, setPassingThresholds] = useState<Record<GradeType, number>>({
    board_grades: 50,
    recitation_grades: 50,
    first_quiz_grade: 50,
    midterm_grades: 50,
    second_quiz_grade: 50,
    final_exam_grades: 50,
    behavior_grade: 50,
    activity_grade: 50,
  });
  
  // Threshold type: 'percentage' or 'absolute'
  const [thresholdTypes, setThresholdTypes] = useState<Record<GradeType, 'percentage' | 'absolute'>>({
    board_grades: 'percentage',
    recitation_grades: 'percentage',
    first_quiz_grade: 'percentage',
    midterm_grades: 'percentage',
    second_quiz_grade: 'percentage',
    final_exam_grades: 'percentage',
    behavior_grade: 'percentage',
    activity_grade: 'percentage',
  });
  
  // Calculation type: 'direct' or 'automatic_average'
  const [calculationTypes, setCalculationTypes] = useState<Record<GradeType, 'direct' | 'automatic_average'>>({
    board_grades: 'direct',
    recitation_grades: 'direct',
    first_quiz_grade: 'direct',
    midterm_grades: 'direct',
    second_quiz_grade: 'direct',
    final_exam_grades: 'direct',
    behavior_grade: 'direct',
    activity_grade: 'direct',
  });
  
  // Overall percentage threshold (default 50%)
  const [overallPercentageThreshold, setOverallPercentageThreshold] = useState<number>(50);
  
  // Dialog state
  const [editingGradeType, setEditingGradeType] = useState<GradeType | null>(null);
  const [tempMaxGrade, setTempMaxGrade] = useState<number>(100);
  const [tempPassingThreshold, setTempPassingThreshold] = useState<number>(50);
  const [tempThresholdType, setTempThresholdType] = useState<'percentage' | 'absolute'>('percentage');
  const [tempCalculationType, setTempCalculationType] = useState<'direct' | 'automatic_average'>('direct');
  
  // Dialog state for overall percentage threshold
  const [editingOverallPercentage, setEditingOverallPercentage] = useState<boolean>(false);
  const [tempOverallPercentageThreshold, setTempOverallPercentageThreshold] = useState<number>(50);
  
  // Refs for keyboard navigation
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const gradeTypes = [
    { value: 'board_grades', label: 'السبور' },
    { value: 'recitation_grades', label: 'التسميع' },
    { value: 'first_quiz_grade', label: 'المذاكرة الأولى' },
    { value: 'midterm_grades', label: 'الفحص النصفي' },
    { value: 'second_quiz_grade', label: 'المذاكرة الثانية' },
    { value: 'final_exam_grades', label: 'الفحص النهائي' },
    { value: 'behavior_grade', label: 'السلوك' },
    { value: 'activity_grade', label: 'النشاط' },
  ];

  // دالة مساعدة لإعادة المحاولة مع تحديث التوكن
  const retryWithTokenRefresh = async <T,>(
    apiCall: () => Promise<T>,
    retries: number = 1
  ): Promise<T> => {
    try {
      return await apiCall();
    } catch (error: any) {
      // إذا كان الخطأ 401 (غير مصرح) ولدينا محاولات متبقية
      if (error?.status === 401 && retries > 0) {
        try {
          // محاولة تحديث التوكن
          await refreshToken();
          // إعادة المحاولة بعد تحديث التوكن
          return await apiCall();
        } catch (refreshError) {
          // إذا فشل تحديث التوكن، رمي الخطأ الأصلي
          throw error;
        }
      }
      throw error;
    }
  };

  const loadClasses = async (academicYearId: number, sessionType: 'morning' | 'evening') => {
    try {
      setClassesLoading(true);
      setClassesError(null);
      console.log('=== Loading Classes Debug ===');
      console.log('Academic Year ID:', academicYearId);
      console.log('Academic Year ID Type:', typeof academicYearId);
      console.log('Session Type:', sessionType);
      
      const response = await retryWithTokenRefresh(() => api.academic.getClasses({ 
        academic_year_id: academicYearId,
        session_type: sessionType
      }));
      console.log('Raw API Response:', response);
      console.log('Response Type:', typeof response);
      console.log('Is Array:', Array.isArray(response));
      
      // Handle multiple response formats
      let allClasses: Class[] = [];
      
      if (Array.isArray(response)) {
        allClasses = response;
        console.log('Response is direct array');
      } else if (response && typeof response === 'object') {
        if ('data' in response && Array.isArray(response.data)) {
          allClasses = response.data;
          console.log('Response has data array');
        } else if ('items' in response && Array.isArray(response.items)) {
          allClasses = response.items;
          console.log('Response has items array');
        } else if ('success' in response && response.success && 'data' in response) {
          allClasses = Array.isArray(response.data) ? response.data : [];
          console.log('Response is success wrapper');
        }
      }
      
      console.log('Processed classes count:', allClasses.length);
      console.log('Processed classes:', allClasses);
      
      setClasses(allClasses);
      
      // Don't set error for empty classes - just show empty dropdown
      if (allClasses.length === 0) {
        console.log('No classes found for this academic year - showing empty dropdown');
      }
    } catch (error: any) {
      console.error('=== Error Loading Classes ===');
      console.error('Error:', error);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      setClasses([]);
      setClassesError(error.message || 'فشل في تحميل الصفوف. يرجى التحقق من الاتصال بالخادم.');
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تحميل الصفوف',
        variant: 'destructive',
      });
    } finally {
      setClassesLoading(false);
    }
  };

  // Load selected academic year from localStorage on mount
  useEffect(() => {
    console.log('=== Initializing Student Academic Info Page ===');
    const yearId = localStorage.getItem('selected_academic_year_id');
    const yearName = localStorage.getItem('selected_academic_year_name');
    console.log('Stored Year ID:', yearId);
    console.log('Stored Year Name:', yearName);
    console.log('User Role:', authState.user?.role);
    console.log('All localStorage keys:', Object.keys(localStorage));
    
    if (yearId) {
      const parsedId = parseInt(yearId, 10);
      console.log('Parsed Year ID:', parsedId);
      console.log('Is Valid Number:', !isNaN(parsedId));
      
      if (!isNaN(parsedId)) {
        setSelectedAcademicYear(parsedId);
        
        // For non-director users, auto-select session type based on their role
        if (authState.user?.role === 'morning_school') {
          setSelectedSessionType('morning');
          loadClasses(parsedId, 'morning');
        } else if (authState.user?.role === 'evening_school') {
          setSelectedSessionType('evening');
          loadClasses(parsedId, 'evening');
        }
        // For directors, they need to select session type manually
      } else {
        setClassesError('معرّف السنة الدراسية غير صالح. يرجى اختيار سنة دراسية صحيحة.');
        console.error('Invalid academic year ID:', yearId);
      }
    } else {
      setClassesError('لم يتم اختيار سنة دراسية. يرجى اختيار سنة من صفحة السنوات الدراسية.');
      console.warn('No academic year selected in localStorage');
    }
  }, [authState.user?.role]);

  useEffect(() => {
    if (selectedClass && selectedSection) {
      loadStudents();
      loadSubjects();
    }
  }, [selectedClass, selectedSection]);

  // Handle preselected student from navigation (e.g., from search)
  useEffect(() => {
    const state = location.state as any;
    if (state?.preselected) {
      const { gradeLevel, gradeNumber, section, sessionType, studentId, scrollToStudent, highlightStudent } = state.preselected;
      
      console.log('=== Processing Preselected Student for Academic Info ===');
      console.log('Grade Level:', gradeLevel);
      console.log('Grade Number:', gradeNumber);
      console.log('Section:', section);
      console.log('Session Type:', sessionType);
      console.log('Student ID:', studentId);
      console.log('Scroll:', scrollToStudent);
      console.log('Highlight:', highlightStudent);
      
      // For directors, set the session type and load classes
      if (authState.user?.role === 'director' && sessionType) {
        setSelectedSessionType(sessionType);
        if (selectedAcademicYear) {
          loadClasses(selectedAcademicYear, sessionType).then(() => {
            // After classes are loaded, find and select the matching class
            // This will be handled in the next effect when classes update
          });
        }
      }
      
      // Clear the state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state, authState.user?.role, selectedAcademicYear]);

  // Handle class selection after classes are loaded from preselected state
  useEffect(() => {
    const state = location.state as any;
    if (state?.preselected && classes.length > 0) {
      const { gradeLevel, gradeNumber, section, studentId, scrollToStudent, highlightStudent } = state.preselected;
      
      // Find the class that matches both grade_level AND grade_number
      const matchingClass = classes.find(c => 
        c.grade_level === gradeLevel && c.grade_number === gradeNumber
      );
      
      if (matchingClass) {
        console.log('Found matching class:', matchingClass);
        setSelectedClass(matchingClass.id);
        setSelectedSection(section);
        setIsTotalView(true); // Switch to total view
        
        // Wait for students to load, then scroll and highlight
        if (scrollToStudent && highlightStudent && studentId) {
          // Set a timeout to allow students to load first
          setTimeout(() => {
            const studentRow = studentRowRefs.current.get(studentId);
            if (studentRow) {
              console.log('Scrolling to student row:', studentId);
              studentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Highlight student
              setHighlightedStudentId(studentId);
              
              // Remove highlight after 500ms
              setTimeout(() => {
                setHighlightedStudentId(null);
              }, 500);
            } else {
              console.warn('Student row ref not found for ID:', studentId);
            }
          }, 1000); // Wait 1 second for students to load
        }
      } else {
        console.warn('No matching class found for grade level:', gradeLevel, 'grade number:', gradeNumber);
      }
    }
  }, [classes]);

  // تحميل الإعدادات من الباك إند
  useEffect(() => {
    const loadSettings = async () => {
      if (selectedAcademicYear && selectedClass && !isTotalView) {
        try {
          const response = await retryWithTokenRefresh(() => 
            api.academic.getSettings(
              selectedAcademicYear,
              selectedClass,
              selectedSubject || undefined
            )
          );
          
          if (response && response.data) {
            const settings = response.data;
            console.log('📥 Loaded settings from backend:', settings);
            
            // تحديث الإعدادات من الاستجابة
            const newMaxGrades: Record<GradeType, number> = {
              board_grades: 100,
              recitation_grades: 100,
              first_quiz_grade: 100,
              midterm_grades: 100,
              second_quiz_grade: 100,
              final_exam_grades: 100,
              behavior_grade: 100,
              activity_grade: 100,
            };
            const newBaseMaxGrades: Record<GradeType, number> = { ...newMaxGrades };
            const newPassingThresholds: Record<GradeType, number> = { ...passingThresholds };
            const newThresholdTypes: Record<GradeType, 'percentage' | 'absolute'> = { ...thresholdTypes };
            const newCalculationTypes: Record<GradeType, 'direct' | 'automatic_average'> = { ...calculationTypes };
            
            const gradeTypesList: GradeType[] = [
              'board_grades', 'recitation_grades', 'first_quiz_grade',
              'midterm_grades', 'second_quiz_grade', 'final_exam_grades',
              'behavior_grade', 'activity_grade'
            ];
            
            gradeTypesList.forEach((gradeType) => {
              if (settings[gradeType]) {
                newMaxGrades[gradeType] = settings[gradeType].max_grade || 100;
                newBaseMaxGrades[gradeType] = settings[gradeType].max_grade || 100;
                newPassingThresholds[gradeType] = settings[gradeType].passing_threshold || 50;
                newThresholdTypes[gradeType] = settings[gradeType].threshold_type || 'percentage';
                newCalculationTypes[gradeType] = settings[gradeType].calculation_type || 'direct';
              }
            });
            
            setMaxGrades(newMaxGrades);
            setBaseMaxGrades(newBaseMaxGrades);
            setPassingThresholds(newPassingThresholds);
            setThresholdTypes(newThresholdTypes);
            setCalculationTypes(newCalculationTypes);
            
            if (settings.overall_percentage_threshold) {
              setOverallPercentageThreshold(settings.overall_percentage_threshold);
            }
            
            console.log('✅ Settings loaded - maxGrades:', newMaxGrades);
          } else {
            // إذا لم توجد إعدادات، استخدم القيم الافتراضية
            console.log('ℹ️ No saved settings found, using defaults (100 for all)');
            const defaultMaxGrades: Record<GradeType, number> = {
              board_grades: 100,
              recitation_grades: 100,
              first_quiz_grade: 100,
              midterm_grades: 100,
              second_quiz_grade: 100,
              final_exam_grades: 100,
              behavior_grade: 100,
              activity_grade: 100,
            };
            setMaxGrades(defaultMaxGrades);
            setBaseMaxGrades(defaultMaxGrades);
          }
        } catch (error) {
          console.log('ℹ️ No saved settings found, using defaults (100 for all)');
          const defaultMaxGrades: Record<GradeType, number> = {
            board_grades: 100,
            recitation_grades: 100,
            first_quiz_grade: 100,
            midterm_grades: 100,
            second_quiz_grade: 100,
            final_exam_grades: 100,
            behavior_grade: 100,
            activity_grade: 100,
          };
          setMaxGrades(defaultMaxGrades);
          setBaseMaxGrades(defaultMaxGrades);
        }
      }
    };
    
    loadSettings();
  }, [selectedAcademicYear, selectedClass, selectedSubject]);

  // استعادة العلامات القصوى الأصلية عند الخروج من وضع المجموع
  useEffect(() => {
    if (!isTotalView && baseMaxGrades.board_grades > 0) {
      // استعادة العلامات القصوى الأصلية فقط إذا كانت موجودة
      setMaxGrades({ ...baseMaxGrades });
      console.log('🔄 Restored base max grades when exiting total view:', baseMaxGrades);
    }
  }, [isTotalView, baseMaxGrades]);

  useEffect(() => {
    if (students.length > 0 && subjects.length > 0) {
      if (isTotalView) {
        loadTotalAcademicRecords();
      } else if (selectedSubject) {
        loadAcademicRecords();
      }
    }
  }, [students, subjects, selectedSubject, isTotalView]);

  // إعادة تحميل البيانات عند العودة إلى الصفحة
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedSubject && students.length > 0) {
        console.log('🔄 Page became visible, reloading academic records...');
        if (isTotalView) {
          loadTotalAcademicRecords();
        } else {
          loadAcademicRecords();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [selectedSubject, students.length, isTotalView]);

  // إظهار تحذير عند وجود تغييرات غير محفوظة
  useEffect(() => {
    if (hasUnsavedChanges && pendingGrades.size > 0) {
      // إظهار toast تحذيري كل 30 ثانية كتذكير
      const warningInterval = setInterval(() => {
        toast({
          title: '⚠️ تغييرات غير محفوظة',
          description: `لديك ${pendingGrades.size} تغيير غير محفوظ. يرجى الحفظ قبل مغادرة الصفحة.`,
          variant: 'default',
          duration: 5000,
        });
      }, 30000); // كل 30 ثانية

      return () => clearInterval(warningInterval);
    }
  }, [hasUnsavedChanges, pendingGrades.size]);


  // تحذير قبل مغادرة الصفحة مع تغييرات غير محفوظة (لإغلاق المتصفح/التبويب)
  // ملاحظة: المتصفحات الحديثة لا تسمح بتخصيص الرسالة، لكن يمكننا إظهار تحذير
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && pendingGrades.size > 0) {
        // المتصفحات الحديثة تظهر رسالة افتراضية فقط
        // لكن يمكننا إجبار المتصفح على إظهار التحذير
        e.preventDefault();
        // في المتصفحات الحديثة، يجب أن يكون returnValue سلسلة غير فارغة
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, pendingGrades.size]);

  // منع التنقل داخل التطبيق عند وجود تغييرات غير محفوظة
  useEffect(() => {
    if (!hasUnsavedChanges || pendingGrades.size === 0) return;

    // إضافة state للتاريخ لمنع التنقل بالرجوع
    const currentPath = location.pathname;
    window.history.pushState(null, '', currentPath);

    const handlePopState = () => {
      if (hasUnsavedChanges && pendingGrades.size > 0) {
        window.history.pushState(null, '', currentPath);
        setShowUnsavedChangesDialog(true);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasUnsavedChanges, pendingGrades.size, location.pathname]);

  const loadStudents = async () => {
    if (!selectedAcademicYear || !selectedClass || !selectedSection) return;

    try {
      setLoading(true);
      const selectedClassData = classes.find(c => c.id === selectedClass);

      const response = await retryWithTokenRefresh(() => api.students.getAll({
        academic_year_id: selectedAcademicYear,
        grade_level: selectedClassData?.grade_level,
        grade_number: selectedClassData?.grade_number,
      }));

      // Handle both direct array and wrapped response
      const allStudents = Array.isArray(response) ? response : (response?.data || []);

      const filteredStudents = allStudents.filter(s => 
        s.section === selectedSection && 
        (!selectedSessionType || s.session_type === selectedSessionType)
      );
      const sortedStudents = filteredStudents.sort((a, b) =>
        a.full_name.localeCompare(b.full_name, 'ar')
      );

      setStudents(sortedStudents);
    } catch (error) {
      console.error('Failed to load students:', error);
      setStudents([]); // Set to empty array on error
      toast({
        title: 'خطأ',
        description: 'فشل في تحميل الطلاب',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    if (!selectedClass) return;

    try {
      const response = await retryWithTokenRefresh(() => api.academic.getSubjects({ class_id: selectedClass }));
      // Handle both direct array and wrapped response
      const classSubjects = Array.isArray(response) ? response : (response?.data || []);
      setSubjects(classSubjects);
    } catch (error) {
      console.error('Failed to load subjects:', error);
      setSubjects([]); // Set to empty array on error
      toast({
        title: 'خطأ',
        description: 'فشل في تحميل المواد',
        variant: 'destructive',
      });
    }
  };

  const loadAcademicRecords = async () => {
    if (!selectedAcademicYear || students.length === 0 || !selectedSubject) return;

    try {
      setLoading(true);
      
      console.log('🔄 Loading academic records for subject', selectedSubject, 'and', students.length, 'students');
      
      const records = new Map<number, StudentAcademic>();
      const absences = new Map<number, AbsenceData>();

      for (const student of students) {
        try {
          // Ensure academic_year_id is a number
          const yearId = typeof selectedAcademicYear === 'number' 
            ? selectedAcademicYear 
            : parseInt(String(selectedAcademicYear), 10);
            
          console.log(`📖 Loading academics for student ${student.id} (${student.full_name}), year:`, yearId, 'subject:', selectedSubject);
          
          // API expects separate parameters, not an object
          const response = await retryWithTokenRefresh(() => api.students.getAcademics(student.id, yearId, selectedSubject));

          console.log(`✅ Raw response for student ${student.id}:`, response);

          // معالجة الاستجابة - قد تكون Array أو Object أو Object مع data
          let studentRecords: any[] = [];
          if (Array.isArray(response)) {
            studentRecords = response;
          } else if (response && typeof response === 'object') {
            if ('data' in response && Array.isArray(response.data)) {
              studentRecords = response.data;
            } else if ('id' in response) {
              // الاستجابة هي سجل واحد
              studentRecords = [response];
            }
          }

          console.log(`✅ Processed ${studentRecords.length} records for student ${student.id}:`, studentRecords);

          if (studentRecords.length > 0) {
            // البحث عن السجل الخاص بالمادة المحددة - مع مقارنة رقمية صريحة
            const subjectRecord = studentRecords.find(r => Number(r.subject_id) === Number(selectedSubject)) || studentRecords[0];
            records.set(student.id, subjectRecord);
            
            console.log(`📚 Found record for subject ${selectedSubject}, record subject_id: ${subjectRecord.subject_id}:`, {
              id: subjectRecord.id,
              subject_id: subjectRecord.subject_id,
              board_grades: subjectRecord.board_grades,
              recitation_grades: subjectRecord.recitation_grades,
              first_exam_grades: subjectRecord.first_exam_grades,
            });

            // Extract absence data
            absences.set(student.id, {
              student_id: student.id,
              absence_days: subjectRecord.absence_days || 0,
              absence_dates: subjectRecord.absence_dates ? JSON.parse(subjectRecord.absence_dates) : [],
            });
          } else {
            console.log(`⚠️ No records found for student ${student.id}`);
          }
        } catch (error) {
          // No records yet for this student
          console.log(`❌ Error loading records for student ${student.id}:`, error);
        }
      }

      console.log('✅ Final academic records map for subject', selectedSubject, ':', records);
      console.log('📋 Records size:', records.size, 'Students:', students.length);
      
      // عرض محتوى السجلات للتأكد
      records.forEach((record, studentId) => {
        console.log(`Student ${studentId} record:`, {
          id: record.id,
          subject_id: record.subject_id,
          board_grades: record.board_grades,
          recitation_grades: record.recitation_grades,
        });
      });
      
      // تحديث الـ state مرة واحدة بعد تحميل جميع البيانات
      setAcademicRecords(records);
      setAbsenceRecords(absences);
      // مسح البيانات المعلقة القديمة بعد تحميل البيانات الجديدة
      setPendingGrades(new Map());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('❌ Failed to load academic records:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTotalAcademicRecords = async () => {
    if (!selectedAcademicYear || students.length === 0 || subjects.length === 0) {
      console.log('⚠️ Cannot load total records: missing requirements', {
        hasAcademicYear: !!selectedAcademicYear,
        studentsCount: students.length,
        subjectsCount: subjects.length
      });
      return;
    }

    try {
      const totalRecords = new Map<number, StudentAcademic>();

      console.log('🔄 Loading total academic records for', students.length, 'students across', subjects.length, 'subjects');

      for (const student of students) {
        try {
          const yearId = typeof selectedAcademicYear === 'number' 
            ? selectedAcademicYear 
            : parseInt(String(selectedAcademicYear), 10);
            
          console.log(`📖 Loading total academics for student ${student.id} (${student.full_name})`);
          
          // Load all subjects for this student
          const response = await retryWithTokenRefresh(() => api.students.getAcademics(student.id, yearId));

          let studentRecords: any[] = [];
          if (Array.isArray(response)) {
            studentRecords = response;
          } else if (response && typeof response === 'object') {
            if ('data' in response && Array.isArray(response.data)) {
              studentRecords = response.data;
            } else if ('id' in response) {
              studentRecords = [response];
            }
          }

          console.log(`✅ Found ${studentRecords.length} subject records for student ${student.id}`);

          // Calculate totals across all subjects
          if (studentRecords.length > 0) {
            const totalRecord: any = {
              id: 0, // Dummy ID for total view
              student_id: student.id,
              academic_year_id: yearId,
              subject_id: 0, // No specific subject
              board_grades: 0,
              recitation_grades: 0,
              first_quiz_grade: 0,
              midterm_grades: 0,
              second_quiz_grade: 0,
              final_exam_grades: 0,
              behavior_grade: 0,
              activity_grade: 0,
              absence_days: 0,
              absence_dates: '[]'
            };

            // Sum up all grades from all subjects
            studentRecords.forEach((record: any) => {
              // تحويل القيم إلى أرقام بشكل آمن وتجنب NaN
              const toNumber = (val: any): number => {
                if (val === null || val === undefined || val === '') return 0;
                const num = Number(val);
                return isNaN(num) ? 0 : num;
              };
              
              totalRecord.board_grades += toNumber(record.board_grades);
              totalRecord.recitation_grades += toNumber(record.recitation_grades);
              totalRecord.first_quiz_grade += toNumber(record.first_quiz_grade);
              totalRecord.midterm_grades += toNumber(record.midterm_grades);
              totalRecord.second_quiz_grade += toNumber(record.second_quiz_grade);
              totalRecord.final_exam_grades += toNumber(record.final_exam_grades);
              totalRecord.behavior_grade += toNumber(record.behavior_grade);
              totalRecord.activity_grade += toNumber(record.activity_grade);
            });

            // التحقق النهائي من أن جميع القيم أرقام صحيحة
            Object.keys(totalRecord).forEach(key => {
              if (typeof totalRecord[key] === 'number' && isNaN(totalRecord[key])) {
                console.warn(`⚠️ NaN detected in ${key} for student ${student.id}, setting to 0`);
                totalRecord[key] = 0;
              }
            });
            
            totalRecords.set(student.id, totalRecord as StudentAcademic);

            console.log(`💾 Total record for student ${student.id}:`, totalRecord);
          } else {
            // إنشاء سجل فارغ بقيم صفرية إذا لم توجد سجلات
            const emptyRecord: any = {
              id: 0,
              student_id: student.id,
              academic_year_id: yearId,
              subject_id: 0,
              board_grades: 0,
              recitation_grades: 0,
              first_quiz_grade: 0,
              midterm_grades: 0,
              second_quiz_grade: 0,
              final_exam_grades: 0,
              behavior_grade: 0,
              activity_grade: 0,
              absence_days: 0,
              absence_dates: '[]'
            };
            totalRecords.set(student.id, emptyRecord as StudentAcademic);
            console.log(`⚠️ No subject records found for student ${student.id}, created empty record`);
          }
        } catch (error) {
          console.log(`❌ Error loading total records for student ${student.id}:`, error);
          // إنشاء سجل فارغ حتى في حالة الخطأ
          const yearId = typeof selectedAcademicYear === 'number' 
            ? selectedAcademicYear 
            : parseInt(String(selectedAcademicYear), 10);
          const emptyRecord: any = {
            id: 0,
            student_id: student.id,
            academic_year_id: yearId,
            subject_id: 0,
            board_grades: 0,
            recitation_grades: 0,
            first_quiz_grade: 0,
            midterm_grades: 0,
            second_quiz_grade: 0,
            final_exam_grades: 0,
            behavior_grade: 0,
            activity_grade: 0,
            absence_days: 0,
            absence_dates: '[]'
          };
          totalRecords.set(student.id, emptyRecord as StudentAcademic);
        }
      }

      console.log('✅ Final total academic records map:', totalRecords);
      setTotalAcademicRecords(totalRecords);
      
      // تحميل العلامات القصوى الفعلية لكل مادة من قاعدة البيانات
      const totalMaxGrades: Record<GradeType, number> = {
        board_grades: 0,
        recitation_grades: 0,
        first_quiz_grade: 0,
        midterm_grades: 0,
        second_quiz_grade: 0,
        final_exam_grades: 0,
        behavior_grade: 0,
        activity_grade: 0,
      };

      console.log('📊 Loading actual max grades for each subject...');
      
      // تحميل إعدادات كل مادة وجمع العلامات القصوى
      for (const subject of subjects) {
        try {
          const settingsResponse = await retryWithTokenRefresh(() => 
            api.academic.getSettings(
              selectedAcademicYear,
              selectedClass,
              subject.id
            )
          );
          
          if (settingsResponse && settingsResponse.data) {
            const subjectSettings = settingsResponse.data;
            console.log(`📚 Settings for subject ${subject.subject_name}:`, subjectSettings);
            
            const gradeTypesList: GradeType[] = [
              'board_grades', 'recitation_grades', 'first_quiz_grade',
              'midterm_grades', 'second_quiz_grade', 'final_exam_grades',
              'behavior_grade', 'activity_grade'
            ];
            
            gradeTypesList.forEach((gradeType) => {
              if (subjectSettings[gradeType] && subjectSettings[gradeType].max_grade) {
                totalMaxGrades[gradeType] += subjectSettings[gradeType].max_grade;
              } else {
                // إذا لم توجد إعدادات، استخدم القيمة الافتراضية 100
                totalMaxGrades[gradeType] += 100;
              }
            });
          } else {
            // لا توجد إعدادات، استخدم القيم الافتراضية
            console.log(`⚠️ No settings found for subject ${subject.subject_name}, using defaults`);
            totalMaxGrades.board_grades += 100;
            totalMaxGrades.recitation_grades += 100;
            totalMaxGrades.first_quiz_grade += 100;
            totalMaxGrades.midterm_grades += 100;
            totalMaxGrades.second_quiz_grade += 100;
            totalMaxGrades.final_exam_grades += 100;
            totalMaxGrades.behavior_grade += 100;
            totalMaxGrades.activity_grade += 100;
          }
        } catch (error) {
          console.log(`⚠️ Failed to load settings for subject ${subject.subject_name}, using defaults`);
          // في حالة الخطأ، استخدم القيم الافتراضية
          totalMaxGrades.board_grades += 100;
          totalMaxGrades.recitation_grades += 100;
          totalMaxGrades.first_quiz_grade += 100;
          totalMaxGrades.midterm_grades += 100;
          totalMaxGrades.second_quiz_grade += 100;
          totalMaxGrades.final_exam_grades += 100;
          totalMaxGrades.behavior_grade += 100;
          totalMaxGrades.activity_grade += 100;
        }
      }

      console.log(`✅ Total max grades calculated from ${subjects.length} subjects:`, totalMaxGrades);

      // Update max grades only in total view
      if (isTotalView) {
        setMaxGrades(totalMaxGrades);
      }
    } catch (error) {
      console.error('❌ Failed to load total academic records:', error);
    }
  };

  // Map frontend field names to backend field names
  const mapToBackendFields = (data: any): any => {
    const mapped = { ...data };
    
    // Map quiz grades
    if (mapped.first_quiz_grade !== undefined) {
      mapped.first_quiz_grade = mapped.first_quiz_grade;
      delete mapped.first_exam_grades;
    }
    if (mapped.second_quiz_grade !== undefined) {
      mapped.second_quiz_grade = mapped.second_quiz_grade;
      delete mapped.second_exam_grades;
    }
    
    return mapped;
  };

  // Map backend field names to frontend field names
  const mapToFrontendFields = (data: any): any => {
    const mapped = { ...data };
    
    // Map quiz grades
    if (mapped.first_quiz_grade !== undefined) {
      mapped.first_quiz_grade = mapped.first_quiz_grade;
    }
    if (mapped.second_quiz_grade !== undefined) {
      mapped.second_quiz_grade = mapped.second_quiz_grade;
    }
    
    return mapped;
  };

  const saveGrade = async (studentId: number, subjectId: number, gradeType: GradeType, grade: number) => {
    if (!selectedAcademicYear) return;

    try {
      const existingRecord = academicRecords.get(studentId);
      
      console.log('💾 Saving grade:', {
        studentId,
        gradeType,
        grade,
        existingRecord: existingRecord?.id,
        hasExistingRecord: !!existingRecord
      });

      // جمع جميع العلامات المعلقة لهذا الطالب
      const studentPendingGrades: Record<string, number> = {};
      pendingGrades.forEach((gradeData) => {
        if (gradeData.studentId === studentId) {
          studentPendingGrades[gradeData.gradeType] = gradeData.grade;
        }
      });

      const academicData = {
        student_id: studentId,
        academic_year_id: selectedAcademicYear,
        subject_id: subjectId,
        [gradeType]: grade,
        ...(existingRecord && {
          board_grades: existingRecord.board_grades,
          recitation_grades: existingRecord.recitation_grades,
          first_quiz_grade: existingRecord.first_quiz_grade,
          midterm_grades: existingRecord.midterm_grades,
          second_quiz_grade: existingRecord.second_quiz_grade,
          final_exam_grades: existingRecord.final_exam_grades,
          behavior_grade: existingRecord.behavior_grade,
          activity_grade: existingRecord.activity_grade,
          absence_days: existingRecord.absence_days,
          absence_dates: existingRecord.absence_dates,
        }),
        // دمج العلامات المعلقة
        ...studentPendingGrades,
      };

      // Map to backend field names
      const backendData = mapToBackendFields(academicData);

      console.log('📤 Sending to API:', backendData);

      let savedRecord;
      // التحقق من وجود السجل وأن له ID صالح (أكبر من 0)
      if (existingRecord && existingRecord.id && existingRecord.id > 0) {
        console.log('🔄 Updating existing record:', existingRecord.id);
        savedRecord = await retryWithTokenRefresh(() => api.students.updateAcademics(studentId, existingRecord.id, backendData));
      } else {
        console.log('✨ Creating new record');
        savedRecord = await retryWithTokenRefresh(() => api.students.createAcademics(studentId, backendData));
      }

      console.log('✅ Saved record response:', savedRecord);

      // استخراج الـ ID من الاستجابة بطرق مختلفة
      const recordId = savedRecord?.id 
        || savedRecord?.data?.id 
        || (Array.isArray(savedRecord) ? savedRecord[0]?.id : null)
        || existingRecord?.id 
        || 0;
      
      console.log('📝 Record ID:', recordId);

      // تحديث الـ state المحلي مع جميع العلامات
      const updatedRecord: StudentAcademic = {
        ...existingRecord,
        ...academicData,
        id: recordId,
      } as StudentAcademic;
      
      const newRecords = new Map(academicRecords);
      newRecords.set(studentId, updatedRecord);
      setAcademicRecords(newRecords);

      console.log('✅ Updated local state for student', studentId, ':', updatedRecord);

      // لا نستدعي loadAcademicRecords() هنا لتجنب إعادة التحميل
      return savedRecord;
    } catch (error: any) {
      console.error('❌ Error saving grade:', error);
      throw error;
    }
  };

  // حفظ جميع العلامات المعلقة
  const saveAllPendingGrades = async () => {
    if (pendingGrades.size === 0) {
      toast({
        title: 'تنبيه',
        description: 'لا توجد تغييرات للحفظ',
      });
      return;
    }

    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // تجميع العلامات حسب الطالب
      const gradesByStudent = new Map<number, Array<{ gradeType: GradeType, grade: number, subjectId: number }>>();
      
      pendingGrades.forEach((gradeData) => {
        if (!gradesByStudent.has(gradeData.studentId)) {
          gradesByStudent.set(gradeData.studentId, []);
        }
        gradesByStudent.get(gradeData.studentId)!.push({
          gradeType: gradeData.gradeType,
          grade: gradeData.grade,
          subjectId: gradeData.subjectId
        });
      });

      console.log('📊 Grouped grades by student:', gradesByStudent);

      // حفظ علامات كل طالب دفعة واحدة
      for (const [studentId, grades] of gradesByStudent.entries()) {
        try {
          console.log(`💾 Saving grades for student ${studentId}:`, grades);
          
          const existingRecord = academicRecords.get(studentId);
          const subjectId = grades[0].subjectId;

          // بناء بيانات الحفظ مع جميع العلامات
          const academicData: any = {
            student_id: studentId,
            academic_year_id: selectedAcademicYear,
            subject_id: subjectId,
            ...(existingRecord && {
              board_grades: existingRecord.board_grades,
              recitation_grades: existingRecord.recitation_grades,
              first_quiz_grade: existingRecord.first_quiz_grade,
              midterm_grades: existingRecord.midterm_grades,
              second_quiz_grade: existingRecord.second_quiz_grade,
              final_exam_grades: existingRecord.final_exam_grades,
              behavior_grade: existingRecord.behavior_grade,
              activity_grade: existingRecord.activity_grade,
              absence_days: existingRecord.absence_days,
              absence_dates: existingRecord.absence_dates,
            }),
          };

          // إضافة جميع العلامات المعلقة
          grades.forEach(({ gradeType, grade }) => {
            academicData[gradeType] = grade;
          });

          // Map to backend field names
          const backendData = mapToBackendFields(academicData);

          console.log('📤 Sending to API:', backendData);

          let savedRecord;
          if (existingRecord && existingRecord.id && existingRecord.id > 0) {
            savedRecord = await retryWithTokenRefresh(() => api.students.updateAcademics(studentId, existingRecord.id, backendData));
          } else {
            savedRecord = await retryWithTokenRefresh(() => api.students.createAcademics(studentId, backendData));
          }

          console.log('✅ Saved successfully for student', studentId);

          // استخراج الـ ID
          const recordId = savedRecord?.id 
            || savedRecord?.data?.id 
            || (Array.isArray(savedRecord) ? savedRecord[0]?.id : null)
            || existingRecord?.id 
            || 0;

          // تحديث السجل المحلي
          const updatedRecord: StudentAcademic = {
            ...existingRecord,
            ...academicData,
            id: recordId,
          } as StudentAcademic;
          
          // تحديث الـ Map بدون إعادة إنشائها
          academicRecords.set(studentId, updatedRecord);

          successCount += grades.length;
        } catch (error) {
          errorCount += grades.length;
          console.error(`❌ Failed to save grades for student ${studentId}:`, error);
        }
      }

      // إجبار re-render بعد تحديث جميع السجلات
      setAcademicRecords(new Map(academicRecords));

      // مسح العلامات المعلقة بعد الحفظ
      setPendingGrades(new Map());
      setHasUnsavedChanges(false);

      if (errorCount === 0) {
        toast({
          title: 'نجح',
          description: `تم حفظ ${successCount} علامة لـ ${gradesByStudent.size} طالب بنجاح`,
        });
      } else {
        toast({
          title: 'تحذير',
          description: `تم حفظ ${successCount} علامة، فشل حفظ ${errorCount} علامة`,
          variant: 'default',
        });
      }
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل في حفظ العلامات',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveAbsence = async (studentId: number, subjectId: number) => {
    if (!selectedAcademicYear) return;

    try {
      const absenceData = absenceRecords.get(studentId);
      const existingRecord = academicRecords.get(studentId);

      if (!absenceData) return;

      const academicData = {
        student_id: studentId,
        academic_year_id: selectedAcademicYear,
        subject_id: subjectId,
        absence_days: absenceData.absence_days,
        absence_dates: JSON.stringify(absenceData.absence_dates),
        ...(existingRecord && {
          board_grades: existingRecord.board_grades,
          recitation_grades: existingRecord.recitation_grades,
          first_quiz_grade: existingRecord.first_quiz_grade,
          midterm_grades: existingRecord.midterm_grades,
          second_quiz_grade: existingRecord.second_quiz_grade,
          final_exam_grades: existingRecord.final_exam_grades,
          behavior_grade: existingRecord.behavior_grade,
          activity_grade: existingRecord.activity_grade,
        }),
      };

      if (existingRecord) {
        await retryWithTokenRefresh(() => api.students.updateAcademics(studentId, existingRecord.id, academicData));
      } else {
        await retryWithTokenRefresh(() => api.students.createAcademics(studentId, academicData));
      }

      toast({
        title: 'نجح',
        description: 'تم حفظ الغياب بنجاح',
      });

      loadAcademicRecords();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حفظ الغياب',
        variant: 'destructive',
      });
    }
  };

  const addAbsenceDate = (studentId: number) => {
    if (!newAbsenceDate) return;

    const currentData = absenceRecords.get(studentId) || {
      student_id: studentId,
      absence_days: 0,
      absence_dates: [],
    };

    const updatedData = {
      ...currentData,
      absence_dates: [...currentData.absence_dates, newAbsenceDate],
      absence_days: currentData.absence_days + 1,
    };

    const newRecords = new Map(absenceRecords);
    newRecords.set(studentId, updatedData);
    setAbsenceRecords(newRecords);
    setNewAbsenceDate('');
  };

  const removeAbsenceDate = (studentId: number, dateToRemove: string) => {
    const currentData = absenceRecords.get(studentId);
    if (!currentData) return;

    const updatedData = {
      ...currentData,
      absence_dates: currentData.absence_dates.filter(d => d !== dateToRemove),
      absence_days: Math.max(0, currentData.absence_days - 1),
    };

    const newRecords = new Map(absenceRecords);
    newRecords.set(studentId, updatedData);
    setAbsenceRecords(newRecords);
  };

  const getSectionOptions = () => {
    if (!selectedClass) return [];
    const classData = classes.find(c => c.id === selectedClass);
    if (!classData) return [];

    const sections = [];
    for (let i = 0; i < (classData.section_count || 1); i++) {
      sections.push(String(i + 1)); // 1, 2, 3, ...
    }
    return sections;
  };

  const getGradeValue = (studentId: number, gradeType: GradeType): number | undefined => {
    const record = isTotalView 
      ? totalAcademicRecords.get(studentId) 
      : academicRecords.get(studentId);
    
    if (!record) {
      // console.log(`⚠️ No record found for student ${studentId} in ${isTotalView ? 'total' : 'subject'} view, subject: ${selectedSubject}`);
      return undefined;
    }
    
    const value = record[gradeType];
    // console.log(`Getting grade for student ${studentId}, type ${gradeType}, subject ${record.subject_id}, value:`, value);
    
    // إرجاع undefined بدلاً من null أو NaN لعرض placeholder
    if (value === null || value === undefined) return undefined;
    // التحقق من NaN
    const numValue = Number(value);
    return isNaN(numValue) ? undefined : numValue;
  };

  const calculatePercentage = (studentId: number): number => {
    const record = isTotalView 
      ? totalAcademicRecords.get(studentId) 
      : academicRecords.get(studentId);
    if (!record) return 0;

    let totalPercentages = 0;
    let countGrades = 0;

    gradeTypes.forEach(({ value }) => {
      const gradeType = value as GradeType;
      const gt = gradeType as GradeType;
      
      // استخدام العلامة المعلقة إذا كانت موجودة، وإلا استخدام المحفوظة
      const savedGrade = record[gradeType];
      const pendingKey = `${studentId}-${gt}`;
      const pendingGrade = pendingGrades.get(pendingKey);
      const grade = pendingGrade?.grade ?? savedGrade;
      
      const maxGrade = maxGrades[gradeType];
      
      // تخطي العلامات الفارغة (undefined/null) من الحساب
      if (grade === null || grade === undefined) {
        return; // Skip this grade entirely
      }
      
      // التحقق من القيمة وتحويلها إلى رقم بشكل آمن
      const numGrade = Number(grade);
      const numMaxGrade = Number(maxGrade);
      
      if (!isNaN(numGrade) && !isNaN(numMaxGrade) && numMaxGrade > 0) {
        // حساب النسبة المئوية لكل علامة
        const percentage = (numGrade / numMaxGrade) * 100;
        if (!isNaN(percentage)) {
          totalPercentages += percentage;
          countGrades++;
        }
      }
    });

    // المتوسط الحسابي للنسب المئوية
    if (countGrades === 0) return 0;
    return totalPercentages / countGrades;
  };

  // دالة للتحقق من أن العلامة راسبة بناءً على الحد المخصص
  const isFailingGrade = (grade: number | undefined, maxGrade: number, gradeType: GradeType): boolean => {
    if (grade === undefined || grade === null || maxGrade === 0) return false;
    
    const threshold = passingThresholds[gradeType];
    const thresholdType = thresholdTypes[gradeType];
    
    if (thresholdType === 'absolute') {
      // إذا كان الحد مطلق (علامة مباشرة)
      return grade < threshold;
    } else {
      // إذا كان الحد نسبة مئوية
      const percentage = (grade / maxGrade) * 100;
      return percentage < threshold;
    }
  };

  const openMaxGradeDialog = (gradeType: GradeType) => {
    setEditingGradeType(gradeType);
    // استخدام baseMaxGrades في الوضع العادي، maxGrades في وضع المجموع
    setTempMaxGrade(isTotalView ? maxGrades[gradeType] : baseMaxGrades[gradeType]);
    setTempPassingThreshold(passingThresholds[gradeType]);
    setTempThresholdType(thresholdTypes[gradeType]);
    setTempCalculationType(calculationTypes[gradeType]);
    console.log(`📝 Opening dialog for ${gradeType}:`, {
      isTotalView,
      maxGrade: isTotalView ? maxGrades[gradeType] : baseMaxGrades[gradeType],
      passingThreshold: passingThresholds[gradeType],
      thresholdType: thresholdTypes[gradeType],
      calculationType: calculationTypes[gradeType]
    });
  };

  const saveMaxGrade = async () => {
    if (editingGradeType) {
      // التحقق من صحة القيم
      if (!isTotalView && tempMaxGrade <= 0) {
        toast({
          title: 'خطأ',
          description: 'العلامة القصوى يجب أن تكون أكبر من صفر',
          variant: 'destructive',
        });
        return;
      }
      
      if (tempThresholdType === 'absolute' && tempPassingThreshold > tempMaxGrade) {
        toast({
          title: 'خطأ',
          description: 'حد الرسوب (علامة مباشرة) يجب أن يكون أقل من أو يساوي العلامة القصوى',
          variant: 'destructive',
        });
        return;
      }
      
      if (tempThresholdType === 'percentage' && (tempPassingThreshold < 0 || tempPassingThreshold > 100)) {
        toast({
          title: 'خطأ',
          description: 'حد الرسوب (نسبة مئوية) يجب أن يكون بين 0 و 100',
          variant: 'destructive',
        });
        return;
      }
      
      // في وضع المجموع، نحفظ فقط حد الرسوب وليس العلامة القصوى
      if (!isTotalView) {
        setMaxGrades({
          ...maxGrades,
          [editingGradeType]: tempMaxGrade,
        });
        // تحديث baseMaxGrades أيضاً (العلامات الأصلية)
        setBaseMaxGrades({
          ...baseMaxGrades,
          [editingGradeType]: tempMaxGrade,
        });
      }
      
      setPassingThresholds({
        ...passingThresholds,
        [editingGradeType]: tempPassingThreshold,
      });
      setThresholdTypes({
        ...thresholdTypes,
        [editingGradeType]: tempThresholdType,
      });
      setCalculationTypes({
        ...calculationTypes,
        [editingGradeType]: tempCalculationType,
      });
      
      // حفظ الإعدادات في الباك إند
      if (selectedAcademicYear && selectedClass) {
        try {
          const settings = {
            academic_year_id: selectedAcademicYear,
            class_id: selectedClass,
            subject_id: selectedSubject || null,
            [editingGradeType]: {
              max_grade: tempMaxGrade,
              passing_threshold: tempPassingThreshold,
              threshold_type: tempThresholdType,
              calculation_type: tempCalculationType
            }
          };
          
          await retryWithTokenRefresh(() => api.academic.saveSettings(settings));
          console.log('✅ Settings saved to backend');
          
          // إعادة تحميل البيانات إذا تم تغيير calculation_type
          const oldCalculationType = calculationTypes[editingGradeType];
          if (oldCalculationType !== tempCalculationType && selectedSubject && students.length > 0) {
            console.log('🔄 Calculation type changed, reloading academic records...');
            setTimeout(() => {
              if (isTotalView) {
                loadTotalAcademicRecords();
              } else {
                loadAcademicRecords();
              }
            }, 500);
          }
        } catch (error) {
          console.error('❌ Failed to save settings:', error);
          toast({
            title: 'تحذير',
            description: 'تم الحفظ محلياً لكن فشل الحفظ في الخادم',
            variant: 'default',
          });
        }
      }
      
      setEditingGradeType(null);
      toast({
        title: 'نجح',
        description: isTotalView ? 'تم تحديث حد الرسوب' : 'تم تحديث العلامة القصوى وحد الرسوب',
      });
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>, 
    studentIndex: number, 
    gradeIndex: number, 
    saveCallback?: () => void
  ) => {
    const totalGradeTypes = gradeTypes.length;
    const totalStudents = students.length;
    
    // Handle Enter key - move to next row, same column
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      
      // حفظ القيمة الحالية قبل التنقل
      if (saveCallback) {
        saveCallback();
      }
      
      // الانتقال للحقل الجديد
      setTimeout(() => {
        const newStudentIndex = Math.min(studentIndex + 1, totalStudents - 1);
        const key = `${students[newStudentIndex]?.id}-${gradeTypes[gradeIndex]?.value}`;
        const input = inputRefs.current.get(key);
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);
      return;
    }
    
    // Handle arrow keys for navigation
    if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      
      // حفظ القيمة الحالية قبل التنقل
      if (saveCallback) {
        saveCallback();
      }
      
      let newStudentIndex = studentIndex;
      let newGradeIndex = gradeIndex;
      
      switch(e.key) {
        case 'ArrowDown':
          // التنقل للأسفل - الطالب التالي، نفس العمود
          newStudentIndex = Math.min(studentIndex + 1, totalStudents - 1);
          break;
        case 'ArrowUp':
          // التنقل للأعلى - الطالب السابق، نفس العمود
          newStudentIndex = Math.max(studentIndex - 1, 0);
          break;
        case 'ArrowRight':
          // RTL: السهم الأيمن ينقل للعمود السابق (اليمين)
          newGradeIndex = Math.max(gradeIndex - 1, 0);
          break;
        case 'ArrowLeft':
          // RTL: السهم الأيسر ينقل للعمود التالي (اليسار)
          newGradeIndex = Math.min(gradeIndex + 1, totalGradeTypes - 1);
          break;
      }
      
      // الانتقال للحقل الجديد بعد فترة قصيرة
      setTimeout(() => {
        const key = `${students[newStudentIndex]?.id}-${gradeTypes[newGradeIndex]?.value}`;
        const input = inputRefs.current.get(key);
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);
      return;
    }
    
    // السماح بجميع المفاتيح الأخرى (الأرقام، Backspace، Delete، إلخ) بالعمل بشكل طبيعي
  };

  // Modern Number Input Component - يستخدم useState محلي لتجنب مشاكل re-render
  const ModernNumberInput = ({ 
    initialValue, 
    onSave, 
    min, 
    max, 
    studentId, 
    gradeType,
    studentIndex,
    gradeIndex,
    placeholder = '--',
    isFailing = false,
    isReadOnly = false
  }: { 
    initialValue: number | undefined, 
    onSave: (value: number) => void,
    min: number,
    max: number,
    studentId: number,
    gradeType: string,
    studentIndex: number,
    gradeIndex: number,
    placeholder?: string,
    isFailing?: boolean,
    isReadOnly?: boolean
  }) => {
    // تحويل القيمة الأولية وإزالة .00 إذا كان رقم صحيح
    const getDisplayValue = (value: number | undefined): string => {
      if (value === undefined || value === null) return '';
      
      // تحويل لرقم في حال كان string
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      
      // إذا كان رقم صحيح (بدون كسور عشرية)، إرجاع بدون .00
      if (Number.isInteger(numValue)) {
        return String(Math.round(numValue));
      }
      
      // إذا كان عشري (مثل 85.5)، إرجاعه كما هو
      return String(numValue);
    };

    const [localValue, setLocalValue] = useState<string>(getDisplayValue(initialValue));
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [lastSavedValue, setLastSavedValue] = useState<number | undefined>(initialValue);
    
    // تحديث القيمة المحلية عند تغيير initialValue من الخارج (بعد الحفظ)
    useEffect(() => {
      // تحديث فقط إذا القيمة الجديدة مختلفة عن القيمة المحفوظة الأخيرة
      if (initialValue !== lastSavedValue && !isEditing) {
        console.log(`Updating ${studentId}-${gradeType}: ${lastSavedValue} → ${initialValue}`);
        setLocalValue(getDisplayValue(initialValue));
        setLastSavedValue(initialValue);
      }
    }, [initialValue, lastSavedValue, isEditing, studentId, gradeType]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      
      // السماح بالكتابة الحرة - فقط أرقام أو نقطة أو فارغ
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        // منع إدخال أرقام كبيرة جداً
        if (value !== '') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue) && numValue > max * 10) {
            return;
          }
        }
        setLocalValue(value);
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsEditing(true);
      e.target.select();
    };

    // دالة حفظ القيمة بدون تغيير حالة التعديل
    const saveValue = () => {
      const trimmed = localValue.trim();
      
      if (trimmed === '' || trimmed === '.' || trimmed === '-') {
        return;
      }
      
      let grade = parseFloat(trimmed);
      
      if (!isNaN(grade)) {
        // تطبيق القيمة القصوى والدنيا
        if (grade > max) {
          grade = max;
          toast({
            title: 'تنبيه',
            description: `تم تعديل العلامة إلى الحد الأقصى (${max})`,
            variant: 'default',
          });
        }
        grade = Math.max(min, grade);
        
        setLocalValue(String(grade));
        setLastSavedValue(grade);
        onSave(grade);
      }
    };

    const handleBlur = () => {
      saveValue();
      setIsEditing(false);
    };

    return (
      <Input
        ref={(el) => {
          if (el) {
            const key = `${studentId}-${gradeType}`;
            inputRefs.current.set(key, el);
          }
        }}
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={(e) => handleKeyDown(e, studentIndex, gradeIndex, saveValue)}
        placeholder={placeholder}
        className={`w-24 text-center rounded-lg ${isFailing ? 'text-red-800 dark:text-red-400 font-semibold' : ''} ${isReadOnly ? 'bg-muted/50 cursor-not-allowed' : ''}`}
        autoComplete="off"
        readOnly={isReadOnly}
        disabled={isReadOnly}
        title={isReadOnly ? 'هذا الحقل محسوب تلقائياً من الصفحة اليومية' : ''}
      />
    );
  };

  const handleSwitchConfirm = () => {
    if (pendingSwitchAction === 'subject' && pendingSwitchValue !== null) {
      setSelectedSubject(pendingSwitchValue);
      setIsTotalView(false);
      setPendingGrades(new Map());
      setHasUnsavedChanges(false);
    } else if (pendingSwitchAction === 'total') {
      setIsTotalView(true);
      setSelectedSubject(null);
      setPendingGrades(new Map());
      setHasUnsavedChanges(false);
    }
    setSwitchConfirmOpen(false);
    setPendingSwitchAction(null);
    setPendingSwitchValue(null);
  };

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Warning Banner for Unsaved Changes */}
        {hasUnsavedChanges && pendingGrades.size > 0 && (
          <Card className="border-secondary bg-secondary/10 dark:bg-secondary/5 rounded-3xl shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-secondary-foreground text-base">
                      ⚠️ لديك {pendingGrades.size} تغيير غير محفوظ
                    </p>
                    <p className="text-sm text-secondary-foreground/80 mt-1">
                      إذا قمت بإعادة تحميل الصفحة أو مغادرتها، سيتم فقدان جميع التغييرات غير المحفوظة
                    </p>
                  </div>
                </div>
                <Button
                  onClick={saveAllPendingGrades}
                  disabled={isSaving}
                  className="rounded-xl gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground flex-shrink-0"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'جاري الحفظ...' : 'حفظ الآن'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">معلومات دراسية - الطلاب</h1>
            <p className="text-muted-foreground mt-1">إدارة العلامات والحضور للطلاب</p>
          </div>
          {!isTotalView && selectedSubject && (
            <div className="flex items-center gap-3">
              <Button
                onClick={saveAllPendingGrades}
                disabled={isSaving || pendingGrades.size === 0}
                className="rounded-xl gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <Card className="rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle>اختيار الصف والشعبة والمادة</CardTitle>
            <CardDescription>
              {isTotalView 
                ? "عرض المجموع الكلي لجميع المواد (للمشاهدة فقط - لا يمكن تعديل العلامات)"
                : "اختر الصف والشعبة والمادة لعرض وإدارة العلامات، أو اضغط على 'المجموع' لعرض مجموع جميع المواد"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {classesLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                جاري تحميل الصفوف...
              </div>
            ) : classesError ? (
              <div className="text-center py-8">
                <p className="text-destructive mb-4">{classesError}</p>
                <Button onClick={() => {
                  if (selectedAcademicYear && selectedSessionType) {
                    loadClasses(selectedAcademicYear, selectedSessionType);
                  }
                }}>
                  محاولة مرة أخرى
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Session Type Selection (for directors only) */}
                {authState.user?.role === 'director' && (
                  <div className="space-y-2">
                    <Label>نوع الدوام</Label>
                    <Select
                      value={selectedSessionType || ''}
                      onValueChange={(value: 'morning' | 'evening') => {
                        setSelectedSessionType(value);
                        setSelectedClass(null);
                        setSelectedSection('');
                        setSelectedSubject(null);
                        setIsTotalView(false);
                        if (selectedAcademicYear) {
                          loadClasses(selectedAcademicYear, value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر نوع الدوام" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">صباحي</SelectItem>
                        <SelectItem value="evening">مسائي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الصف</Label>
                    <Select
                      value={selectedClass?.toString()}
                      onValueChange={(value) => {
                        setSelectedClass(parseInt(value));
                        setSelectedSection('');
                        setSelectedSubject(null);
                        setIsTotalView(false);
                      }}
                      disabled={authState.user?.role === 'director' && !selectedSessionType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          authState.user?.role === 'director' && !selectedSessionType
                            ? "اختر نوع الدوام أولاً"
                            : classes.length === 0
                            ? "لا توجد صفوف متاحة"
                            : "اختر الصف"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.length === 0 ? (
                          <div className="px-4 py-2 text-sm text-muted-foreground">
                            لا توجد صفوف مسجلة
                          </div>
                        ) : (
                          classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id.toString()}>
                              {`${cls.grade_level === 'primary' ? 'ابتدائي' : cls.grade_level === 'intermediate' ? 'إعدادي' : 'ثانوي'} - الصف ${cls.grade_number}`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>الشعبة</Label>
                    <Select
                      value={selectedSection}
                      onValueChange={(value) => {
                        setSelectedSection(value);
                        setSelectedSubject(null);
                        setIsTotalView(false);
                      }}
                      disabled={!selectedClass || (authState.user?.role === 'director' && !selectedSessionType)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الشعبة" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSectionOptions().map((section) => (
                          <SelectItem key={section} value={section}>
                            الشعبة {section}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Subject selection or Total button */}
                {selectedClass && selectedSection && (
                  <div className="space-y-2">
                    <Label>المادة {!isTotalView && <span className="text-red-500">*</span>}</Label>
                    <div className="flex gap-2">
                      <Select
                        value={selectedSubject?.toString() || ''}
                        onValueChange={(value) => {
                          if (pendingGrades.size > 0) {
                            setPendingSwitchAction('subject');
                            setPendingSwitchValue(parseInt(value));
                            setSwitchConfirmOpen(true);
                          } else {
                            setSelectedSubject(parseInt(value));
                            setIsTotalView(false);
                          }
                        }}
                        disabled={isTotalView || subjects.length === 0}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={subjects.length === 0 ? "لا توجد مواد متاحة" : isTotalView ? "وضع المجموع مفعّل" : "اختر المادة"} />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.length === 0 ? (
                            <div className="px-4 py-2 text-sm text-muted-foreground">
                              لا توجد مواد مسجلة لهذا الصف
                            </div>
                          ) : (
                            subjects.map((subject) => (
                              <SelectItem key={subject.id} value={subject.id.toString()}>
                                {subject.subject_name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant={isTotalView ? "default" : "outline"}
                        onClick={() => {
                          const newTotalView = !isTotalView;
                          if (newTotalView && pendingGrades.size > 0) {
                            setPendingSwitchAction('total');
                            setPendingSwitchValue(true);
                            setSwitchConfirmOpen(true);
                          } else {
                            setIsTotalView(newTotalView);
                            if (newTotalView) {
                              setSelectedSubject(null);
                            }
                          }
                        }}
                        className="rounded-xl px-6"
                        disabled={subjects.length === 0}
                      >
                        المجموع
                      </Button>
                    </div>
                    {isTotalView && (
                      <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 mt-2">
                        <p className="text-sm text-primary font-medium flex items-center gap-2">
                          <span className="text-lg">🔍</span>
                          وضع المجموع الكلي: عرض للقراءة فقط - لا يمكن تعديل العلامات في هذا الوضع
                        </p>
                        <p className="text-xs text-primary/80 mt-1 mr-7">
                          العلامات المعروضة هي مجموع علامات جميع المواد ({subjects.length} مادة). يمكنك تعديل حد الرسوب فقط بالضغط على عنوان أي عمود.
                        </p>
                      </div>
                    )}
                    {!isTotalView && !selectedSubject && subjects.length > 0 && (
                      <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 mt-2">
                        <p className="text-sm text-accent-foreground font-medium flex items-center gap-2">
                          <span className="text-lg">⚠️</span>
                          يرجى اختيار مادة لعرض وتعديل العلامات
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Students Grades Table */}
        {selectedClass && selectedSection && students.length > 0 && (isTotalView || selectedSubject) && (
          <Card className="rounded-3xl overflow-hidden">
            <CardHeader>
              <CardTitle>
                {isTotalView ? '📊 المجموع الكلي - للمشاهدة فقط' : '📝 العلامات والنشاط الدراسي'}
              </CardTitle>
              <CardDescription>
                {isTotalView 
                  ? `${students.length} طالب في هذه الشعبة - مجموع علامات ${subjects.length} مادة (اضغط على عنوان أي عمود لتعديل حد الرسوب فقط)` 
                  : `${students.length} طالب في هذه الشعبة - اضغط على أي عنوان لتعديل العلامة القصوى وحد الرسوب`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  جاري التحميل...
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا يوجد طلاب في هذه الشعبة. يرجى إضافة طلاب من صفحة المعلومات الشخصية أولاً.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-2 py-3 text-right text-sm font-semibold sticky right-0 bg-muted/50 z-10 first:rounded-tr-2xl">#</th>
                        <th className="px-2 py-3 text-right text-sm font-semibold sticky right-0 bg-muted/50 z-10 min-w-[150px]">اسم الطالب</th>
                        {gradeTypes.map((gradeType) => (
                          <th 
                            key={gradeType.value}
                            className="px-2 py-3 text-center text-sm font-semibold rounded-lg cursor-pointer hover:bg-muted transition-colors group"
                            onClick={() => openMaxGradeDialog(gradeType.value as GradeType)}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span>{gradeType.label}</span>
                              <span className="text-xs text-muted-foreground">
                                (من {maxGrades[gradeType.value as GradeType]})
                              </span>
                              <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </th>
                        ))}
                        <th 
                          className="px-2 py-3 text-center text-sm font-semibold bg-primary/10 last:rounded-tl-2xl cursor-pointer hover:bg-primary/20 transition-colors group rounded-lg"
                          onClick={() => {
                            if (!isTotalView) {
                              setTempOverallPercentageThreshold(overallPercentageThreshold);
                              setEditingOverallPercentage(true);
                            }
                          }}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span>النسبة المئوية</span>
                            <span className="text-xs text-muted-foreground">
                              (حد الرسوب: {overallPercentageThreshold}%)
                            </span>
                            {!isTotalView && (
                              <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, studentIndex) => {
                        // استخدام المادة المحددة حالياً بدلاً من المادة الأولى
                        const defaultSubjectId = selectedSubject || subjects[0]?.id || 1;
                        
                        // حساب النسبة المئوية من السجلات الأكاديمية المحفوظة
                        const percentage = calculatePercentage(student.id);

                        return (
                          <tr 
                            key={student.id}
                            ref={(el) => {
                              if (el) {
                                studentRowRefs.current.set(student.id, el);
                              } else {
                                studentRowRefs.current.delete(student.id);
                              }
                            }}
                            className={`border-b border-border hover:bg-muted/30 transition-all last:border-b-0 ${
                              highlightedStudentId === student.id 
                                ? 'bg-primary/20 ring-2 ring-primary' 
                                : ''
                            }`}
                          >
                            <td className="px-2 py-3 text-sm sticky right-0 bg-background">{studentIndex + 1}</td>
                            <td className="px-2 py-3 text-sm font-medium sticky right-0 bg-background min-w-[150px]">
                              {student.full_name}
                            </td>
                            {gradeTypes.map((gradeType, gradeIndex) => {
                              const gt = gradeType.value as GradeType;
                              const savedGrade = getGradeValue(student.id, gt);
                              const pendingKey = `${student.id}-${gt}`;
                              const pendingGrade = pendingGrades.get(pendingKey);
                              // استخدام العلامة المعلقة إذا كانت موجودة، وإلا استخدام المحفوظة
                              const currentGrade = pendingGrade?.grade ?? savedGrade;
                              const maxGrade = maxGrades[gt];
                              // التحقق من أن العلامة راسبة بناءً على الحد المخصص
                              const failing = isFailingGrade(currentGrade, maxGrade, gt);

                              return (
                                <td key={gradeType.value} className="px-2 py-3">
                                  {isTotalView ? (
                                    <div className={`w-24 text-center py-2 px-3 rounded-lg bg-muted/30 ${failing ? 'text-red-800 dark:text-red-400 font-semibold' : ''}`}>
                                      {currentGrade !== undefined && currentGrade !== null ? (Number.isInteger(Number(currentGrade)) ? Math.round(Number(currentGrade)) : Number(currentGrade).toFixed(1)) : '--'}
                                    </div>
                                  ) : (
                                    <ModernNumberInput
                                      key={`${student.id}-${gt}-${selectedSubject || 'total'}`}
                                      initialValue={currentGrade}
                                      onSave={(grade) => {
                                        // إضافة إلى العلامات المعلقة بدلاً من الحفظ مباشرة
                                        const key = `${student.id}-${gt}`;
                                        const newPending = new Map(pendingGrades);
                                        newPending.set(key, {
                                          studentId: student.id,
                                          subjectId: defaultSubjectId,
                                          gradeType: gt,
                                          grade: grade,
                                        });
                                        setPendingGrades(newPending);
                                        setHasUnsavedChanges(true);
                                      }}
                                      min={0}
                                      max={maxGrade}
                                      studentId={student.id}
                                      gradeType={gt}
                                      studentIndex={studentIndex}
                                      gradeIndex={gradeIndex}
                                      placeholder="--"
                                      isFailing={failing}
                                      isReadOnly={calculationTypes[gt] === 'automatic_average'}
                                    />
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-2 py-3 text-center bg-primary/5">
                              <span className={`text-lg font-bold ${percentage < overallPercentageThreshold ? 'text-red-800 dark:text-red-400' : 'text-primary'}`}>
                                {!isNaN(percentage) && percentage !== null && percentage !== undefined ? 
                                  (Number.isInteger(Number(percentage)) ? Math.round(Number(percentage)) : Number(percentage).toFixed(1)) 
                                  : '0'}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Unsaved Changes Alert Dialog */}
        <AlertDialog open={showUnsavedChangesDialog} onOpenChange={setShowUnsavedChangesDialog}>
          <AlertDialogContent className="sm:max-w-md rounded-3xl" dir="rtl">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-secondary" />
                </div>
                <AlertDialogTitle className="text-xl font-bold">
                  تغييرات غير محفوظة
                </AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-base space-y-3 pt-2">
                <p className="font-medium text-foreground">
                  لديك <span className="text-secondary font-bold">{pendingGrades.size}</span> تغيير غير محفوظ
                </p>
                <p className="text-muted-foreground">
                  إذا غادرت الصفحة الآن، سيتم فقدان جميع التغييرات غير المحفوظة.
                </p>
                <p className="text-sm text-muted-foreground">
                  هل تريد المتابعة والمغادرة دون حفظ؟
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 mt-4">
              <AlertDialogCancel 
                onClick={() => setShowUnsavedChangesDialog(false)}
                className="rounded-xl"
              >
                إلغاء
              </AlertDialogCancel>
              <Button
                variant="outline"
                onClick={async () => {
                  setShowUnsavedChangesDialog(false);
                  await saveAllPendingGrades();
                }}
                className="rounded-xl gap-2"
              >
                <Save className="h-4 w-4" />
                حفظ والمغادرة
              </Button>
              <AlertDialogAction
                onClick={() => {
                  setHasUnsavedChanges(false);
                  setPendingGrades(new Map());
                  setShowUnsavedChangesDialog(false);
                  if (pendingNavigation) {
                    navigate(pendingNavigation);
                    setPendingNavigation(null);
                  }
                }}
                className="rounded-xl bg-destructive hover:bg-destructive/90"
              >
                مغادرة دون حفظ
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Overall Percentage Threshold Dialog */}
        <Dialog open={editingOverallPercentage} onOpenChange={() => setEditingOverallPercentage(false)}>
          <DialogContent className="sm:max-w-md rounded-3xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل حد الرسوب للنسبة المئوية الإجمالية</DialogTitle>
              <DialogDescription>
                قم بتعديل حد الرسوب للنسبة المئوية الإجمالية للطلاب
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="overallPercentageThreshold">حد الرسوب (نسبة مئوية)</Label>
                <Input
                  id="overallPercentageThreshold"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={tempOverallPercentageThreshold}
                  onChange={(e) => setTempOverallPercentageThreshold(parseFloat(e.target.value) || 50)}
                  className="text-center text-lg rounded-2xl"
                  placeholder="50"
                />
                <p className="text-xs text-muted-foreground text-center mt-1">
                  أي نسبة مئوية إجمالية أقل من {tempOverallPercentageThreshold}% تعتبر راسبة
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingOverallPercentage(false)}
                className="rounded-xl"
              >
                إلغاء
              </Button>
              <Button 
                onClick={() => {
                  if (tempOverallPercentageThreshold < 0 || tempOverallPercentageThreshold > 100) {
                    toast({
                      title: 'خطأ',
                      description: 'حد الرسوب يجب أن يكون بين 0 و 100',
                      variant: 'destructive',
                    });
                    return;
                  }
                  setOverallPercentageThreshold(tempOverallPercentageThreshold);
                  setEditingOverallPercentage(false);
                  toast({
                    title: 'نجح',
                    description: 'تم تحديث حد الرسوب للنسبة المئوية الإجمالية',
                  });
                }} 
                className="rounded-xl"
              >
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Max Grade Dialog */}
        <Dialog open={editingGradeType !== null} onOpenChange={() => setEditingGradeType(null)}>
          <DialogContent className="sm:max-w-md rounded-3xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                {isTotalView ? 'تعديل حد الرسوب (وضع المجموع)' : 'تعديل العلامة القصوى وحد الرسوب'}
              </DialogTitle>
              <DialogDescription>
                {isTotalView 
                  ? `قم بتعديل حد الرسوب لـ ${editingGradeType && gradeTypes.find(g => g.value === editingGradeType)?.label}. العلامة القصوى محسوبة تلقائياً من مجموع ${subjects.length} مادة ولا يمكن تعديلها.`
                  : `قم بتعديل العلامة القصوى وحد الرسوب لـ ${editingGradeType && gradeTypes.find(g => g.value === editingGradeType)?.label}`
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!isTotalView && (
                <div className="space-y-2">
                  <Label htmlFor="maxGrade">العلامة القصوى</Label>
                  <Input
                    id="maxGrade"
                    type="number"
                    min="1"
                    max="1000"
                    value={tempMaxGrade}
                    onChange={(e) => {
                      const newMax = parseInt(e.target.value) || 100;
                      setTempMaxGrade(newMax);
                      // إذا كان الحد المطلق أكبر من العلامة القصوى الجديدة، نحدّثه
                      if (tempThresholdType === 'absolute' && tempPassingThreshold > newMax) {
                        setTempPassingThreshold(newMax);
                      }
                    }}
                    className="text-center text-lg rounded-2xl"
                  />
                </div>
              )}
              
              {isTotalView && (
                <div className="space-y-2">
                  <Label>العلامة القصوى (محسوبة تلقائياً)</Label>
                  <div className="text-center text-lg py-3 px-4 bg-muted/50 rounded-2xl font-bold text-primary">
                    {tempMaxGrade}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    مجموع العلامات القصوى من جميع المواد
                  </p>
                </div>
              )}
              
              {/* فقط للسبر والتسميع والنشاط */}
              {!isTotalView && (editingGradeType === 'board_grades' || editingGradeType === 'recitation_grades' || editingGradeType === 'activity_grade') && (
                <div className="space-y-2">
                  <Label htmlFor="calculationType">طريقة إدخال العلامات</Label>
                  <Select
                    value={tempCalculationType}
                    onValueChange={(value: 'direct' | 'automatic_average') => {
                      setTempCalculationType(value);
                    }}
                  >
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">إدخال مباشر</SelectItem>
                      <SelectItem value="automatic_average">متوسط حسابي تلقائي</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tempCalculationType === 'direct' 
                      ? '✏️ يمكنك إدخال العلامة مباشرة. العلامات من الصفحة اليومية لن تؤثر على هذا الحقل.'
                      : '🔄 سيتم حساب المتوسط تلقائياً من العلامات المدخلة في الصفحة اليومية. لا يمكن التعديل اليدوي.'
                    }
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="thresholdType">نوع حد الرسوب</Label>
                <Select
                  value={tempThresholdType}
                  onValueChange={(value: 'percentage' | 'absolute') => {
                    // عند تغيير النوع، نحول القيمة تلقائياً
                    if (value === 'percentage' && tempThresholdType === 'absolute') {
                      // من علامة مباشرة إلى نسبة مئوية
                      const percentage = tempMaxGrade > 0 ? (tempPassingThreshold / tempMaxGrade) * 100 : 50;
                      setTempPassingThreshold(Math.min(100, Math.max(0, percentage)));
                    } else if (value === 'absolute' && tempThresholdType === 'percentage') {
                      // من نسبة مئوية إلى علامة مباشرة
                      const absolute = (tempPassingThreshold / 100) * tempMaxGrade;
                      setTempPassingThreshold(Math.min(tempMaxGrade, Math.max(0, Math.round(absolute))));
                    }
                    setTempThresholdType(value);
                  }}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                    <SelectItem value="absolute">علامة مباشرة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="passingThreshold">
                  {tempThresholdType === 'percentage' ? 'حد الرسوب (نسبة مئوية)' : 'حد الرسوب (علامة مباشرة)'}
                </Label>
                <Input
                  id="passingThreshold"
                  type="number"
                  min="0"
                  max={tempThresholdType === 'percentage' ? 100 : tempMaxGrade}
                  step={tempThresholdType === 'percentage' ? 0.1 : 1}
                  value={tempPassingThreshold}
                  onChange={(e) => {
                    const value = tempThresholdType === 'percentage' 
                      ? parseFloat(e.target.value) || 50
                      : parseInt(e.target.value) || 50;
                    setTempPassingThreshold(value);
                  }}
                  className="text-center text-lg rounded-2xl"
                  placeholder={tempThresholdType === 'percentage' ? '50' : '50'}
                />
                {tempThresholdType === 'absolute' && (
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    يجب أن تكون أقل من أو تساوي {tempMaxGrade}
                  </p>
                )}
                {tempThresholdType === 'percentage' && (
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    أي علامة أقل من {tempPassingThreshold}% من العلامة القصوى تعتبر راسبة
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingGradeType(null)}
                className="rounded-xl"
              >
                إلغاء
              </Button>
              <Button onClick={saveMaxGrade} className="rounded-xl">
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Switch Confirmation Dialog */}
        <ConfirmationDialog
          open={switchConfirmOpen}
          onOpenChange={setSwitchConfirmOpen}
          title="تأكيد التغيير"
          description={`لديك ${pendingGrades.size} تغيير غير محفوظ. هل تريد المتابعة وفقدان هذه التغييرات؟`}
          confirmText="متابعة"
          cancelText="إلغاء"
          variant="destructive"
          onConfirm={handleSwitchConfirm}
        />
      </div>
    </div>
  );
};

export default StudentAcademicInfoPage;

