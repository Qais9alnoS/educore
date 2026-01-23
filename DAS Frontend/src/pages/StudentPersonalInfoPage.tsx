import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Edit, Trash2, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { IOSSwitch } from '@/components/ui/ios-switch';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { api } from '@/services/api';
import type { Student, Class, AcademicYear } from '@/types/school';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const StudentPersonalInfoPage = () => {
  const location = useLocation();
  const { state: authState } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<number | null>(null);
  const [selectedSessionType, setSelectedSessionType] = useState<'morning' | 'evening' | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [pendingStudentId, setPendingStudentId] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<number | null>(null);
  const processedPreselectionRef = React.useRef(false);
  const classSelectionProcessedRef = React.useRef(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Student>>({
    full_name: '',
    has_special_needs: false,
    special_needs_details: '',
    father_name: '',
    grandfather_name: '',
    mother_name: '',
    birth_date: '',
    birth_place: '',
    nationality: '',
    father_occupation: '',
    mother_occupation: '',
    religion: '',
    gender: 'male',
    transportation_type: 'walking',
    bus_number: '',
    landline_phone: '',
    father_phone: '',
    mother_phone: '',
    additional_phone: '',
    detailed_address: '',
    previous_school: '',
    grade_level: 'primary',
    grade_number: 1,
    section: '',
    session_type: 'morning',
    ninth_grade_total: undefined,
    notes: '',
  });

  const loadClasses = async (academicYearId: number, sessionType: 'morning' | 'evening') => {
    try {
      setClassesLoading(true);
      setClassesError(null);
      console.log('=== Loading Classes Debug ===');
      console.log('Academic Year ID:', academicYearId);
      console.log('Academic Year ID Type:', typeof academicYearId);
      console.log('Session Type:', sessionType);
      
      const response = await api.academic.getClasses({ 
        academic_year_id: academicYearId,
        session_type: sessionType
      });
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
    console.log('=== Initializing Student Personal Info Page ===');
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
        setClassesError('معرّف السنة الدراسية غير صالح. يرجى اختيار سنة دراسية من صفحة السنوات الدراسية.');
        console.error('Invalid academic year ID:', yearId);
      }
    } else {
      setClassesError('لم يتم اختيار سنة دراسية. يرجى اختيار سنة من صفحة السنوات الدراسية.');
      console.warn('No academic year selected in localStorage');
    }
  }, [authState.user?.role]);

  // Load students when class and section change
  useEffect(() => {
    if (selectedClass && selectedSection) {
      loadStudents();
    }
  }, [selectedClass, selectedSection]);

  // Handle preselected state from navigation (e.g., from search)
  useEffect(() => {
    const state = location.state as any;
    if (state?.preselected && !processedPreselectionRef.current) {
      // Wait for dependencies to be ready before processing
      if (!selectedAcademicYear || !authState.user) {
        return;
      }

      const { gradeLevel, gradeNumber, section, sessionType, studentId, openPopup } = state.preselected;
      
      console.log('=== Processing Preselected Student ===');
      console.log('Grade Level:', gradeLevel);
      console.log('Grade Number:', gradeNumber);
      console.log('Section:', section);
      console.log('Session Type:', sessionType);
      console.log('Student ID:', studentId);
      console.log('Open Popup:', openPopup);
      
      processedPreselectionRef.current = true;

      // For directors, set the session type and load classes
      if (authState.user.role === 'director' && sessionType) {
        setSelectedSessionType(sessionType);
        loadClasses(selectedAcademicYear, sessionType).then(() => {
          // After classes are loaded, find and select the matching class
          // This will be handled in the next effect when classes update
        });
      }
      
      // Clear the state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state, authState.user, selectedAcademicYear]);

  // Handle class selection after classes are loaded from preselected state
  useEffect(() => {
    const state = location.state as any;
    if (state?.preselected && classes.length > 0 && !classSelectionProcessedRef.current) {
      const { gradeLevel, gradeNumber, section, studentId, openPopup } = state.preselected;
      
      console.log('Available Classes:', classes);
      
      // Find the class that matches both grade_level AND grade_number
      const matchingClass = classes.find(c => 
        c.grade_level === gradeLevel && c.grade_number === gradeNumber
      );
      
      if (matchingClass) {
        console.log('Found matching class:', matchingClass);
        setSelectedClass(matchingClass.id);
        setSelectedSection(section);
        classSelectionProcessedRef.current = true;
        
        // Store the student ID to open popup after students load
        if (openPopup && studentId) {
          setPendingStudentId(studentId);
        }
      } else {
        console.warn('No matching class found for grade level:', gradeLevel, 'grade number:', gradeNumber);
      }
    }
  }, [classes]);

  // Open popup for pending student after students are loaded
  useEffect(() => {
    if (pendingStudentId && students.length > 0 && !loading) {
      const student = students.find(s => s.id === pendingStudentId);
      if (student) {
        console.log('Opening popup for preselected student:', student);
        handleEdit(student);
        setPendingStudentId(null); // Clear the pending ID
      }
    }
  }, [pendingStudentId, students, loading]);

  const loadStudents = async () => {
    if (!selectedAcademicYear || !selectedClass || !selectedSection) return;
    
    try {
      setLoading(true);
      const selectedClassData = classes.find(c => c.id === selectedClass);
      
      const response = await api.students.getAll({
        academic_year_id: selectedAcademicYear,
        grade_level: selectedClassData?.grade_level,
        grade_number: selectedClassData?.grade_number,
      });
      
      // Handle both direct array and wrapped response
      const allStudents = Array.isArray(response) ? response : (response?.data || []);
      
      // Filter by section and session type
      const filteredStudents = allStudents.filter(s => 
        s.section === selectedSection && 
        (!selectedSessionType || s.session_type === selectedSessionType)
      );
      
      // Sort alphabetically by name
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcademicYear) return;

    try {
      setLoading(true);
      const selectedClassData = classes.find(c => c.id === selectedClass);
      
      const studentData: Omit<Student, 'id' | 'created_at' | 'updated_at'> = {
        ...formData as Omit<Student, 'id' | 'created_at' | 'updated_at'>,
        academic_year_id: selectedAcademicYear,
        grade_level: selectedClassData?.grade_level || 'primary',
        grade_number: selectedClassData?.grade_number || 1,
        section: selectedSection,
        session_type: selectedSessionType || 'morning',
        is_active: true,
      };

      if (editingStudent) {
        await api.students.update(editingStudent.id, studentData);
        toast({
          title: 'نجح',
          description: 'تم تحديث بيانات الطالب بنجاح',
        });
      } else {
        await api.students.create(studentData);
        toast({
          title: 'نجح',
          description: 'تم إضافة الطالب بنجاح',
        });
      }

      setIsDialogOpen(false);
      setEditingStudent(null);
      resetForm();
      loadStudents();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حفظ بيانات الطالب',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      full_name: student.full_name,
      has_special_needs: student.has_special_needs,
      special_needs_details: student.special_needs_details || '',
      father_name: student.father_name,
      grandfather_name: student.grandfather_name,
      mother_name: student.mother_name,
      birth_date: student.birth_date,
      birth_place: student.birth_place || '',
      nationality: student.nationality || '',
      father_occupation: student.father_occupation || '',
      mother_occupation: student.mother_occupation || '',
      religion: student.religion || '',
      gender: student.gender,
      transportation_type: student.transportation_type,
      bus_number: student.bus_number || '',
      landline_phone: student.landline_phone || '',
      father_phone: student.father_phone || '',
      mother_phone: student.mother_phone || '',
      additional_phone: student.additional_phone || '',
      detailed_address: student.detailed_address || '',
      previous_school: student.previous_school || '',
      grade_level: student.grade_level,
      grade_number: student.grade_number,
      section: student.section || '',
      session_type: student.session_type,
      ninth_grade_total: student.ninth_grade_total,
      notes: student.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (studentId: number) => {
    setStudentToDelete(studentId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteStudent = async () => {
    if (studentToDelete === null) return;

    try {
      await api.students.deactivate(studentToDelete);
      toast({
        title: 'نجح',
        description: 'تم حذف الطالب بنجاح',
      });
      loadStudents();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في حذف الطالب',
        variant: 'destructive'
      });
    } finally {
      setDeleteConfirmOpen(false);
      setStudentToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      has_special_needs: false,
      special_needs_details: '',
      father_name: '',
      grandfather_name: '',
      mother_name: '',
      birth_date: '',
      birth_place: '',
      nationality: '',
      father_occupation: '',
      mother_occupation: '',
      religion: '',
      gender: 'male',
      transportation_type: 'walking',
      bus_number: '',
      landline_phone: '',
      father_phone: '',
      mother_phone: '',
      additional_phone: '',
      detailed_address: '',
      previous_school: '',
      grade_level: 'primary',
      grade_number: 1,
      section: '',
      session_type: selectedSessionType || 'morning',
      ninth_grade_total: undefined,
      notes: '',
    });
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

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.father_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">معلومات شخصية - الطلاب</h1>
            <p className="text-muted-foreground mt-1">إدارة المعلومات الشخصية للطلاب</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>اختيار الصف والشعبة</CardTitle>
            <CardDescription>اختر الصف والشعبة لعرض وإدارة الطلاب</CardDescription>
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
                  إعادة المحاولة
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
                    onValueChange={setSelectedSection}
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Students List */}
        {selectedClass && selectedSection && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>قائمة الطلاب</CardTitle>
                  <CardDescription>
                    {students.length} طالب في هذه الشعبة
                  </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) {
                    setEditingStudent(null);
                    resetForm();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="ml-2 h-4 w-4" />
                      إضافة طالب جديد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
                      </DialogTitle>
                      <DialogDescription>
                        أدخل المعلومات الشخصية للطالب
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Basic Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">المعلومات الأساسية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="full_name">اسم الطالب الكامل*</Label>
                            <Input
                              id="full_name"
                              value={formData.full_name}
                              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="gender">الجنس*</Label>
                            <Select
                              value={formData.gender}
                              onValueChange={(value: 'male' | 'female') => setFormData({ ...formData, gender: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">ذكر</SelectItem>
                                <SelectItem value="female">أنثى</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="birth_date">تاريخ الميلاد*</Label>
                            <DatePicker
                              value={formData.birth_date ? new Date(formData.birth_date) : undefined}
                              onChange={(date) => {
                                if (date) {
                                  setFormData({ ...formData, birth_date: format(date, 'yyyy-MM-dd') });
                                }
                              }}
                              className="w-full"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="birth_place">مكان الولادة</Label>
                            <Input
                              id="birth_place"
                              value={formData.birth_place}
                              onChange={(e) => setFormData({ ...formData, birth_place: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="nationality">الجنسية</Label>
                            <Input
                              id="nationality"
                              value={formData.nationality}
                              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="religion">الديانة</Label>
                            <Input
                              id="religion"
                              value={formData.religion}
                              onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Family Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">معلومات العائلة</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="father_name">اسم الأب*</Label>
                            <Input
                              id="father_name"
                              value={formData.father_name}
                              onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="grandfather_name">اسم الجد (أب الأب)*</Label>
                            <Input
                              id="grandfather_name"
                              value={formData.grandfather_name}
                              onChange={(e) => setFormData({ ...formData, grandfather_name: e.target.value })}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="mother_name">اسم الأم*</Label>
                            <Input
                              id="mother_name"
                              value={formData.mother_name}
                              onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="father_occupation">عمل الولي</Label>
                            <Input
                              id="father_occupation"
                              value={formData.father_occupation}
                              onChange={(e) => setFormData({ ...formData, father_occupation: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="mother_occupation">عمل الأم (اختياري)</Label>
                            <Input
                              id="mother_occupation"
                              value={formData.mother_occupation}
                              onChange={(e) => setFormData({ ...formData, mother_occupation: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Contact Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">معلومات الاتصال</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="father_phone">رقم هاتف الأب</Label>
                            <Input
                              id="father_phone"
                              type="tel"
                              value={formData.father_phone}
                              onChange={(e) => setFormData({ ...formData, father_phone: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="mother_phone">رقم هاتف الأم</Label>
                            <Input
                              id="mother_phone"
                              type="tel"
                              value={formData.mother_phone}
                              onChange={(e) => setFormData({ ...formData, mother_phone: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="landline_phone">رقم أرضي</Label>
                            <Input
                              id="landline_phone"
                              type="tel"
                              value={formData.landline_phone}
                              onChange={(e) => setFormData({ ...formData, landline_phone: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="additional_phone">رقم هاتف إضافي</Label>
                            <Input
                              id="additional_phone"
                              type="tel"
                              value={formData.additional_phone}
                              onChange={(e) => setFormData({ ...formData, additional_phone: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="detailed_address">العنوان التفصيلي</Label>
                            <Input
                              id="detailed_address"
                              value={formData.detailed_address}
                              onChange={(e) => setFormData({ ...formData, detailed_address: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Transportation */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">النقل</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="transportation_type">نوع النقل*</Label>
                            <Select
                              value={formData.transportation_type}
                              onValueChange={(value: 'walking' | 'full_bus' | 'half_bus_to_school' | 'half_bus_from_school') => setFormData({ ...formData, transportation_type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="walking">مشي</SelectItem>
                                <SelectItem value="full_bus">باص كامل (ذهاب وإياب)</SelectItem>
                                <SelectItem value="half_bus_to_school">نص باص (ذهاب فقط)</SelectItem>
                                <SelectItem value="half_bus_from_school">نص باص (إياب فقط)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {formData.transportation_type !== 'walking' && (
                            <div className="space-y-2">
                              <Label htmlFor="bus_number">رقم السيارة/الباص</Label>
                              <Input
                                id="bus_number"
                                value={formData.bus_number}
                                onChange={(e) => setFormData({ ...formData, bus_number: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Special Needs */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">حالة خاصة</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="has_special_needs">لديه حالة خاصة؟</Label>
                            <IOSSwitch
                              id="has_special_needs"
                              checked={formData.has_special_needs}
                              onCheckedChange={(checked) => setFormData({ ...formData, has_special_needs: checked })}
                            />
                          </div>

                          {formData.has_special_needs && (
                            <div className="space-y-2">
                              <Label htmlFor="special_needs_details">تفاصيل الحالة الخاصة</Label>
                              <Input
                                id="special_needs_details"
                                value={formData.special_needs_details}
                                onChange={(e) => setFormData({ ...formData, special_needs_details: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">معلومات إضافية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="previous_school">المدرسة السابقة</Label>
                            <Input
                              id="previous_school"
                              value={formData.previous_school}
                              onChange={(e) => setFormData({ ...formData, previous_school: e.target.value })}
                            />
                          </div>

                          {formData.grade_level === 'secondary' && (
                            <div className="space-y-2">
                              <Label htmlFor="ninth_grade_total">مجموع التاسع</Label>
                              <Input
                                id="ninth_grade_total"
                                type="number"
                                step="0.01"
                                value={formData.ninth_grade_total || ''}
                                onChange={(e) => setFormData({ ...formData, ninth_grade_total: parseFloat(e.target.value) })}
                              />
                            </div>
                          )}

                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="notes">ملاحظات</Label>
                            <Input
                              id="notes"
                              value={formData.notes}
                              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsDialogOpen(false);
                            setEditingStudent(null);
                            resetForm();
                          }}
                        >
                          إلغاء
                        </Button>
                        <Button type="submit" disabled={loading}>
                          {loading ? 'جاري الحفظ...' : editingStudent ? 'تحديث' : 'إضافة'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="البحث عن طالب..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Students Table */}
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  جاري التحميل...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا يوجد طلاب في هذه الشعبة
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-3 text-right text-sm font-semibold">#</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">الاسم الكامل</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">اسم الأب</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">هاتف الأب</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">هاتف الأم</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">الجنس</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">تاريخ الميلاد</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">النقل</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student, index) => (
                        <tr 
                          key={student.id} 
                          className="border-b border-border hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm">{index + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium">{student.full_name}</td>
                          <td className="px-4 py-3 text-sm">{student.father_name}</td>
                          <td className="px-4 py-3 text-sm">{student.father_phone || '-'}</td>
                          <td className="px-4 py-3 text-sm">{student.mother_phone || '-'}</td>
                          <td className="px-4 py-3 text-sm">{student.gender === 'male' ? 'ذكر' : 'أنثى'}</td>
                          <td className="px-4 py-3 text-sm">{student.birth_date}</td>
                          <td className="px-4 py-3 text-sm">
                            {student.transportation_type === 'walking' ? 'مشي' :
                             student.transportation_type === 'full_bus' ? 'باص كامل' :
                             student.transportation_type === 'half_bus_to_school' ? 'نص باص (ذهاب)' :
                             student.transportation_type === 'half_bus_from_school' ? 'نص باص (إياب)' : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(student)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(student.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Student Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="حذف الطالب"
        description="هل أنت متأكد من حذف هذا الطالب؟"
        confirmText="حذف"
        cancelText="إلغاء"
        variant="destructive"
        onConfirm={confirmDeleteStudent}
      />
    </div>
  );
};

export default StudentPersonalInfoPage;

