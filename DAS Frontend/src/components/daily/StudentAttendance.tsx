import React, { useState, useEffect } from 'react';
import { Users, Search, UserCheck, UserX, Save, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { toast } from '@/components/ui/use-toast';
import api from '@/services/api';

interface Student {
  id: number;
  full_name: string;
  grade_number: number;
  section: string;
  session_type?: string;
  is_present?: boolean;
}

interface Class {
  id: number;
  grade_number: number;
  section_count: number;
  grade_level: string;
}

interface StudentAttendanceProps {
  academicYearId: number;
  sessionType: string;
  selectedDate: string;
}

export function StudentAttendance({ academicYearId, sessionType, selectedDate }: StudentAttendanceProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [absentStudentIds, setAbsentStudentIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, [academicYearId, sessionType]);

  useEffect(() => {
    if (selectedClassId && selectedSection) {
      fetchStudents();
    }
  }, [selectedClassId, selectedSection, selectedDate, sessionType]);

  // الحصول على قائمة المراحل المتاحة
  const getAvailableGradeLevels = (): string[] => {
    const levels = new Set(classes.map(c => c.grade_level));
    const order: Record<string, number> = {
      primary: 1,
      intermediate: 2,
      secondary: 3
    };

    return Array.from(levels).sort((a, b) => {
      const orderA = order[a] ?? 99;
      const orderB = order[b] ?? 99;
      if (orderA === orderB) {
        return a.localeCompare(b);
      }
      return orderA - orderB;
    });
  };

  // تصفية الصفوف حسب المرحلة المختارة
  const getFilteredClasses = (): Class[] => {
    if (!selectedGradeLevel) return classes;
    return classes.filter(c => c.grade_level === selectedGradeLevel);
  };

  const fetchClasses = async () => {
    try {
      const response = await api.get(`/academic/classes?academic_year_id=${academicYearId}&session_type=${sessionType}`);
      setClasses(response.data as Class[]);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchStudents = async () => {
    if (!selectedClassId || !selectedSection) {
      console.log('Missing classId or section');
      return;
    }
    
    setLoading(true);
    try {
      const selectedClass = classes.find(c => c.id === selectedClassId);
      console.log('Fetching students with params (by grade/year):', { 
        academicYearId,
        grade_level: selectedClass?.grade_level,
        grade_number: selectedClass?.grade_number,
        section: selectedSection,
        sessionType
      });

      // جلب جميع طلاب هذه السنة والصف
      const studentsResponse = await api.get(`/students/?academic_year_id=${academicYearId}&grade_level=${selectedClass?.grade_level}&grade_number=${selectedClass?.grade_number}`);
      const allStudents = (studentsResponse.data as Student[]) || [];

      // تصفية حسب الشعبة ونوع الدوام محليًا (مثل صفحة المعلومات الشخصية)
      const studentsData = allStudents.filter(s => 
        s.section === selectedSection &&
        (!sessionType || s.session_type === sessionType)
      );
      console.log('Students response:', {
        total: studentsData?.length || 0,
        data: studentsData
      });
      console.log('Request URL:', `/students/?class_id=${selectedClassId}&section=${selectedSection}&academic_year_id=${academicYearId}&session_type=${sessionType}`);
      
      // احصل على حضور اليوم (مع تصفية حسب نوع الدوام)
      console.log(`[FRONTEND] Fetching attendance for session: ${sessionType}`);
      const attendanceResponse = await api.get(
        `/daily/attendance/students?class_id=${selectedClassId}&section=${selectedSection}&attendance_date=${selectedDate}&academic_year_id=${academicYearId}&session_type=${sessionType}`
      );
      
      const attendanceData = attendanceResponse.data as Array<{student_id: number, is_present: boolean}>;
      console.log('[FRONTEND] Attendance data received:', attendanceData);
      
      const attendanceMap = new Map(
        attendanceData.map((a) => [a.student_id, a.is_present])
      );
      
      const studentsWithAttendance = studentsData.map((student) => ({
        ...student,
        is_present: attendanceMap.get(student.id) ?? true
      }));
      
      console.log('[FRONTEND] Students with attendance:', studentsWithAttendance.map(s => ({
        id: s.id,
        name: s.full_name,
        is_present: s.is_present
      })));
      
      setStudents(studentsWithAttendance);
      console.log('Total students loaded:', studentsWithAttendance.length);
      
      // تحديث قائمة الغائبين
      const absent = new Set<number>(
        studentsWithAttendance
          .filter((s) => !s.is_present)
          .map((s) => s.id)
      );
      setAbsentStudentIds(absent);
    } catch (error) {
      console.error('Error fetching students:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      let errorMessage = 'حدث خطأ أثناء جلب بيانات الطلاب';
      if (error instanceof Error) {
        errorMessage = `${errorMessage}: ${error.message}`;
      }
      toast({
        title: 'خطأ',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentAttendance = (studentId: number) => {
    setAbsentStudentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
      await api.post('/daily/attendance/students/bulk', {
        academic_year_id: academicYearId,
        attendance_date: selectedDate,
        class_id: selectedClassId,
        section: selectedSection,
        session_type: sessionType,
        absent_student_ids: Array.from(absentStudentIds)
      });
      
      toast({
        title: 'تم بنجاح',
        description: 'تم حفظ الحضور بنجاح',
        duration: 3000
      });
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حفظ الحضور',
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const presentCount = students.length - absentStudentIds.size;
  const absentCount = absentStudentIds.size;

  return (
    <Card className="ios-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="w-5 h-5" />
          حضور الطلاب
        </CardTitle>
        <CardDescription className="mt-1">
          سجل حضور وغياب الطلاب للفترة {sessionType === 'morning' ? 'الصباحية' : 'المسائية'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* اختيار المرحلة والصف والشعبة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>المرحلة</Label>
            <Select value={selectedGradeLevel} onValueChange={(val) => {
              setSelectedGradeLevel(val);
              setSelectedClassId(null);
              setSelectedSection('');
            }}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المرحلة" />
              </SelectTrigger>
              <SelectContent>
                {getAvailableGradeLevels().map(level => (
                  <SelectItem key={level} value={level}>
                    {level === 'primary' ? 'الابتدائية' : level === 'intermediate' ? 'الإعدادية' : 'الثانوية'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>الصف</Label>
            <Select value={selectedClassId?.toString()} onValueChange={(val) => {
              setSelectedClassId(parseInt(val));
              setSelectedSection('');
            }} disabled={!selectedGradeLevel}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الصف" />
              </SelectTrigger>
              <SelectContent>
                {getFilteredClasses().map(cls => (
                  <SelectItem key={cls.id} value={cls.id.toString()}>
                    الصف {cls.grade_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>الشعبة</Label>
            <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedClassId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الشعبة" />
              </SelectTrigger>
              <SelectContent>
                {selectedClassId && classes.find(c => c.id === selectedClassId)?.section_count &&
                  Array.from({ length: classes.find(c => c.id === selectedClassId)!.section_count }, (_, i) => 
                    String(i + 1)
                  ).map(section => (
                    <SelectItem key={section} value={section}>
                      الشعبة {section}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedClassId && selectedSection && (
          <>
            {/* إحصائيات */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="ios-card border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">حاضر</span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{presentCount}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="ios-card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">غائب</span>
                    </div>
                    <span className="text-2xl font-bold text-red-600 dark:text-red-400">{absentCount}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="ios-card border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">المجموع</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">{students.length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* شريط البحث */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="ابحث عن طالب..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>

            {/* قائمة الطلاب */}
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-2"></div>
                  <p>جاري تحميل الطلاب...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>لا يوجد طلاب في هذه الشعبة</p>
                </div>
              ) : (
                filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 ${
                      absentStudentIds.has(student.id)
                        ? 'bg-destructive/10 border-destructive'
                        : 'bg-primary/10 border-primary'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {absentStudentIds.has(student.id) ? (
                        <UserX className="h-5 w-5 text-destructive" />
                      ) : (
                        <UserCheck className="h-5 w-5 text-primary" />
                      )}
                      <span className="font-semibold text-foreground">{student.full_name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={absentStudentIds.has(student.id) ? 'destructive' : 'default'}
                      onClick={() => toggleStudentAttendance(student.id)}
                      className="min-w-[80px]"
                    >
                      {absentStudentIds.has(student.id) ? 'غائب' : 'حاضر'}
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* زر الحفظ */}
            <Button 
              onClick={handleSaveAttendance} 
              className="w-full" 
              size="lg"
              disabled={saving || students.length === 0}
            >
              <Save className="h-5 w-5 ml-2" />
              {saving ? 'جاري الحفظ...' : 'حفظ الحضور'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
