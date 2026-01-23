import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { classesApi, studentsApi, activitiesApi } from "@/services/api";
import { Class, Student, Activity } from "@/types/school";
import { hasActivityEndDatePassed } from "@/lib/utils";
import {
  Search,
  Users,
  Check,
  X,
  Loader2,
  UserCheck,
  AlertCircle,
} from "lucide-react";

interface ParticipantSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity;
  academicYearId: number;
  onSave: () => void;
}

export const ParticipantSelectionDialog: React.FC<
  ParticipantSelectionDialogProps
> = ({ open, onOpenChange, activity, academicYearId, onSave }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"classes" | "students">("classes");
  const isActivityEnded = hasActivityEndDatePassed(activity.end_date);

  // Data
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<Set<number>>(
    new Set()
  );
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(
    new Set()
  );
  const [existingRegistrations, setExistingRegistrations] = useState<
    Map<number, any>
  >(new Map()); // Track existing registrations
  const [studentPaymentStatus, setStudentPaymentStatus] = useState<
    Map<number, boolean>
  >(new Map()); // Track payment status per student
  const [searchQuery, setSearchQuery] = useState("");

  // Track initial state for change detection
  const [initialSelectedClasses, setInitialSelectedClasses] = useState<Set<number>>(new Set());
  const [initialSelectedStudents, setInitialSelectedStudents] = useState<Set<number>>(new Set());

  // Load data
  useEffect(() => {
    if (open && academicYearId) {
      loadData();
    }
  }, [open, academicYearId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load classes first
      const classesResponse = await classesApi.getAll({
        academic_year_id: academicYearId,
      });
      let loadedClasses: Class[] = [];
      if (classesResponse.success && classesResponse.data) {
        loadedClasses = classesResponse.data;
        setClasses(loadedClasses);
      }

      // Load students
      const studentsResponse = await studentsApi.getAll({
        academic_year_id: academicYearId,
        is_active: true,
      });
      let loadedStudents: Student[] = [];
      if (studentsResponse.success && studentsResponse.data) {
        loadedStudents = studentsResponse.data;
        setStudents(loadedStudents);
      }

      // Load existing registrations
      const registrationsResponse = await activitiesApi.getRegistrations(
        activity.id!
      );
      if (registrationsResponse.success && registrationsResponse.data) {
         // Debug log

        const registeredStudentIds = new Set(
          registrationsResponse.data.map((r: any) => r.student_id)
        );
        setSelectedStudents(registeredStudentIds);

        // Store existing registrations with their payment status
        const existingRegsMap = new Map();
        const paymentStatusMap = new Map();
        registrationsResponse.data.forEach((r: any) => {
          existingRegsMap.set(r.student_id, r);
          paymentStatusMap.set(r.student_id, r.payment_status === "paid");
           // Debug log
        });
        setExistingRegistrations(existingRegsMap);
        setStudentPaymentStatus(paymentStatusMap);

        // Determine which classes should be checked based on registered students
        const classesToCheck = new Set<number>();
        loadedClasses.forEach((cls) => {
          const classStudents = loadedStudents.filter(
            (s) =>
              s.grade_level === cls.grade_level &&
              s.grade_number === cls.grade_number &&
              s.session_type === cls.session_type
          );

          // Check if all students from this class are registered
          if (classStudents.length > 0) {
            const allStudentsRegistered = classStudents.every((s) =>
              registeredStudentIds.has(s.id!)
            );
            if (allStudentsRegistered) {
              classesToCheck.add(cls.id!);
            }
          }
        });
        setSelectedClasses(classesToCheck);
        setInitialSelectedClasses(new Set(classesToCheck));
         // Debug log

        setInitialSelectedStudents(new Set(registeredStudentIds));
         // Debug log
      }
    } catch (error) {

      toast({
        title: "خطأ",
        description: "فشل في تحميل البيانات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Group classes by grade level
  const groupedClasses = classes.reduce((acc, cls) => {
    const key = cls.grade_level;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(cls);
    return acc;
  }, {} as Record<string, Class[]>);

  // Get students for a class
  const getStudentsForClass = (classId: number) => {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return [];

    return students.filter(
      (s) =>
        s.grade_level === cls.grade_level &&
        s.grade_number === cls.grade_number &&
        s.session_type === cls.session_type
    );
  };

  // Get all students from selected classes
  const getStudentsFromSelectedClasses = () => {
    const selectedClassesArray = Array.from(selectedClasses);
    const studentsInClasses = new Set<number>();

    selectedClassesArray.forEach((classId) => {
      const classStudents = getStudentsForClass(classId);
      classStudents.forEach((s) => studentsInClasses.add(s.id!));
    });

    return students.filter((s) => studentsInClasses.has(s.id!));
  };

  // Handle class selection
  const handleClassToggle = (classId: number) => {
    const newSelectedClasses = new Set(selectedClasses);
    if (newSelectedClasses.has(classId)) {
      newSelectedClasses.delete(classId);
      // Remove students from this class
      const classStudents = getStudentsForClass(classId);
      const newSelectedStudents = new Set(selectedStudents);
      classStudents.forEach((s) => newSelectedStudents.delete(s.id!));
      setSelectedStudents(newSelectedStudents);
    } else {
      newSelectedClasses.add(classId);
      // Add all students from this class
      const classStudents = getStudentsForClass(classId);
      const newSelectedStudents = new Set(selectedStudents);
      classStudents.forEach((s) => newSelectedStudents.add(s.id!));
      setSelectedStudents(newSelectedStudents);
    }
    setSelectedClasses(newSelectedClasses);
  };

  // Handle student toggle
  const handleStudentToggle = (studentId: number) => {
    const student = students.find((s) => s.id === studentId);

    // Find the class this student belongs to
    const studentClass = student ? classes.find(
      (c) =>
        c.grade_level === student.grade_level &&
        c.grade_number === student.grade_number &&
        c.session_type === student.session_type
    ) : null;

    // If the student's class is checked and we're adding this student,
    // they should be automatically added (already handled by being in selectedStudents)
    // If unchecking, proceed normally
    const newSelectedStudents = new Set(selectedStudents);
    if (newSelectedStudents.has(studentId)) {
      newSelectedStudents.delete(studentId);
      // Remove payment status when student is deselected
      const newPaymentStatus = new Map(studentPaymentStatus);
      newPaymentStatus.delete(studentId);
      setStudentPaymentStatus(newPaymentStatus);
    } else {
      newSelectedStudents.add(studentId);
    }
    setSelectedStudents(newSelectedStudents);

    // Update class checkboxes based on student selection
    if (studentClass) {
      const classStudents = getStudentsForClass(studentClass.id!);
      const allClassStudentsSelected = classStudents.every((s) =>
        s.id === studentId ? newSelectedStudents.has(s.id) : newSelectedStudents.has(s.id!)
      );

      const newSelectedClasses = new Set(selectedClasses);
      if (allClassStudentsSelected && classStudents.length > 0) {
        // All students selected, check the class
        newSelectedClasses.add(studentClass.id!);
      } else {
        // Not all students selected, uncheck the class
        newSelectedClasses.delete(studentClass.id!);
      }
      setSelectedClasses(newSelectedClasses);
    }
  };

  // Handle payment status toggle
  const handlePaymentStatusToggle = (
    studentId: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // Prevent triggering student selection
    const newPaymentStatus = new Map(studentPaymentStatus);
    newPaymentStatus.set(studentId, !newPaymentStatus.get(studentId));
    setStudentPaymentStatus(newPaymentStatus);
  };

  // Handle select all students
  const handleSelectAll = () => {
    const allStudents = students.filter(
      (student) =>
        student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.father_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const newSelectedStudents = new Set(selectedStudents);
    allStudents.forEach((s) => newSelectedStudents.add(s.id!));
    setSelectedStudents(newSelectedStudents);
  };

  // Handle deselect all students
  const handleDeselectAll = () => {
    const allStudents = students.filter(
      (student) =>
        student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.father_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const newSelectedStudents = new Set(selectedStudents);
    allStudents.forEach((s) => newSelectedStudents.delete(s.id!));
    setSelectedStudents(newSelectedStudents);
  };

  // Filter students by search - show all students, not just from selected classes
  const filteredStudents = students.filter(
    (student) =>
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.father_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if max participants exceeded
  const isMaxExceeded =
    activity.max_participants &&
    selectedStudents.size > activity.max_participants;

  // Handle save
  const handleSave = async () => {
    if (isMaxExceeded) {
      toast({
        title: "خطأ",
        description: `عدد المشاركين المحددين (${selectedStudents.size}) يتجاوز الحد الأقصى (${activity.max_participants})`,
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const studentIds = Array.from(selectedStudents);
      const promises = [];

      // Separate new students from existing ones
      const newStudents = [];
      const updatedStudents = [];
      const removedStudents = [];

       // Debug log
       // Debug log

      // Check for students that need to be removed (in existing registrations but not in selectedStudents)
      for (const [studentId, registration] of existingRegistrations.entries()) {
        if (!selectedStudents.has(studentId)) {
           // Debug log
          promises.push(
            activitiesApi.deleteRegistration(activity.id!, registration.id)
          );
          removedStudents.push(studentId);
        }
      }

      for (const studentId of studentIds) {
        const existingReg = existingRegistrations.get(studentId);
        const hasPaid = studentPaymentStatus.get(studentId) || false;
        const newPaymentStatus = hasPaid ? "paid" : "pending";

        if (existingReg) {
          // Update existing registration if payment status changed
          if (existingReg.payment_status !== newPaymentStatus) {
             // Debug log
            promises.push(
              activitiesApi.updateRegistration(existingReg.id, {
                payment_status: newPaymentStatus,
              })
            );
            updatedStudents.push(studentId);
          } else {
             // Debug log
          }
        } else {
          // Create new registration
           // Debug log
          promises.push(
            activitiesApi.createRegistration(activity.id!, {
              student_id: studentId,
              activity_id: activity.id!,
              registration_date: new Date().toISOString().split("T")[0],
              payment_status: newPaymentStatus,
              payment_amount: activity.cost_per_student,
            })
          );
          newStudents.push(studentId);
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      // Calculate payment summary
      const paidCount = Array.from(studentIds).filter((id) =>
        studentPaymentStatus.get(id)
      ).length;
      const unpaidCount = studentIds.length - paidCount;
      const totalPaid = paidCount * (activity.cost_per_student || 0);
      const totalUnpaid = unpaidCount * (activity.cost_per_student || 0);

      // Show detailed success message
      const summaryParts = [];
      if (newStudents.length > 0)
        summaryParts.push(`${newStudents.length} طالب جديد`);
      if (updatedStudents.length > 0)
        summaryParts.push(`${updatedStudents.length} تحديث`);
      if (removedStudents.length > 0)
        summaryParts.push(`${removedStudents.length} تمت إزالته`);

      const paymentSummary = [];
      if (paidCount > 0)
        paymentSummary.push(
          `${paidCount} دفع (${totalPaid.toLocaleString("ar-SY")} ل.س)`
        );
      if (unpaidCount > 0)
        paymentSummary.push(
          `${unpaidCount} معلق (${totalUnpaid.toLocaleString("ar-SY")} ل.س)`
        );

      toast({
        title: "نجاح",
        description: `${summaryParts.join(" • ")}\n${paymentSummary.join(
          " • "
        )}`,
        duration: 5000,
      });

      // Calculate bulk changes for history logging
      const addedClasses: Array<{grade_number: string, session: string, student_count: number}> = [];
      const removedClasses: Array<{grade_number: string, session: string, student_count: number}> = [];
      const addedStudentsIndividual: Array<{student_id: number, name: string}> = [];
      const removedStudentsIndividual: Array<{student_id: number, name: string}> = [];

      // Track class changes
      for (const classId of selectedClasses) {
        if (!initialSelectedClasses.has(classId)) {
          const cls = classes.find(c => c.id === classId);
          if (cls) {
            const classStudents = getStudentsForClass(classId);
            addedClasses.push({
              grade_number: `${cls.grade_number}`,
              session: cls.session_type === 'morning' ? 'صباحي' : 'مسائي',
              student_count: classStudents.length
            });
          }
        }
      }

      for (const classId of initialSelectedClasses) {
        if (!selectedClasses.has(classId)) {
          const cls = classes.find(c => c.id === classId);
          if (cls) {
            const classStudents = getStudentsForClass(classId);
            removedClasses.push({
              grade_number: `${cls.grade_number}`,
              session: cls.session_type === 'morning' ? 'صباحي' : 'مسائي',
              student_count: classStudents.length
            });
          }
        }
      }

      // Track individual student changes (not part of class operations)
      // Get students from classes
      const studentsInInitialClasses = new Set<number>();
      const studentsInCurrentClasses = new Set<number>();

      for (const classId of initialSelectedClasses) {
        getStudentsForClass(classId).forEach(s => studentsInInitialClasses.add(s.id!));
      }

      for (const classId of selectedClasses) {
        getStudentsForClass(classId).forEach(s => studentsInCurrentClasses.add(s.id!));
      }

      // Students added individually (not from class selection)
      for (const studentId of selectedStudents) {
        if (!initialSelectedStudents.has(studentId) && !studentsInCurrentClasses.has(studentId)) {
          const student = students.find(s => s.id === studentId);
          if (student) {
            addedStudentsIndividual.push({
              student_id: studentId,
              name: student.full_name
            });
          }
        }
      }

      // Students removed individually (not from class unselection)
      for (const studentId of initialSelectedStudents) {
        if (!selectedStudents.has(studentId) && !studentsInInitialClasses.has(studentId)) {
          const student = students.find(s => s.id === studentId);
          if (student) {
            removedStudentsIndividual.push({
              student_id: studentId,
              name: student.full_name
            });
          }
        }
      }

      // Log bulk changes if there are any
      if (addedClasses.length > 0 || removedClasses.length > 0 ||
          addedStudentsIndividual.length > 0 || removedStudentsIndividual.length > 0) {
        try {
          await activitiesApi.logBulkParticipantChange(activity.id!, {
            added_classes: addedClasses,
            removed_classes: removedClasses,
            added_students: addedStudentsIndividual,
            removed_students: removedStudentsIndividual,
            payment_updates: {
              paid_count: paidCount,
              pending_count: unpaidCount
            }
          });
        } catch (historyError) {

          // Don't fail the whole operation if history logging fails
        }
      }

      onSave();
      onOpenChange(false);
    } catch (error) {

      const errorMessage =
        error instanceof Error ? error.message : "فشل في حفظ المشاركين";
      toast({
        title: "خطأ",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const gradeLevelLabels = {
    primary: "ابتدائي",
    intermediate: "إعدادي",
    secondary: "ثانوي",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>إدارة المشاركين - {activity.name}</DialogTitle>
          <DialogDescription>
            اختر الصفوف والطلاب المشاركين في النشاط
          </DialogDescription>
        </DialogHeader>

        {isActivityEnded && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900 dark:text-yellow-100">تنبيه: النشاط قد انتهى</p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                هذا النشاط قد انتهى (التاريخ المحدد قد مضى). يمكنك عرض المشاركين الحاليين فقط ولا يمكن إضافة أو تعديل المشاركين.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Bar */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="text-sm">
                  <Users className="h-3 w-3 ml-1" />
                  {selectedStudents.size} مشارك محدد
                </Badge>
                {activity.max_participants && (
                  <Badge
                    variant={isMaxExceeded ? "destructive" : "outline"}
                    className="text-sm"
                  >
                    الحد الأقصى: {activity.max_participants}
                  </Badge>
                )}
              </div>
              {isMaxExceeded && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  تجاوز الحد الأقصى
                </div>
              )}
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as any)}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="classes">اختيار الصفوف</TabsTrigger>
                <TabsTrigger value="students">
                  ضبط الطلاب{" "}
                  {selectedClasses.size > 0 && `(${selectedClasses.size} صف)`}
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="classes"
                className="flex-1 overflow-y-auto mt-4"
              >
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    اختر الصفوف المشاركة. سيتم تضمين جميع طلاب الصفوف المحددة.
                  </p>

                  {Object.entries(groupedClasses).map(
                    ([level, levelClasses]) => (
                      <Card key={level}>
                        <CardHeader>
                          <CardTitle className="text-lg">
                            {
                              gradeLevelLabels[
                                level as keyof typeof gradeLevelLabels
                              ]
                            }
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {levelClasses.map((cls) => {
                            const classStudents = getStudentsForClass(cls.id!);
                            const isSelected = selectedClasses.has(cls.id!);
                            const selectedCount = classStudents.filter((s) =>
                              selectedStudents.has(s.id!)
                            ).length;

                            return (
                              <div
                                key={cls.id}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                  isActivityEnded
                                    ? "cursor-not-allowed opacity-60 bg-muted"
                                    : `cursor-pointer ${
                                        isSelected
                                          ? "bg-primary/5 border-primary"
                                          : "hover:bg-muted"
                                      }`
                                }`}
                                onClick={() => !isActivityEnded && handleClassToggle(cls.id!)}
                              >
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={isSelected}
                                    disabled={isActivityEnded}
                                    onCheckedChange={() =>
                                      !isActivityEnded && handleClassToggle(cls.id!)
                                    }
                                  />
                                  <div>
                                    <p className="font-medium">
                                      الصف {cls.grade_number} -{" "}
                                      {cls.session_type === "morning"
                                        ? "صباحي"
                                        : "مسائي"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedCount}/{classStudents.length}{" "}
                                      طالب
                                    </p>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="h-5 w-5 text-primary" />
                                )}
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    )
                  )}

                  {classes.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>لا توجد صفوف في هذه السنة الدراسية</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent
                value="students"
                className="flex-1 overflow-y-auto mt-4"
              >
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    يمكنك تحديد الطلاب المشاركين فردياً. الطلاب المحددين من
                    الصفوف يظهرون محددين تلقائياً.
                  </p>

                  {/* Search and Actions */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="البحث عن طالب..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pr-10"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActivityEnded}
                      onClick={handleSelectAll}
                    >
                      تحديد الكل
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActivityEnded}
                      onClick={handleDeselectAll}
                    >
                      إلغاء الكل
                    </Button>
                  </div>

                  {/* Students List */}
                  <div className="space-y-2">
                    {filteredStudents.map((student) => {
                      const isSelected = selectedStudents.has(student.id!);
                      const hasPaid =
                        studentPaymentStatus.get(student.id!) || false;

                      return (
                        <div
                          key={student.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            isActivityEnded
                              ? "cursor-not-allowed opacity-60 bg-muted"
                              : `cursor-pointer ${
                                  isSelected
                                    ? "bg-primary/5 border-primary"
                                    : "hover:bg-muted"
                                }`
                          }`}
                          onClick={() => !isActivityEnded && handleStudentToggle(student.id!)}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox
                              checked={isSelected}
                              disabled={isActivityEnded}
                              onCheckedChange={() =>
                                !isActivityEnded && handleStudentToggle(student.id!)
                              }
                            />
                            <div className="flex-1">
                              <p className="font-medium">{student.full_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {student.father_name} - الصف{" "}
                                {student.grade_number}{" "}
                                {student.section && `شعبة ${student.section}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {isSelected && (
                              <div
                                className={`flex items-center gap-2 px-2 py-1 rounded border bg-white dark:bg-gray-800 ${
                                  isActivityEnded ? "cursor-not-allowed opacity-60" : ""
                                }`}
                                onClick={(e) =>
                                  !isActivityEnded && handlePaymentStatusToggle(student.id!, e)
                                }
                              >
                                <Checkbox
                                  checked={hasPaid}
                                  disabled={isActivityEnded}
                                  onCheckedChange={() => {}}
                                />
                                <span
                                  className={`text-sm ${
                                    hasPaid
                                      ? "text-green-600 font-medium"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {hasPaid ? "دفع" : "لم يدفع"}
                                </span>
                              </div>
                            )}
                            {student.has_special_needs && (
                              <Badge variant="outline" className="text-xs">
                                احتياجات خاصة
                              </Badge>
                            )}
                            {isSelected && (
                              <Check className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {filteredStudents.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>لا توجد نتائج</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={
                  saving || selectedStudents.size === 0 || isMaxExceeded || isActivityEnded
                }
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 ml-1" />
                    حفظ المشاركين ({selectedStudents.size})
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
