import React, { useState, useEffect } from 'react';
import { FileText, Search, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ConfirmationDialog } from '../ui/confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';

interface Student {
  id: number;
  full_name: string;
}

interface Subject {
  id: number;
  subject_name: string;
}

interface StudentAction {
  id: number;
  student_id: number;
  student_name: string;
  action_type: string;
  action_type_label: string;
  subject_id: number | null;
  subject_name: string | null;
  description: string;
  grade: number | null;
  max_grade: number | null;
  notes: string | null;
  action_date: string;
}

interface StudentActionsProps {
  academicYearId: number;
  sessionType: string;
  selectedDate: string;
}

const ACTION_TYPES = {
  WITHOUT_SUBJECT: {
    warning: 'إنذار',
    parent_call: 'استدعاء ولي أمر',
    suspension: 'فصل'
  },
  WITH_SUBJECT: {
    misbehavior: 'مشاغبة',
    distinguished_participation: 'مشاركة مميزة',
    thank_you_card: 'بطاقة شكر',
    note: 'ملاحظة'
  },
  ACADEMIC: {
    recitation: 'تسميع',
    activity: 'نشاط',
    quiz: 'سبر'
  }
};

export function StudentActions({ academicYearId, sessionType, selectedDate }: StudentActionsProps) {
  const { toast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [actionType, setActionType] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [grade, setGrade] = useState('');
  const [maxGrade, setMaxGrade] = useState('');
  const [notes, setNotes] = useState('');
  
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  const [groupLink, setGroupLink] = useState('');
  
  const [todayActions, setTodayActions] = useState<StudentAction[]>([]);
  const [editingAction, setEditingAction] = useState<StudentAction | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [actionToDelete, setActionToDelete] = useState<number | null>(null);

  useEffect(() => {
    fetchClasses();
  }, [academicYearId, sessionType]);

  useEffect(() => {
    if (selectedClassId && selectedSection) {
      fetchStudents();
      fetchSubjects();
      fetchTodayActions();
    }
  }, [selectedClassId, selectedSection, selectedDate]);

  const fetchClasses = async () => {
    try {
      const response = await api.get(`/academic/classes?academic_year_id=${academicYearId}&session_type=${sessionType}`);
      setClasses(response.data as any[]);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const getAvailableGradeLevels = (): string[] => {
    const levels = new Set(classes.map((c: any) => c.grade_level));
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

  const getFilteredClasses = (): any[] => {
    if (!selectedGradeLevel) return classes;
    return classes.filter((c: any) => c.grade_level === selectedGradeLevel);
  };

  const fetchStudents = async () => {
    if (!selectedClassId || !selectedSection) {
      console.log('Missing classId or section');
      return;
    }
    
    try {
      console.log('Fetching students for actions:', { 
        classId: selectedClassId, 
        section: selectedSection
      });
      const response = await api.get(`/students/?class_id=${selectedClassId}&section=${selectedSection}`);
      console.log('Students response:', response.data);
      setStudents(response.data as Student[]);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء جلب بيانات الطلاب',
        variant: 'destructive',
        duration: 5000
      });
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await api.get(`/academic/subjects?class_id=${selectedClassId}`);
      setSubjects(response.data as Subject[]);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const openActionDialog = (student: Student) => {
    setSelectedStudent(student);
    setShowActionDialog(true);
  };

  const resetActionForm = () => {
    setActionType('');
    setSelectedSubjectId(null);
    setDescription('');
    setGrade('');
    setMaxGrade('');
    setNotes('');
  };

  const handleSaveAction = async () => {
    if (!selectedStudent || !actionType || !description) {
      toast({
        title: 'حقل مطلوب',
        description: 'يرجى ملء جميع الحقول المطلوبة',
        variant: 'destructive',
        duration: 5000
      });
      return;
    }

    // التحقق من المادة إذا كانت مطلوبة
    if (requiresSubject() && !selectedSubjectId) {
      toast({
        title: 'حقل مطلوب',
        description: 'يرجى اختيار المادة لهذا النوع من الإجراءات',
        variant: 'destructive',
        duration: 5000
      });
      return;
    }

    // التحقق من العلامة
    if (isAcademicAction() && grade && maxGrade) {
      const gradeNum = parseFloat(grade);
      const maxGradeNum = parseFloat(maxGrade);
      if (gradeNum > maxGradeNum) {
        toast({
          title: 'خطأ في العلامة',
          description: 'العلامة لا يمكن أن تكون أعلى من العلامة الكاملة',
          variant: 'destructive',
          duration: 5000
        });
        return;
      }
    }

    try {
      await api.post('/daily/actions/students', {
        student_id: selectedStudent.id,
        academic_year_id: academicYearId,
        action_date: selectedDate,
        action_type: actionType,
        subject_id: selectedSubjectId,
        description,
        grade: grade ? parseFloat(grade) : null,
        max_grade: maxGrade ? parseFloat(maxGrade) : null,
        notes
      });

      toast({
        title: 'تم بنجاح',
        description: 'تم حفظ الإجراء بنجاح',
        duration: 3000
      });
      setShowActionDialog(false);
      resetActionForm();
      fetchTodayActions(); // تحديث قائمة الإجراءات
    } catch (error) {
      console.error('Error saving action:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حفظ الإجراء',
        variant: 'destructive',
        duration: 5000
      });
    }
  };

  const fetchTodayActions = async () => {
    if (!selectedClassId || !selectedSection) return;
    
    try {
      const response = await api.get(
        `/daily/actions/students?class_id=${selectedClassId}&section=${selectedSection}&action_date=${selectedDate}`
      );
      setTodayActions(response.data as StudentAction[]);
    } catch (error) {
      console.error('Error fetching today actions:', error);
    }
  };

  const handleDeleteAction = (actionId: number) => {
    setActionToDelete(actionId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteAction = async () => {
    if (actionToDelete === null) return;

    try {
      await api.delete(`/daily/actions/students/${actionToDelete}`);
      toast({
        title: 'تم بنجاح',
        description: 'تم حذف الإجراء بنجاح',
        duration: 3000
      });
      fetchTodayActions();
    } catch (error) {
      console.error('Error deleting action:', error);
      toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء حذف الإجراء',
          variant: 'destructive',
          duration: 5000
        });
    } finally {
      setDeleteConfirmOpen(false);
      setActionToDelete(null);
    }
  };

  const handleEditAction = (action: StudentAction) => {
    setEditingAction(action);
    setSelectedStudent({ id: action.student_id, full_name: action.student_name });
    setActionType(action.action_type);
    setSelectedSubjectId(action.subject_id);
    setDescription(action.description);
    setGrade(action.grade?.toString() || '');
    setMaxGrade(action.max_grade?.toString() || '');
    setNotes(action.notes || '');
    setShowActionDialog(true);
  };

  const handleUpdateAction = async () => {
    if (!editingAction || !actionType || !description) {
      toast({
        title: 'حقل مطلوب',
        description: 'يرجى ملء جميع الحقول المطلوبة',
        variant: 'destructive',
        duration: 5000
      });
      return;
    }

    if (requiresSubject() && !selectedSubjectId) {
      toast({
        title: 'حقل مطلوب',
        description: 'يرجى اختيار المادة لهذا النوع من الإجراءات',
        variant: 'destructive',
        duration: 5000
      });
      return;
    }

    // التحقق من العلامة
    if (isAcademicAction() && grade && maxGrade) {
      const gradeNum = parseFloat(grade);
      const maxGradeNum = parseFloat(maxGrade);
      if (gradeNum > maxGradeNum) {
        toast({
          title: 'خطأ في العلامة',
          description: 'العلامة لا يمكن أن تكون أعلى من العلامة الكاملة',
          variant: 'destructive',
          duration: 5000
        });
        return;
      }
    }

    try {
      await api.put(`/daily/actions/students/${editingAction.id}`, {
        action_type: actionType,
        subject_id: selectedSubjectId,
        description,
        grade: grade ? parseFloat(grade) : null,
        max_grade: maxGrade ? parseFloat(maxGrade) : null,
        notes
      });

      toast({
        title: 'تم بنجاح',
        description: 'تم تحديث الإجراء بنجاح',
        duration: 3000
      });
      setShowActionDialog(false);
      setEditingAction(null);
      resetActionForm();
      fetchTodayActions();
    } catch (error) {
      console.error('Error updating action:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث الإجراء',
        variant: 'destructive',
        duration: 5000
      });
    }
  };

  const handleGenerateWhatsAppMessage = async () => {
    if (!selectedGradeLevel || !selectedClassId || !selectedSection) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار المرحلة والصف والشعبة أولاً',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await api.get(
        `/daily/whatsapp/message/${selectedClassId}/${selectedSection}/${selectedDate}?academic_year_id=${academicYearId}`
      );
      
      const data = response.data as { message_content: string; group_link: string | null };
      setWhatsappMessage(data.message_content);
      
      // إذا كان هناك رابط محفوظ، استخدمه، وإلا استخدم الرابط من الاستجابة
      if (whatsappLink) {
        // احتفظ بالرابط الحالي
      } else if (data.group_link) {
        setWhatsappLink(data.group_link);
      }
      
      setShowWhatsAppDialog(true);
    } catch (error) {
      console.error('Error generating WhatsApp message:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء توليد الرسالة',
        variant: 'destructive'
      });
    }
  };

  const handleSendToWhatsApp = async () => {
    if (!whatsappLink) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال رابط المجموعة أولاً',
        variant: 'destructive'
      });
      return;
    }

    // حفظ رابط المجموعة
    try {
      await api.post('/daily/whatsapp/config', {
        class_id: selectedClassId,
        section: selectedSection,
        academic_year_id: academicYearId,
        group_link: whatsappLink
      });
    } catch (error) {
      console.error('Error saving WhatsApp link:', error);
    }

    // إرسال الرسالة
    const encodedMessage = encodeURIComponent(whatsappMessage);
    
    // تنسيق الرابط: https://chat.whatsapp.com/XXXXXXXX
    if (whatsappLink.includes('chat.whatsapp.com/')) {
      // رابط مجموعة - نسخ الرسالة وفتح المجموعة
      navigator.clipboard.writeText(whatsappMessage).then(() => {
        toast({
          title: 'تم النسخ',
          description: 'تم نسخ الرسالة! سيتم فتح مجموعة الواتساب الآن',
        });
        setTimeout(() => {
          window.open(whatsappLink, '_blank');
        }, 500);
      }).catch(() => {
        window.open(whatsappLink, '_blank');
        toast({
          title: 'معلومة',
          description: 'افتح المجموعة وانسخ الرسالة من النافذة السابقة',
        });
      });
    }
    // تنسيق wa.me مع رقم هاتف
    else if (whatsappLink.includes('wa.me/')) {
      const phoneNumber = whatsappLink.split('wa.me/')[1].replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, '_blank');
    }
    // رقم هاتف مباشر
    else if (whatsappLink.match(/^\+?[0-9]+$/)) {
      const phoneNumber = whatsappLink.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, '_blank');
    }
    // رابط مباشر
    else {
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    }
  };

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const requiresSubject = () => {
    return Object.keys(ACTION_TYPES.WITH_SUBJECT).includes(actionType) ||
           Object.keys(ACTION_TYPES.ACADEMIC).includes(actionType);
  };

  const isAcademicAction = () => {
    return Object.keys(ACTION_TYPES.ACADEMIC).includes(actionType);
  };

  return (
    <Card className="ios-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              الإجراءات على الطلاب
            </CardTitle>
            <CardDescription className="mt-1">
              إضافة إجراءات وملاحظات على الطلاب للفترة {sessionType === 'morning' ? 'الصباحية' : 'المسائية'}
            </CardDescription>
          </div>
          <Button onClick={handleGenerateWhatsAppMessage} variant="outline" size="sm">
            <Send className="w-4 h-4 ml-2" />
            إرسال للأهل
          </Button>
        </div>
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
                {getFilteredClasses().map((cls: any) => (
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
                {selectedClassId && classes.find((c: any) => c.id === selectedClassId)?.section_count &&
                  Array.from({ length: classes.find((c: any) => c.id === selectedClassId)!.section_count }, (_, i) => 
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
            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredStudents.map(student => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <span className="font-semibold text-foreground">{student.full_name}</span>
                  <Button
                    size="sm"
                    onClick={() => openActionDialog(student)}
                  >
                    إضافة إجراء
                  </Button>
                </div>
              ))}
            </div>

            {/* إجراءات اليوم */}
            {todayActions.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground">
                    إجراءات اليوم
                  </h3>
                  <Badge variant="secondary">{todayActions.length} إجراء</Badge>
                </div>
                <div className="space-y-3">
                  {todayActions.map(action => (
                    <Card key={action.id} className="ios-card">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-bold text-foreground">
                                {action.student_name}
                              </span>
                              <Badge className="bg-primary/10 text-primary">
                                {action.action_type_label}
                              </Badge>
                              {action.subject_name && (
                                <Badge variant="outline">
                                  📚 {action.subject_name}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {new Date(action.action_date).toLocaleDateString('ar-SA')}
                              </span>
                            </div>
                            <p className="text-sm text-foreground mb-2">
                              {action.description}
                            </p>
                            {action.grade !== null && action.max_grade !== null && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">العلامة:</span> {action.grade}/{action.max_grade}
                              </div>
                            )}
                            {action.notes && (
                              <div className="text-sm text-muted-foreground mt-1">
                                <span className="font-medium">ملاحظات:</span> {action.notes}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditAction(action)}
                            >
                              تعديل
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteAction(action.id)}
                            >
                              حذف
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* نافذة إضافة إجراء */}
        <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingAction ? 'تعديل إجراء' : 'إضافة إجراء'} - {selectedStudent?.full_name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>نوع الإجراء</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر نوع الإجراء" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">إجراءات بدون مادة</div>
                    {Object.entries(ACTION_TYPES.WITHOUT_SUBJECT).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground mt-2">إجراءات مع مادة</div>
                    {Object.entries(ACTION_TYPES.WITH_SUBJECT).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground mt-2">إجراءات أكاديمية</div>
                    {Object.entries(ACTION_TYPES.ACADEMIC).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {requiresSubject() && (
                <div className="space-y-2">
                  <Label>المادة</Label>
                  <Select value={selectedSubjectId?.toString()} onValueChange={(val) => setSelectedSubjectId(parseInt(val))}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المادة" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.id.toString()}>
                          {subject.subject_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>التفاصيل / السبب</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="اكتب تفاصيل الإجراء أو السبب..."
                  rows={3}
                />
              </div>

              {isAcademicAction() && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>العلامة</Label>
                    <Input
                      type="number"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>العلامة الكاملة</Label>
                    <Input
                      type="number"
                      value={maxGrade}
                      onChange={(e) => setMaxGrade(e.target.value)}
                      placeholder="10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>ملاحظات إضافية</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات..."
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowActionDialog(false);
                  setEditingAction(null);
                  resetActionForm();
                }}>
                  إلغاء
                </Button>
                <Button onClick={editingAction ? handleUpdateAction : handleSaveAction}>
                  {editingAction ? 'تحديث الإجراء' : 'حفظ الإجراء'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* نافذة رسالة الواتساب */}
        <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground">إرسال التقرير اليومي للأهل</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>رابط مجموعة الواتساب</Label>
                <div className="flex gap-2">
                  <Input
                    value={whatsappLink}
                    onChange={(e) => setWhatsappLink(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="flex-1"
                  />
                  <Button
                    onClick={async () => {
                      if (!whatsappLink) {
                        toast({
                          title: 'خطأ',
                          description: 'يرجى إدخال رابط المجموعة أولاً',
                          variant: 'destructive'
                        });
                        return;
                      }
                      try {
                        await api.post('/daily/whatsapp/config', {
                          class_id: selectedClassId,
                          section: selectedSection,
                          academic_year_id: academicYearId,
                          group_link: whatsappLink
                        });
                        toast({
                          title: 'نجح',
                          description: 'تم حفظ رابط المجموعة بنجاح'
                        });
                      } catch (error) {
                        toast({
                          title: 'خطأ',
                          description: 'حدث خطأ أثناء حفظ الرابط',
                          variant: 'destructive'
                        });
                      }
                    }}
                    variant="outline"
                  >
                    حفظ
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>محتوى الرسالة</Label>
                <Textarea
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowWhatsAppDialog(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleSendToWhatsApp}>
                  <Send className="h-4 w-4 ml-2" />
                  إرسال عبر الواتساب
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Action Confirmation Dialog */}
        <ConfirmationDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="حذف الإجراء"
          description="هل أنت متأكد من حذف هذا الإجراء؟"
          confirmText="حذف"
          cancelText="إلغاء"
          variant="destructive"
          onConfirm={confirmDeleteAction}
        />
      </CardContent>
    </Card>
  );
}
