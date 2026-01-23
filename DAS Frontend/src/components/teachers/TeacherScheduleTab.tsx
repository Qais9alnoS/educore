import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    BookOpen,
    Users,
    Plus,
    Trash2,
    Clock,
    Calendar as CalendarIcon,
    Save,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { Teacher, Class, Subject, FreeTimeSlot } from '@/types/school';
import { teachersApi, classesApi, subjectsApi } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { FreeTimeSlotsCalendar } from '@/components/teachers/FreeTimeSlotsCalendar';

interface TeacherScheduleTabProps {
    teacher: Teacher;
    onUpdate: () => void;
}

// Helper function to get Arabic grade level name
const getGradeLevelLabel = (gradeLevel: string): string => {
    const labels: Record<string, string> = {
        'primary': 'الإبتدائي',
        'intermediate': 'المتوسط',
        'secondary': 'الثانوي'
    };
    return labels[gradeLevel] || gradeLevel;
};

// Helper function to convert number to Arabic ordinal
const getArabicOrdinal = (num: number): string => {
    const ordinals: Record<number, string> = {
        1: 'الأول',
        2: 'الثاني',
        3: 'الثالث',
        4: 'الرابع',
        5: 'الخامس',
        6: 'السادس',
        7: 'السابع',
        8: 'الثامن',
        9: 'التاسع',
        10: 'العاشر',
        11: 'الحادي عشر',
        12: 'الثاني عشر'
    };
    return ordinals[num] || num.toString();
};

// Helper function to get Arabic grade name
const getGradeLabel = (gradeLevel: string, gradeNumber: number): string => {
    const levelLabel = getGradeLevelLabel(gradeLevel);
    const ordinal = getArabicOrdinal(gradeNumber);
    return `الصف ${ordinal} ${levelLabel}`;
};

export const TeacherScheduleTab: React.FC<TeacherScheduleTabProps> = ({ teacher, onUpdate }) => {
    const [assignments, setAssignments] = useState<any[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [activeTab, setActiveTab] = useState<'classes' | 'students'>('classes');
    const [freeTimeSlots, setFreeTimeSlots] = useState<FreeTimeSlot[]>([]);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [assignmentToDelete, setAssignmentToDelete] = useState<number | null>(null);
    const [availableSections, setAvailableSections] = useState<string[]>([]);
    const [occupiedSlots, setOccupiedSlots] = useState<any[]>([]);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showFreeTimeDialog, setShowFreeTimeDialog] = useState(false);

    const [newAssignment, setNewAssignment] = useState({
        class_id: '',
        subject_id: '',
        section: ''
    });

    useEffect(() => {
        loadAssignments();
        loadClasses();
        loadTeacherSchedule();

        // Initialize free time slots from teacher data
        if (teacher.free_time_slots && Array.isArray(teacher.free_time_slots)) {
            // Check if it's a 2D array (legacy) or 1D array (current)
            if (teacher.free_time_slots.length > 0 && Array.isArray(teacher.free_time_slots[0])) {
                // It's a 2D array, flatten it
                const flatSlots = (teacher.free_time_slots as any).flat();
                // Ensure status field exists
                const slotsWithStatus = flatSlots.map((slot: FreeTimeSlot) => ({
                    ...slot,
                    status: slot.status || (slot.is_free ? 'free' : 'unavailable')
                }));
                setFreeTimeSlots(slotsWithStatus);
            } else if (teacher.free_time_slots.length === 30) {
                // Already a proper 1D array with 30 slots (5 days x 6 periods)
                // Ensure status field exists on all slots
                const slotsWithStatus = (teacher.free_time_slots as FreeTimeSlot[]).map(slot => ({
                    ...slot,
                    status: slot.status || (slot.is_free ? 'free' : 'unavailable')
                }));
                setFreeTimeSlots(slotsWithStatus);
            } else {
                // Invalid data, reinitialize
                initializeEmptyFreeTimeSlots();
            }
        } else {
            // Initialize empty grid (5 days x 6 periods)
            initializeEmptyFreeTimeSlots();
        }

        // Reset form when teacher changes
        setNewAssignment({ class_id: '', subject_id: '', section: '' });
        setSubjects([]);
        setAvailableSections([]);
    }, [teacher.id]);

    const initializeEmptyFreeTimeSlots = () => {
        const slots: FreeTimeSlot[] = [];
        for (let day = 0; day < 5; day++) { // Sunday to Thursday (0-4)
            for (let period = 0; period < 6; period++) { // Periods 0-5 (0-based indexing)
                slots.push({
                    day: day,
                    period: period,
                    is_free: false,
                    status: 'unavailable'
                });
            }
        }

        setFreeTimeSlots(slots);
    };

    const loadTeacherSchedule = async () => {
        try {
            setLoadingSchedule(true);
            const academicYearId = localStorage.getItem('selected_academic_year_id');
            const response = await teachersApi.getSchedule(teacher.id!, {
                academic_year_id: academicYearId ? parseInt(academicYearId) : undefined
            });

            if (response.success && response.data) {
                // Ensure data is an array
                const scheduleData = Array.isArray(response.data) ? response.data : [];

                // Map schedule entries to occupied slots format
                const occupied = scheduleData.map((entry: any) => ({
                    day: entry.day_of_week - 1, // Convert from 1-5 to 0-4
                    period: entry.period_number - 1, // Convert from 1-6 to 0-5
                    className: `${entry.grade_number}/${entry.section}`, // Format as: grade/section (e.g. 1/1)
                    subject: entry.subject_name || 'مادة'
                }));
                setOccupiedSlots(occupied);
                 // Debug log
            }
        } catch (error) {

        } finally {
            setLoadingSchedule(false);
        }
    };

    const loadAssignments = async () => {
        try {
            const academicYearId = localStorage.getItem('selected_academic_year_id');
            const response = await teachersApi.getAssignments(teacher.id!, {
                academic_year_id: academicYearId ? parseInt(academicYearId) : undefined
            });

            if (response.success && response.data) {
                setAssignments(response.data);

                // Get unique class IDs to load subjects
                const classIds = [...new Set(response.data.map((a: any) => a.class_id))];

                // Load subjects for all classes
                const subjectPromises = classIds.map(classId =>
                    subjectsApi.getAll({ class_id: classId, academic_year_id: academicYearId ? parseInt(academicYearId) : undefined })
                );

                const subjectResponses = await Promise.all(subjectPromises);
                const allSubjects: Subject[] = [];

                for (const subjectResponse of subjectResponses) {
                    if (subjectResponse.success && subjectResponse.data) {
                        allSubjects.push(...subjectResponse.data);
                    } else if (Array.isArray(subjectResponse)) {
                        allSubjects.push(...subjectResponse);
                    }
                }

                // Remove duplicates by id
                const uniqueSubjects = Array.from(
                    new Map(allSubjects.map(s => [s.id, s])).values()
                );

                setSubjects(uniqueSubjects);
            }
        } catch (error) {

        }
    };

    const loadClasses = async () => {
        try {
            const academicYearId = localStorage.getItem('selected_academic_year_id');
            const response = await classesApi.getAll({
                academic_year_id: academicYearId ? parseInt(academicYearId) : undefined,
                session_type: teacher.session_type
            });

            if (response.success && response.data) {
                setClasses(response.data);
            } else if (Array.isArray(response)) {
                setClasses(response);
            }
        } catch (error) {

        }
    };

    const loadSubjectsForClass = async (classId: number) => {
        try {
            const academicYearId = localStorage.getItem('selected_academic_year_id');
            const response = await subjectsApi.getAll({
                class_id: classId,
                academic_year_id: academicYearId ? parseInt(academicYearId) : undefined
            });

            if (response.success && response.data) {
                setSubjects(response.data);
            } else if (Array.isArray(response)) {
                setSubjects(response);
            }
        } catch (error) {

        }
    };

    const handleAddAssignment = async () => {
        if (!newAssignment.class_id || !newAssignment.subject_id) {
            toast({
                title: "تحذير",
                description: "يرجى اختيار الصف والمادة",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            const response = await teachersApi.assignSubject(teacher.id!, {
                class_id: parseInt(newAssignment.class_id),
                subject_id: parseInt(newAssignment.subject_id),
                section: newAssignment.section || undefined
            });

            if (response.success) {
                toast({
                    title: "نجاح",
                    description: "تم إضافة التوزيع بنجاح",
                });
                setShowAddDialog(false);
                setNewAssignment({ class_id: '', subject_id: '', section: '' });
                loadAssignments();
            }
        } catch (error: any) {
            toast({
                title: "خطأ",
                description: error.message || "فشل في إضافة التوزيع",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAssignment = (assignmentId: number) => {
        setAssignmentToDelete(assignmentId);
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteAssignment = async () => {
        if (assignmentToDelete === null) return;

        setLoading(true);
        try {
            const response = await teachersApi.removeAssignment(assignmentToDelete);
            if (response.success) {
                toast({
                    title: "نجاح",
                    description: "تم حذف التوزيع بنجاح",
                });
                loadAssignments();
            }
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل في حذف التوزيع",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
            setDeleteConfirmOpen(false);
            setAssignmentToDelete(null);
        }
    };

    // Helper function to calculate total weekly hours
    const calculateTotalWeeklyHours = () => {
        let total = 0;

        for (const assignment of assignments) {
            // Find the subject for this assignment
            const subject = subjects.find(s => s.id === assignment.subject_id);
            if (subject) {
                const weeklyHours = subject.weekly_hours || 0;

                // If assignment is for "all sections" (section is null or empty)
                // multiply by number of sections in the class
                if (!assignment.section || assignment.section === '') {
                    // Find the class to get section_count
                    const classInfo = classes.find(c => c.id === assignment.class_id);
                    const sectionCount = classInfo?.section_count || 1;

                    // Multiply weekly hours by number of sections
                    total += weeklyHours * sectionCount;
                } else {
                    // Specific section: count normally
                    total += weeklyHours;
                }
            }
        }

        return total;
    };

    // Calculate remaining required hours (total - already scheduled)
    const calculateRemainingRequiredHours = () => {
        const totalRequired = calculateTotalWeeklyHours();
        const alreadyScheduled = occupiedSlots.length; // Number of periods already in schedule
        const remaining = Math.max(0, totalRequired - alreadyScheduled);
        return remaining;
    };

    // Count truly free slots (not occupied by schedule)
    const countTrulyFreeSlots = () => {
        return freeTimeSlots.filter(slot => {
            // Check if this slot is occupied
            const isOccupied = occupiedSlots.some(
                occ => occ.day === slot.day && occ.period === slot.period
            );
            // Only count if marked as free AND not occupied
            return slot.is_free && !isOccupied;
        }).length;
    };

    const handleSaveFreeTimeSlots = async (slots: FreeTimeSlot[]) => {
        // Calculate remaining required hours (excluding already scheduled)
        const remainingRequired = calculateRemainingRequiredHours();

        // Count free time slots (only slots that are free and not in occupied list)
        const freeSlotCount = slots.filter(slot => {
            const isOccupied = occupiedSlots.some(
                occ => occ.day === slot.day && occ.period === slot.period
            );
            return slot.is_free && !isOccupied;
        }).length;

        // Validate bottleneck: free slots must be >= remaining required hours
        if (freeSlotCount < remainingRequired) {
            toast({
                title: "خطأ في التحقق",
                description: `عدد أوقات الفراغ المحددة (${freeSlotCount}) أقل من عدد الحصص المتبقية المطلوبة (${remainingRequired}). يجب تحديد ${remainingRequired} حصة على الأقل.`,
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            const response = await teachersApi.update(teacher.id!, {
                free_time_slots: slots
            });

            if (response.success) {
                toast({
                    title: "نجاح",
                    description: `تم حفظ أوقات الفراغ بنجاح (${freeSlotCount} من ${remainingRequired} حصة متبقية)`,
                });
                setFreeTimeSlots(slots);
                setShowFreeTimeDialog(false);
                onUpdate();
            }
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل في حفظ أوقات الفراغ",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Class & Subject Assignments */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5" />
                            الصفوف والمواد
                        </CardTitle>
                        <Button
                            size="sm"
                            onClick={() => setShowAddDialog(true)}
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            إضافة توزيع
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {assignments.length > 0 ? (
                        <div className="space-y-3">
                            {assignments.map((assignment) => {
                                // Find the corresponding class to get grade info
                                const classInfo = classes.find(c => c.id === assignment.class_id);
                                // Find the corresponding subject to get weekly hours
                                const subjectInfo = subjects.find(s => s.id === assignment.subject_id);

                                // Get proper Arabic grade name
                                const gradeLabel = classInfo
                                    ? getGradeLabel(classInfo.grade_level, classInfo.grade_number)
                                    : assignment.class_name;

                                // Calculate total weekly hours based on sections
                                let totalWeeklyHours = subjectInfo?.weekly_hours || 0;
                                let sectionLabel = '';

                                if (!assignment.section || assignment.section === '') {
                                    // Assigned to all sections
                                    const sectionCount = classInfo?.section_count || 1;
                                    totalWeeklyHours = totalWeeklyHours * sectionCount;
                                    sectionLabel = 'جميع الشعب';
                                } else {
                                    // Specific section
                                    sectionLabel = `الشعبة ${assignment.section}`;
                                }

                                return (
                                    <div
                                        key={assignment.id}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <BookOpen className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {assignment.subject_name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {gradeLabel}
                                                </p>
                                                {subjectInfo?.weekly_hours && (
                                                    <p className="text-xs text-primary mt-1">
                                                        {totalWeeklyHours} حصة أسبوعياً
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="px-3 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm font-medium">
                                                {sectionLabel}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDeleteAssignment(assignment.id)}
                                                disabled={loading}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            لا توجد توزيعات مضافة
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Free Time Slots - Only show if teacher has assignments */}
            {assignments.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                أوقات الفراغ
                            </CardTitle>
                            <Button
                                size="sm"
                                onClick={() => setShowFreeTimeDialog(true)}
                                className="gap-2"
                            >
                                <CalendarIcon className="h-4 w-4" />
                                تعديل أوقات الفراغ
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {freeTimeSlots.filter(s => s.is_free).length > 0 || occupiedSlots.length > 0 ? (
                            <div dir="rtl">
                                <FreeTimeSlotsCalendar
                                    slots={freeTimeSlots}
                                    readonly={true}
                                    occupiedSlots={occupiedSlots}
                                />
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <p className="mb-2">لم يتم تحديد أوقات الفراغ بعد</p>
                                <p className="text-sm">اضغط على "تعديل أوقات الفراغ" لتحديد الأوقات المتاحة</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Message when no assignments */}
            {assignments.length === 0 && (
                <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3 text-yellow-800 dark:text-yellow-200">
                            <AlertCircle className="h-5 w-5" />
                            <div>
                                <p className="font-medium">لا يمكن تحديد أوقات الفراغ</p>
                                <p className="text-sm">يرجى إضافة توزيعات (مواد وصفوف) للأستاذ أولاً</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Add Assignment Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="sm:max-w-[500px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>إضافة توزيع جديد</DialogTitle>
                        <DialogDescription>
                            اختر الصف والمادة التي يدرسها الأستاذ
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>الصف *</Label>
                            <Select
                                value={newAssignment.class_id}
                                onValueChange={(value) => {
                                    const selectedClass = classes.find(c => c.id?.toString() === value);
                                    setNewAssignment({ ...newAssignment, class_id: value, section: '' });
                                    loadSubjectsForClass(parseInt(value));

                                    // Generate available sections based on section_count
                                    if (selectedClass?.section_count) {
                                        const sections = [];
                                        for (let i = 0; i < selectedClass.section_count; i++) {
                                            sections.push(String(i + 1)); // 1, 2, 3, ...
                                        }
                                        setAvailableSections(sections);
                                    } else {
                                        setAvailableSections([]);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الصف" />
                                </SelectTrigger>
                                <SelectContent>
                                    {classes.map((cls) => (
                                        <SelectItem key={cls.id} value={cls.id!.toString()}>
                                            {getGradeLabel(cls.grade_level, cls.grade_number)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>المادة *</Label>
                            <Select
                                value={newAssignment.subject_id}
                                onValueChange={(value) =>
                                    setNewAssignment({ ...newAssignment, subject_id: value })
                                }
                                disabled={!newAssignment.class_id}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر المادة" />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjects.map((subject) => (
                                        <SelectItem key={subject.id} value={subject.id!.toString()}>
                                            {subject.subject_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>الشعبة (اختياري)</Label>
                            <Select
                                value={newAssignment.section || 'all'}
                                onValueChange={(value) =>
                                    setNewAssignment({ ...newAssignment, section: value === 'all' ? '' : value })
                                }
                                disabled={!newAssignment.class_id || availableSections.length === 0}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={availableSections.length > 0 ? "اختر الشعبة" : "اختر الصف أولاً"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">جميع الشعب</SelectItem>
                                    {availableSections.map((section) => (
                                        <SelectItem key={section} value={section}>
                                            {section}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                            إلغاء
                        </Button>
                        <Button onClick={handleAddAssignment} disabled={loading}>
                            {loading ? 'جاري الإضافة...' : 'إضافة'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Free Time Slots Dialog */}
            <Dialog open={showFreeTimeDialog} onOpenChange={(open) => {
                setShowFreeTimeDialog(open);
                // Refresh occupied slots when dialog opens to get latest schedule data
                if (open) {
                    loadTeacherSchedule();
                }
            }}>
                <DialogContent className="sm:max-w-[900px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>تعديل أوقات الفراغ</DialogTitle>
                        <DialogDescription>
                            حدد الأوقات التي يكون فيها الأستاذ متاحاً (الأخضر = متاح، الرمادي = مشغول)
                        </DialogDescription>
                    </DialogHeader>

                    {/* Requirement Indicator */}
                    {calculateTotalWeeklyHours() > 0 && (
                        <div className="bg-blue-50 dark:bg-gray-800 border border-blue-200 dark:border-gray-700 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                        ℹ️
                                    </div>
                                    <div>
                                        <p className="font-semibold text-blue-900 dark:text-gray-100">
                                            عدد الحصص المطلوبة: <span className="text-lg">{calculateRemainingRequiredHours()}</span> حصة أسبوعياً
                                        </p>
                                        <p className="text-sm text-blue-700 dark:text-gray-300">
                                            عدد أوقات الفراغ المحددة حالياً: {countTrulyFreeSlots()}
                                        </p>
                                    </div>
                                </div>
                                {countTrulyFreeSlots() >= calculateRemainingRequiredHours() ? (
                                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold">
                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span>كافي</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-semibold">
                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <span>غير كافي</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="py-4">
                        {loadingSchedule ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="mr-3 text-muted-foreground">جاري تحميل الجدول...</span>
                            </div>
                        ) : (
                            <FreeTimeSlotsCalendar
                                key={JSON.stringify(occupiedSlots)}
                                slots={freeTimeSlots}
                                readonly={false}
                                onSlotsChange={(slots) => setFreeTimeSlots(slots)}
                                occupiedSlots={occupiedSlots}
                            />
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowFreeTimeDialog(false)}>
                            إلغاء
                        </Button>
                        <Button
                            onClick={() => handleSaveFreeTimeSlots(freeTimeSlots)}
                            disabled={loading}
                            className="gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {loading ? 'جاري الحفظ...' : 'حفظ'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Assignment Confirmation Dialog */}
            <ConfirmationDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                title="حذف التوزيع"
                description="هل أنت متأكد من حذف هذا التوزيع؟"
                confirmText="حذف"
                cancelText="إلغاء"
                variant="destructive"
                onConfirm={confirmDeleteAssignment}
            />
        </div>
    );
};

