import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateInput } from '@/components/ui/date-input';
import {
    User,
    Phone,
    GraduationCap,
    Briefcase,
    Save,
    X,
    Plus,
    Trash2
} from 'lucide-react';
import { Teacher, SessionType, Qualification, Experience } from '@/types/school';
import { teachersApi } from '@/services/api';
import { toast } from '@/hooks/use-toast';

interface TeacherAddDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    sessionType?: string;
}

export const TeacherAddDialog: React.FC<TeacherAddDialogProps> = ({
    open,
    onOpenChange,
    onSuccess,
    sessionType: propSessionType
}) => {
    const [currentTab, setCurrentTab] = useState('basic');
    const [loading, setLoading] = useState(false);

    // Determine if user is director (can choose session type)
    const isDirector = !propSessionType;

    const [formData, setFormData] = useState({
        full_name: '',
        father_name: '',
        gender: 'male' as 'male' | 'female',
        birth_date: '',
        phone: '',
        nationality: '',
        detailed_address: '',
        transportation_type: '' as any,
        bus_number: '',
        session_type: propSessionType || 'morning', // Add session_type to form
        notes: ''
    });

    const [qualifications, setQualifications] = useState<Qualification[]>([]);
    const [experiences, setExperiences] = useState<Experience[]>([]);

    // Temporary states for adding new qualification/experience
    const [newQualification, setNewQualification] = useState({
        degree: '',
        specialization: '',
        institution: '',
        graduation_year: '',
        grade: '',
        notes: ''
    });

    const [newExperience, setNewExperience] = useState({
        job_title: '',
        institution: '',
        start_date: '',
        end_date: '',
        description: '',
        responsibilities: ''
    });

    const resetForm = () => {
        setFormData({
            full_name: '',
            father_name: '',
            gender: 'male',
            birth_date: '',
            phone: '',
            nationality: '',
            detailed_address: '',
            transportation_type: '',
            bus_number: '',
            session_type: propSessionType || 'morning',
            notes: ''
        });
        setQualifications([]);
        setExperiences([]);
        setNewQualification({
            degree: '',
            specialization: '',
            institution: '',
            graduation_year: '',
            grade: '',
            notes: ''
        });
        setNewExperience({
            job_title: '',
            institution: '',
            start_date: '',
            end_date: '',
            description: '',
            responsibilities: ''
        });
        setCurrentTab('basic');
    };

    const handleAddQualification = () => {
        if (!newQualification.degree || !newQualification.specialization || !newQualification.institution) {
            toast({
                title: "تحذير",
                description: "يرجى ملء الحقول المطلوبة (الشهادة، التخصص، المؤسسة)",
                variant: "destructive"
            });
            return;
        }

        setQualifications([...qualifications, { ...newQualification, id: Date.now().toString() }]);
        setNewQualification({
            degree: '',
            specialization: '',
            institution: '',
            graduation_year: '',
            grade: '',
            notes: ''
        });
    };

    const handleRemoveQualification = (id: string) => {
        setQualifications(qualifications.filter(q => q.id !== id));
    };

    const handleAddExperience = () => {
        if (!newExperience.job_title || !newExperience.institution || !newExperience.start_date) {
            toast({
                title: "تحذير",
                description: "يرجى ملء الحقول المطلوبة (المسمى، المؤسسة، تاريخ البداية)",
                variant: "destructive"
            });
            return;
        }

        setExperiences([...experiences, { ...newExperience, id: Date.now().toString() }]);
        setNewExperience({
            job_title: '',
            institution: '',
            start_date: '',
            end_date: '',
            description: '',
            responsibilities: ''
        });
    };

    const handleRemoveExperience = (id: string) => {
        setExperiences(experiences.filter(e => e.id !== id));
    };

    const handleSubmit = async () => {
        // Validation
        if (!formData.full_name || !formData.gender) {
            toast({
                title: "خطأ",
                description: "يرجى ملء الحقول المطلوبة (الاسم والجنس)",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            const academicYearId = localStorage.getItem('selected_academic_year_id');

            const teacherData: Omit<Teacher, 'id' | 'created_at' | 'updated_at'> = {
                academic_year_id: academicYearId ? parseInt(academicYearId) : 1,
                session_type: formData.session_type as SessionType,
                full_name: formData.full_name,
                father_name: formData.father_name || undefined,
                gender: formData.gender,
                birth_date: formData.birth_date || undefined,
                phone: formData.phone || undefined,
                nationality: formData.nationality || undefined,
                detailed_address: formData.detailed_address || undefined,
                transportation_type: formData.transportation_type || undefined,
                bus_number: formData.bus_number || undefined,
                qualifications: qualifications.length > 0 ? qualifications : undefined,
                experience: experiences.length > 0 ? experiences : undefined,
                notes: formData.notes || undefined,
                is_active: true
            };

            const response = await teachersApi.create(teacherData);

            if (response.success) {
                toast({
                    title: "نجاح",
                    description: "تم إضافة الأستاذ بنجاح",
                });
                resetForm();
                onSuccess();
            }
        } catch (error: any) {

            toast({
                title: "خطأ",
                description: error.message || "فشل في إضافة الأستاذ",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const transportationOptions = [
        { value: 'walking', label: 'مشي' },
        { value: 'full_bus', label: 'باص كامل (ذهاب وإياب)' },
        { value: 'half_bus_to_school', label: 'باص ذهاب فقط' },
        { value: 'half_bus_from_school', label: 'باص إياب فقط' }
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-2xl">إضافة أستاذ جديد</DialogTitle>
                    <DialogDescription>
                        أدخل معلومات الأستاذ الجديد
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="basic">
                            <User className="h-4 w-4 ml-2" />
                            أساسية
                        </TabsTrigger>
                        <TabsTrigger value="contact">
                            <Phone className="h-4 w-4 ml-2" />
                            تواصل
                        </TabsTrigger>
                        <TabsTrigger value="qualifications">
                            <GraduationCap className="h-4 w-4 ml-2" />
                            شهادات
                        </TabsTrigger>
                        <TabsTrigger value="experience">
                            <Briefcase className="h-4 w-4 ml-2" />
                            خبرات
                        </TabsTrigger>
                    </TabsList>

                    {/* Basic Info Tab */}
                    <TabsContent value="basic" className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="full_name">الاسم الكامل *</Label>
                            <Input
                                id="full_name"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                placeholder="أدخل الاسم الكامل للأستاذ"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="father_name">اسم الأب</Label>
                            <Input
                                id="father_name"
                                value={formData.father_name}
                                onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                                placeholder="اسم والد الأستاذ"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>الجنس *</Label>
                                <Select
                                    value={formData.gender}
                                    onValueChange={(value) => setFormData({ ...formData, gender: value as 'male' | 'female' })}
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
                                <DateInput
                                    label="تاريخ الميلاد"
                                    value={formData.birth_date}
                                    onChange={(date) => setFormData({ ...formData, birth_date: date })}
                                    placeholder="اختر تاريخ الميلاد"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="nationality">الجنسية</Label>
                            <Input
                                id="nationality"
                                value={formData.nationality}
                                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                                placeholder="الجنسية"
                            />
                        </div>

                        {/* Session Type - only show for director */}
                        {isDirector && (
                            <div className="space-y-2">
                                <Label>الدوام *</Label>
                                <Select
                                    value={formData.session_type}
                                    onValueChange={(value) => setFormData({ ...formData, session_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="morning">صباحي</SelectItem>
                                        <SelectItem value="evening">مسائي</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Show current session type for non-directors */}
                        {!isDirector && (
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">
                                    الدوام: <span className="font-medium text-foreground">
                                        {formData.session_type === 'morning' ? 'صباحي' : 'مسائي'}
                                    </span>
                                </p>
                            </div>
                        )}
                    </TabsContent>

                    {/* Contact & Transport Tab */}
                    <TabsContent value="contact" className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">رقم التواصل</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="07XXXXXXXXX"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address">العنوان التفصيلي</Label>
                            <Textarea
                                id="address"
                                value={formData.detailed_address}
                                onChange={(e) => setFormData({ ...formData, detailed_address: e.target.value })}
                                placeholder="العنوان الكامل"
                                rows={2}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>نوع المواصلات</Label>
                            <Select
                                value={formData.transportation_type}
                                onValueChange={(value) => setFormData({ ...formData, transportation_type: value as any })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر نوع المواصلات" />
                                </SelectTrigger>
                                <SelectContent>
                                    {transportationOptions.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {formData.transportation_type && formData.transportation_type !== 'walking' && (
                            <div className="space-y-2">
                                <Label htmlFor="bus_number">رقم الباص</Label>
                                <Input
                                    id="bus_number"
                                    value={formData.bus_number}
                                    onChange={(e) => setFormData({ ...formData, bus_number: e.target.value })}
                                    placeholder="رقم الباص"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="notes">ملاحظات</Label>
                            <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="أي ملاحظات إضافية"
                                rows={3}
                            />
                        </div>
                    </TabsContent>

                    {/* Qualifications Tab */}
                    <TabsContent value="qualifications" className="space-y-4 mt-4">
                        {/* List of added qualifications */}
                        {qualifications.length > 0 && (
                            <div className="space-y-2 mb-4">
                                <Label>الشهادات المضافة ({qualifications.length})</Label>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {qualifications.map((qual) => (
                                        <div key={qual.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{qual.degree} - {qual.specialization}</p>
                                                <p className="text-xs text-muted-foreground">{qual.institution}</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleRemoveQualification(qual.id!)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Add new qualification */}
                        <div className="space-y-3 p-4 border rounded-lg">
                            <Label className="text-base font-semibold">إضافة شهادة جديدة</Label>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-sm">الشهادة *</Label>
                                    <Input
                                        value={newQualification.degree}
                                        onChange={(e) => setNewQualification({ ...newQualification, degree: e.target.value })}
                                        placeholder="بكالوريوس، ماجستير..."
                                        className="text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm">التخصص *</Label>
                                    <Input
                                        value={newQualification.specialization}
                                        onChange={(e) => setNewQualification({ ...newQualification, specialization: e.target.value })}
                                        placeholder="رياضيات، فيزياء..."
                                        className="text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm">المؤسسة/الجامعة *</Label>
                                <Input
                                    value={newQualification.institution}
                                    onChange={(e) => setNewQualification({ ...newQualification, institution: e.target.value })}
                                    placeholder="اسم الجامعة"
                                    className="text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-sm">سنة التخرج</Label>
                                    <Input
                                        value={newQualification.graduation_year}
                                        onChange={(e) => setNewQualification({ ...newQualification, graduation_year: e.target.value })}
                                        placeholder="2020"
                                        className="text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm">التقدير</Label>
                                    <Input
                                        value={newQualification.grade}
                                        onChange={(e) => setNewQualification({ ...newQualification, grade: e.target.value })}
                                        placeholder="امتياز، جيد جداً..."
                                        className="text-sm"
                                    />
                                </div>
                            </div>

                            <Button
                                type="button"
                                onClick={handleAddQualification}
                                className="w-full"
                                size="sm"
                            >
                                <Plus className="h-4 w-4 ml-2" />
                                إضافة الشهادة
                            </Button>
                        </div>
                    </TabsContent>

                    {/* Experience Tab */}
                    <TabsContent value="experience" className="space-y-4 mt-4">
                        {/* List of added experiences */}
                        {experiences.length > 0 && (
                            <div className="space-y-2 mb-4">
                                <Label>الخبرات المضافة ({experiences.length})</Label>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {experiences.map((exp) => (
                                        <div key={exp.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{exp.job_title}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {exp.institution} • {exp.start_date} - {exp.end_date || 'حتى الآن'}
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleRemoveExperience(exp.id!)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Add new experience */}
                        <div className="space-y-3 p-4 border rounded-lg">
                            <Label className="text-base font-semibold">إضافة خبرة جديدة</Label>

                            <div className="space-y-2">
                                <Label className="text-sm">المسمى الوظيفي *</Label>
                                <Input
                                    value={newExperience.job_title}
                                    onChange={(e) => setNewExperience({ ...newExperience, job_title: e.target.value })}
                                    placeholder="مدرس، رئيس قسم..."
                                    className="text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm">المؤسسة/المدرسة *</Label>
                                <Input
                                    value={newExperience.institution}
                                    onChange={(e) => setNewExperience({ ...newExperience, institution: e.target.value })}
                                    placeholder="اسم المدرسة أو المؤسسة"
                                    className="text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <DateInput
                                        label="تاريخ البداية *"
                                        value={newExperience.start_date}
                                        onChange={(date) => setNewExperience({ ...newExperience, start_date: date })}
                                        placeholder="اختر تاريخ البداية"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <DateInput
                                        label="تاريخ النهاية"
                                        value={newExperience.end_date}
                                        onChange={(date) => setNewExperience({ ...newExperience, end_date: date })}
                                        placeholder="اتركه فارغاً إذا مستمر"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm">الوصف</Label>
                                <Textarea
                                    value={newExperience.description}
                                    onChange={(e) => setNewExperience({ ...newExperience, description: e.target.value })}
                                    placeholder="وصف مختصر للعمل"
                                    rows={2}
                                    className="text-sm"
                                />
                            </div>

                            <Button
                                type="button"
                                onClick={handleAddExperience}
                                className="w-full"
                                size="sm"
                            >
                                <Plus className="h-4 w-4 ml-2" />
                                إضافة الخبرة
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            resetForm();
                            onOpenChange(false);
                        }}
                        disabled={loading}
                    >
                        <X className="h-4 w-4 ml-2" />
                        إلغاء
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !formData.full_name}
                    >
                        <Save className="h-4 w-4 ml-2" />
                        {loading ? 'جاري الحفظ...' : 'حفظ الأستاذ'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
