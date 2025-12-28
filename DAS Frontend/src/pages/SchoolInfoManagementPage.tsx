import React, { useState, useEffect } from 'react';
import { Plus, Users, BookOpen, GraduationCap, Layers, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/services/api';
import type { Class, Student, Teacher, SessionType, GradeLevel } from '@/types/school';
import { toast } from '@/hooks/use-toast';
import { defaultGradeTemplates, getGradeLabel } from '@/lib/defaultSchoolData';
import { useAuth } from '@/contexts/AuthContext';

const SchoolInfoManagementPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: authState } = useAuth();
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<number | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasDefaultClasses, setHasDefaultClasses] = useState(false);
  
  // Confirmation dialog states
  const [showCreateDefaultClassesConfirm, setShowCreateDefaultClassesConfirm] = useState(false);
  const [deleteClassInfo, setDeleteClassInfo] = useState<{id: number, name: string} | null>(null);

  // Determine session type based on user role
  const getUserSessionType = (): SessionType | undefined => {
    if (authState.user?.role === 'morning_school') return 'morning';
    if (authState.user?.role === 'evening_school') return 'evening';
    // Director can see both - return undefined to not filter
    return undefined;
  };

  useEffect(() => {
    // Check if academic year is passed from search navigation
    const stateYearId = (location.state as any)?.academicYearId;

    if (stateYearId) {
      // Use the year from navigation state
      setSelectedAcademicYear(stateYearId);
    } else {
      // Load selected academic year from localStorage
      const yearId = localStorage.getItem('selected_academic_year_id');
      if (yearId) {
        const parsedId = parseInt(yearId, 10);
        if (!isNaN(parsedId)) {
          setSelectedAcademicYear(parsedId);
        }
      }
    }

    // Listen for academic year changes
    const handleYearChange = (event: CustomEvent) => {
      const newYearId = event.detail?.yearId;
      if (newYearId) {
        setSelectedAcademicYear(newYearId);
      }
    };

    window.addEventListener('academicYearChanged' as any, handleYearChange);

    return () => {
      window.removeEventListener('academicYearChanged' as any, handleYearChange);
    };
  }, [location.state]);

  useEffect(() => {
    if (selectedAcademicYear) {
      loadData();
    }
  }, [selectedAcademicYear]);

  const loadData = async () => {
    if (!selectedAcademicYear) return;

    try {
      setLoading(true);

      // Load classes filtered by academic year and session type (for non-directors)
      const sessionTypeFilter = getUserSessionType();
      const classesParams: any = { academic_year_id: selectedAcademicYear };
      if (sessionTypeFilter) {
        classesParams.session_type = sessionTypeFilter;
      }
      const classesResponse = await api.academic.getClasses(classesParams);
      const allClasses = Array.isArray(classesResponse) ? classesResponse : (classesResponse?.data || []);
      setClasses(allClasses);

      // Check if default classes exist
      setHasDefaultClasses(allClasses.length > 0);

      // Load students (filter by session type for non-directors)
      const studentsResponse = await api.students.getAll({ academic_year_id: selectedAcademicYear });
      let allStudents = Array.isArray(studentsResponse) ? studentsResponse : (studentsResponse?.data || []);

      // Filter students by session type if not a director
      if (sessionTypeFilter) {
        allStudents = allStudents.filter((s: Student) => s.session_type === sessionTypeFilter);
      }
      setStudents(allStudents);

      // Load teachers
      const teachersResponse = await api.teachers.getAll({ academic_year_id: selectedAcademicYear });
      const allTeachers = Array.isArray(teachersResponse) ? teachersResponse : (teachersResponse?.data || []);
      setTeachers(allTeachers);

      // Load teacher assignments for all teachers
      const assignmentsPromises = allTeachers.map(async (teacher: Teacher) => {
        if (teacher.id) {
          try {
            const response = await api.teachers.getAssignments(teacher.id, {
              academic_year_id: selectedAcademicYear
            });
            return response.success && response.data ? response.data : [];
          } catch (error) {

            return [];
          }
        }
        return [];
      });

      const allAssignments = await Promise.all(assignmentsPromises);
      const flatAssignments = allAssignments.flat();
      setTeacherAssignments(flatAssignments);
    } catch (error) {

      toast({
        title: 'خطأ',
        description: 'فشل في تحميل البيانات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDefaultClasses = async () => {
    if (!selectedAcademicYear) return;
    
    // Show confirmation dialog
    setShowCreateDefaultClassesConfirm(true);
  };
  
  const confirmCreateDefaultClasses = async () => {
    if (!selectedAcademicYear) {
      setShowCreateDefaultClassesConfirm(false);
      return;
    }

    try {
      setLoading(true);

      // Get the session type to create classes for
      const sessionType = getUserSessionType() || 'morning'; // Default to morning if director hasn't specified

      for (const template of defaultGradeTemplates) {
        const classData = {
          academic_year_id: selectedAcademicYear,
          session_type: sessionType as SessionType,
          grade_level: template.grade_level as GradeLevel,
          grade_number: template.grade_number,
          section_count: template.default_section_count,
        };

        // Create class
        const createdClassResponse = await api.classes.create(classData);

        // Extract class from response - handle both direct Class and ApiResponse<Class>
        let createdClass: Class;
        if ('data' in createdClassResponse && createdClassResponse.data) {
          createdClass = createdClassResponse.data;
        } else {
          // Assume response is directly a Class object
          createdClass = createdClassResponse as unknown as Class;
        }

        if (!createdClass || !createdClass.id) {
          throw new Error('Failed to create class: Invalid response - missing class ID');
        }

        const classId = createdClass.id;

        // Create default subjects for this class
        for (const subject of template.subjects) {
          const subjectData = {
            class_id: classId,
            subject_name: subject.name,
            weekly_hours: subject.weekly_hours,
            is_active: true,
          };

          try {
            await api.subjects.create(subjectData);
          } catch (subjectError: any) {

            throw subjectError;
          }
        }
      }

      toast({
        title: 'نجح',
        description: 'تم إنشاء جميع الصفوف والمواد الافتراضية بنجاح (12 صفًا)',
      });

      // Reload data
      loadData();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.response?.data?.detail || error.message || 'فشل في إنشاء الصفوف الافتراضية',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setShowCreateDefaultClassesConfirm(false);
    }
  };

  const handleDeleteClass = (classId: number, className: string) => {
    // Show confirmation dialog
    setDeleteClassInfo({ id: classId, name: className });
  };
  
  const confirmDeleteClass = async () => {
    if (!deleteClassInfo) return;
    const { id: classId } = deleteClassInfo;

    try {
      setLoading(true);

      await api.classes.delete(classId);

      toast({
        title: 'نجح',
        description: 'تم حذف الصف بنجاح',
      });

      // Reload data
      loadData();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.response?.data?.detail || error.message || 'فشل في حذف الصف',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setDeleteClassInfo(null);
    }
  };

  // Helper function to count teachers for a specific class
  const getTeachersForClass = (classId: number) => {
    const teacherIds = new Set(
      teacherAssignments
        .filter(assignment => assignment.class_id === classId)
        .map(assignment => assignment.teacher_id)
    );
    return teacherIds.size;
  };

  // Calculate statistics
  const totalSections = classes.reduce((sum, cls) => sum + cls.section_count, 0);

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" />
              داشبورد معلومات المدرسة
            </h1>
            <p className="text-muted-foreground mt-1">نظرة عامة على إحصائيات المدرسة</p>
          </div>
        </div>

        {!selectedAcademicYear && (
          <Card className="border-accent bg-accent/10 dark:bg-accent/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-accent" />
                <p className="text-accent-foreground">
                  يرجى اختيار سنة دراسية من القائمة الجانبية لعرض المعلومات
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics Cards */}
        {selectedAcademicYear && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Students Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">عدد الطلاب الكلي</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{students.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    طالب في المدرسة
                  </p>
                </CardContent>
              </Card>

              {/* Total Teachers Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">عدد الأساتذة</CardTitle>
                  <GraduationCap className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{teachers.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    أستاذ في المدرسة
                  </p>
                </CardContent>
              </Card>

              {/* Total Classes Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">عدد الصفوف</CardTitle>
                  <BookOpen className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{classes.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    صف دراسي
                  </p>
                </CardContent>
              </Card>

              {/* Total Sections Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">عدد الشُعَب</CardTitle>
                  <Layers className="h-4 w-4 text-secondary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalSections}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    شعبة في المدرسة
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Add New Grade Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>إضافة صف جديد</CardTitle>
                  <CardDescription>
                    أنشئ صفًا جديدًا وحدد المواد والشعب
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => navigate('/school-info/add-grade')}
                    className="w-full"
                    size="lg"
                  >
                    <Plus className="ml-2 h-5 w-5" />
                    إضافة صف جديد
                  </Button>
                </CardContent>
              </Card>

              {/* Create Default Classes Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>إضافة معلومات افتراضية</CardTitle>
                  <CardDescription>
                    {hasDefaultClasses
                      ? 'تم إنشاء الصفوف الافتراضية مسبقًا'
                      : 'إنشاء جميع الصفوف مع المواد الافتراضية'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleCreateDefaultClasses}
                    disabled={hasDefaultClasses || loading}
                    variant={hasDefaultClasses ? 'secondary' : 'default'}
                    className="w-full"
                    size="lg"
                  >
                    <BookOpen className="ml-2 h-5 w-5" />
                    {hasDefaultClasses ? 'تم الإنشاء بالفعل' : 'إنشاء الصفوف الافتراضية'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Classes List Section */}
            <Card>
              <CardHeader>
                <CardTitle>قائمة الصفوف</CardTitle>
                <CardDescription>
                  {classes.length === 0 ? 'لا توجد صفوف بعد' : `${classes.length} صف في هذه السنة`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
                ) : classes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد صفوف. اضغط على "إضافة صف جديد" أو "إنشاء الصفوف الافتراضية".
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {classes.map((cls) => {
                      const studentsInClass = students.filter(
                        s => s.grade_level === cls.grade_level &&
                             s.grade_number === cls.grade_number &&
                             s.session_type === cls.session_type
                      );

                      const teachersCount = cls.id ? getTeachersForClass(cls.id) : 0;

                      return (
                        <Card key={cls.id} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">
                              {getGradeLabel(cls.grade_level, cls.grade_number)}
                            </CardTitle>
                            <CardDescription>
                              {cls.session_type === 'morning' ? 'صباحي' : 'مسائي'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">عدد الشعب:</span>
                                <span className="font-medium">{cls.section_count}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">عدد الطلاب:</span>
                                <span className="font-medium">{studentsInClass.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">عدد الأساتذة:</span>
                                <span className="font-medium text-green-600 dark:text-green-400">{teachersCount}</span>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => navigate(`/school-info/edit-grade/${cls.id}`)}
                              >
                                <Edit className="ml-2 h-4 w-4" />
                                تعديل
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClass(cls.id!, getGradeLabel(cls.grade_level, cls.grade_number));
                                }}
                              >
                                <Trash2 className="ml-2 h-4 w-4" />
                                حذف
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
      
      {/* Create Default Classes Confirmation Dialog */}
      <ConfirmationDialog
        open={showCreateDefaultClassesConfirm}
        onOpenChange={setShowCreateDefaultClassesConfirm}
        title="تأكيد إنشاء الصفوف الافتراضية"
        description="هل أنت متأكد من إنشاء جميع الصفوف الافتراضية (12 صفًا مع موادهم)؟"
        confirmText="نعم، أنشئ الصفوف"
        cancelText="إلغاء"
        onConfirm={confirmCreateDefaultClasses}
        variant="default"
      />
      
      {/* Delete Class Confirmation Dialog */}
      <ConfirmationDialog
        open={!!deleteClassInfo}
        onOpenChange={(open) => !open && setDeleteClassInfo(null)}
        title={`حذف الصف ${deleteClassInfo?.name || ''}`}
        description={`هل أنت متأكد من حذف الصف "${deleteClassInfo?.name || ''}"؟\n\nتحذير: سيتم حذف جميع المواد والمعلومات المرتبطة بهذا الصف.`}
        confirmText="نعم، احذف"
        cancelText="إلغاء"
        onConfirm={confirmDeleteClass}
        variant="destructive"
      />
    </div>
  );
};

export default SchoolInfoManagementPage;
