import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
    User,
    Calendar,
    Plus,
    Search,
    Users,
    GraduationCap,
    Clock,
    Trash2
} from 'lucide-react';
import { Teacher } from '@/types/school';
import { teachersApi, classesApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { TeacherPersonalInfoTab } from '@/components/teachers/TeacherPersonalInfoTab';
import { TeacherScheduleTab } from '@/components/teachers/TeacherScheduleTab';
import { TeacherAddDialog } from '@/components/teachers/TeacherAddDialog';

const TeacherManagementPage = () => {
    const { state: authState } = useAuth();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'personal' | 'schedule'>('personal');
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [teacherToDelete, setTeacherToDelete] = useState<number | null>(null);

    // Get session type based on user role
    const sessionType = authState.user?.role === 'morning_school' ? 'morning' :
                       authState.user?.role === 'evening_school' ? 'evening' : undefined;

    useEffect(() => {
        loadTeachers();
    }, []);

    // Handle pre-selected teacher from search
    useEffect(() => {
        const locationState = location.state as any;
        if (locationState?.preselectedTeacherId && teachers.length > 0) {
            const teacherId = locationState.preselectedTeacherId;
            const teacher = teachers.find(t => t.id === teacherId);
            if (teacher) {
                setSelectedTeacher(teacher);

            }
            // Clear the state after using it
            window.history.replaceState({}, document.title);
        }
    }, [location.state, teachers]);

    const loadTeachers = async () => {
        setLoading(true);
        try {
            const academicYearId = localStorage.getItem('selected_academic_year_id');

            const response = await teachersApi.getAll({
                academic_year_id: academicYearId ? parseInt(academicYearId) : undefined,
                session_type: sessionType,
                is_active: true
            });

            if (response.success && response.data) {
                // Parse JSON fields safely
                const parsedTeachers = response.data.map((teacher: any) => {
                    const parseJsonField = (field: any, fieldName?: string) => {
                        if (!field) return [];
                        if (Array.isArray(field)) {
                            // If it's a 2D array (legacy free_time_slots), flatten it
                            if (fieldName === 'free_time_slots' && field.length > 0 && Array.isArray(field[0])) {
                                return field.flat();
                            }
                            return field;
                        }
                        if (typeof field === 'string') {
                            try {
                                // Decode HTML entities first (fix double encoding issue)
                                const textarea = document.createElement('textarea');
                                textarea.innerHTML = field;
                                const decodedField = textarea.value;

                                const parsed = JSON.parse(decodedField);

                                // If parsed is a 2D array (legacy free_time_slots), flatten it
                                if (fieldName === 'free_time_slots' && Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
                                    return parsed.flat();
                                }

                                return parsed;
                            } catch (e) {
                                return [];
                            }
                        }
                        return [];
                    };

                    return {
                        ...teacher,
                        qualifications: parseJsonField(teacher.qualifications, 'qualifications'),
                        experience: parseJsonField(teacher.experience, 'experience'),
                        free_time_slots: parseJsonField(teacher.free_time_slots, 'free_time_slots')
                    };
                });

                setTeachers(parsedTeachers);

                // Select first teacher if available
                if (parsedTeachers.length > 0 && !selectedTeacher) {
                    setSelectedTeacher(parsedTeachers[0]);
                }
            }
        } catch (error) {

            toast({
                title: "خطأ",
                description: "فشل تحميل بيانات الأساتذة",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleTeacherSelect = (teacher: Teacher) => {
        setSelectedTeacher(teacher);
    };

    const handleAddTeacher = () => {
        setShowAddDialog(true);
    };

    const handleTeacherUpdated = () => {
        loadTeachers();
    };

    const handleDeleteTeacher = async (teacherId: number) => {
        setTeacherToDelete(teacherId);
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteTeacher = async () => {
        if (teacherToDelete === null) return;

        try {
            const response = await teachersApi.delete(teacherToDelete);
            if (response.success) {
                toast({
                    title: "نجاح",
                    description: "تم حذف الأستاذ بنجاح",
                });

                // Clear selected teacher if it was deleted
                if (selectedTeacher?.id === teacherToDelete) {
                    setSelectedTeacher(null);
                }

                // Reload teachers list
                loadTeachers();
            }
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل في حذف الأستاذ",
                variant: "destructive"
            });
        } finally {
            setDeleteConfirmOpen(false);
            setTeacherToDelete(null);
        }
    };

    const filteredTeachers = teachers.filter(teacher =>
        teacher.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.phone?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background p-6" dir="rtl">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <GraduationCap className="h-8 w-8 text-primary" />
                            إدارة الأساتذة
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {sessionType === 'morning' ? 'الدوام الصباحي' :
                             sessionType === 'evening' ? 'الدوام المسائي' :
                             'جميع الدوامات'}
                        </p>
                    </div>
                    <Button onClick={handleAddTeacher} className="gap-2">
                        <Plus className="h-4 w-4" />
                        إضافة أستاذ جديد
                    </Button>
                </div>

                <div className="grid grid-cols-12 gap-6">
                    {/* Teachers List Sidebar */}
                    <div className="col-span-12 lg:col-span-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">قائمة الأساتذة</CardTitle>
                                <CardDescription>
                                    {teachers.length} أستاذ مسجل
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="بحث عن أستاذ..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pr-10"
                                    />
                                </div>

                                {/* Teachers List */}
                                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                    {loading ? (
                                        <div className="text-center py-8">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                            <p className="text-sm text-muted-foreground mt-2">جاري التحميل...</p>
                                        </div>
                                    ) : filteredTeachers.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">لا توجد أساتذة</p>
                                        </div>
                                    ) : (
                                        filteredTeachers.map((teacher) => (
                                            <Button
                                                key={teacher.id}
                                                variant={selectedTeacher?.id === teacher.id ? "default" : "ghost"}
                                                className="w-full justify-start text-right"
                                                onClick={() => handleTeacherSelect(teacher)}
                                            >
                                                <div className="flex items-center gap-2 w-full">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                        {teacher.full_name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 text-right overflow-hidden">
                                                        <p className="font-medium truncate">{teacher.full_name}</p>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {teacher.phone || 'لا يوجد رقم'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </Button>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Teacher Details */}
                    <div className="col-span-12 lg:col-span-9">
                        {selectedTeacher ? (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-2xl">
                                                {selectedTeacher.full_name}
                                            </CardTitle>
                                            <CardDescription>
                                                {selectedTeacher.father_name && `والده: ${selectedTeacher.father_name}`}
                                            </CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                selectedTeacher.session_type === 'morning'
                                                    ? 'bg-accent/20 text-accent-foreground'
                                                    : 'bg-primary/20 text-primary'
                                            }`}>
                                                {selectedTeacher.session_type === 'morning' ? 'صباحي' : 'مسائي'}
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                selectedTeacher.is_active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {selectedTeacher.is_active ? 'نشط' : 'غير نشط'}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteTeacher(selectedTeacher.id!)}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'personal' | 'schedule')}>
                                        <TabsList className="grid w-full grid-cols-2 mb-6">
                                            <TabsTrigger value="personal" className="gap-2">
                                                <User className="h-4 w-4" />
                                                معلومات شخصية
                                            </TabsTrigger>
                                            <TabsTrigger value="schedule" className="gap-2">
                                                <Calendar className="h-4 w-4" />
                                                دوام
                                            </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="personal">
                                            <TeacherPersonalInfoTab
                                                teacher={selectedTeacher}
                                                onUpdate={handleTeacherUpdated}
                                            />
                                        </TabsContent>

                                        <TabsContent value="schedule">
                                            <TeacherScheduleTab
                                                teacher={selectedTeacher}
                                                onUpdate={handleTeacherUpdated}
                                            />
                                        </TabsContent>
                                    </Tabs>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardContent className="py-20">
                                    <div className="text-center">
                                        <Users className="h-20 w-20 text-muted-foreground mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                            لم يتم اختيار أستاذ
                                        </h3>
                                        <p className="text-muted-foreground">
                                            اختر أستاذاً من القائمة لعرض تفاصيله
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>

                {/* Add Teacher Dialog */}
                <TeacherAddDialog
                    open={showAddDialog}
                    onOpenChange={setShowAddDialog}
                    onSuccess={() => {
                        loadTeachers();
                        setShowAddDialog(false);
                    }}
                    sessionType={sessionType}
                />

                {/* Delete Teacher Confirmation Dialog */}
                <ConfirmationDialog
                    open={deleteConfirmOpen}
                    onOpenChange={setDeleteConfirmOpen}
                    title="حذف الأستاذ"
                    description="هل أنت متأكد من حذف هذا الأستاذ؟ لا يمكن التراجع عن هذا الإجراء."
                    confirmText="حذف"
                    cancelText="إلغاء"
                    variant="destructive"
                    onConfirm={confirmDeleteTeacher}
                />
            </div>
        </div>
    );
};

export default TeacherManagementPage;

