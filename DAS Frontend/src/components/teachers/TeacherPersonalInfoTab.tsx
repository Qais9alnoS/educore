import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    User,
    Phone,
    MapPin,
    Calendar,
    Globe,
    Bus,
    GraduationCap,
    Briefcase,
    Plus,
    Edit,
    Trash2,
    Save,
    X
} from 'lucide-react';
import { Teacher, Qualification, Experience } from '@/types/school';
import { teachersApi } from '@/services/api';
import { toast } from '@/hooks/use-toast';

interface TeacherPersonalInfoTabProps {
    teacher: Teacher;
    onUpdate: () => void;
}

export const TeacherPersonalInfoTab: React.FC<TeacherPersonalInfoTabProps> = ({ teacher, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Teacher>({ ...teacher });
    const [showQualificationDialog, setShowQualificationDialog] = useState(false);
    const [showExperienceDialog, setShowExperienceDialog] = useState(false);
    const [editingQualification, setEditingQualification] = useState<Qualification | null>(null);
    const [editingExperience, setEditingExperience] = useState<Experience | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Update formData when teacher changes
    useEffect(() => {
        setFormData({ ...teacher });
        setIsEditing(false); // Reset editing mode when switching teachers
    }, [teacher.id]); // Only re-run when teacher ID changes

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await teachersApi.update(teacher.id!, formData);
            if (response.success) {
                toast({
                    title: "نجاح",
                    description: "تم تحديث بيانات الأستاذ بنجاح",
                });
                setIsEditing(false);
                onUpdate();
            }
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل في تحديث بيانات الأستاذ",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddQualification = async (qualification: Qualification) => {
        const qualifications = formData.qualifications || [];
        if (editingQualification) {
            // Edit existing
            const index = qualifications.findIndex(q => q.id === editingQualification.id);
            qualifications[index] = qualification;
        } else {
            // Add new
            qualifications.push({ ...qualification, id: Date.now().toString() });
        }
        const updatedData = { ...formData, qualifications };
        setFormData(updatedData);
        setShowQualificationDialog(false);
        setEditingQualification(null);

        // Save to database immediately
        setIsSaving(true);
        try {
            const response = await teachersApi.update(teacher.id!, { qualifications });

            if (response.success) {
                toast({
                    title: "نجاح",
                    description: "تم حفظ الشهادة بنجاح",
                });
                onUpdate();
            }
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل في حفظ الشهادة",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteQualification = async (id: string) => {
        const qualifications = (formData.qualifications || []).filter(q => q.id !== id);
        setFormData({ ...formData, qualifications });

        // Save to database immediately
        setIsSaving(true);
        try {
            const response = await teachersApi.update(teacher.id!, { qualifications });
            if (response.success) {
                toast({
                    title: "نجاح",
                    description: "تم حذف الشهادة بنجاح",
                });
                onUpdate();
            }
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل في حذف الشهادة",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddExperience = async (experience: Experience) => {
        const experiences = formData.experience || [];
        if (editingExperience) {
            // Edit existing
            const index = experiences.findIndex(e => e.id === editingExperience.id);
            experiences[index] = experience;
        } else {
            // Add new
            experiences.push({ ...experience, id: Date.now().toString() });
        }
        setFormData({ ...formData, experience: experiences });
        setShowExperienceDialog(false);
        setEditingExperience(null);

        // Save to database immediately
        setIsSaving(true);
        try {
            const response = await teachersApi.update(teacher.id!, { experience: experiences });
            if (response.success) {
                toast({
                    title: "نجاح",
                    description: "تم حفظ الخبرة بنجاح",
                });
                onUpdate();
            }
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل في حفظ الخبرة",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteExperience = async (id: string) => {
        const experiences = (formData.experience || []).filter(e => e.id !== id);
        setFormData({ ...formData, experience: experiences });

        // Save to database immediately
        setIsSaving(true);
        try {
            const response = await teachersApi.update(teacher.id!, { experience: experiences });
            if (response.success) {
                toast({
                    title: "نجاح",
                    description: "تم حذف الخبرة بنجاح",
                });
                onUpdate();
            }
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل في حذف الخبرة",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const transportationOptions = [
        { value: 'walking', label: 'مشي' },
        { value: 'full_bus', label: 'باص كامل (ذهاب وإياب)' },
        { value: 'half_bus_to_school', label: 'باص ذهاب فقط' },
        { value: 'half_bus_from_school', label: 'باص إياب فقط' }
    ];

    return (
        <div className="space-y-6">
            {/* Edit Controls */}
            <div className="flex justify-end gap-2">
                {isEditing ? (
                    <>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setFormData({ ...teacher });
                                setIsEditing(false);
                            }}
                            className="gap-2"
                        >
                            <X className="h-4 w-4" />
                            إلغاء
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                        </Button>
                    </>
                ) : (
                    <Button
                        onClick={() => setIsEditing(true)}
                        className="gap-2"
                    >
                        <Edit className="h-4 w-4" />
                        تعديل
                    </Button>
                )}
            </div>

            {/* Personal Information */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        المعلومات الشخصية
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>الاسم الكامل *</Label>
                        {isEditing ? (
                            <Input
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            />
                        ) : (
                            <p className="text-sm">{teacher.full_name}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>اسم الأب</Label>
                        {isEditing ? (
                            <Input
                                value={formData.father_name || ''}
                                onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                            />
                        ) : (
                            <p className="text-sm">{teacher.father_name || '-'}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>الجنس *</Label>
                        {isEditing ? (
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
                        ) : (
                            <p className="text-sm">{teacher.gender === 'male' ? 'ذكر' : 'أنثى'}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>تاريخ الميلاد</Label>
                        {isEditing ? (
                            <DateInput
                                value={formData.birth_date || ''}
                                onChange={(date) => setFormData({ ...formData, birth_date: date })}
                                placeholder="اختر تاريخ الميلاد"
                            />
                        ) : (
                            <p className="text-sm">{teacher.birth_date || '-'}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>رقم التواصل</Label>
                        {isEditing ? (
                            <Input
                                value={formData.phone || ''}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="07XXXXXXXXX"
                            />
                        ) : (
                            <p className="text-sm">{teacher.phone || '-'}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>الجنسية</Label>
                        {isEditing ? (
                            <Input
                                value={formData.nationality || ''}
                                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                            />
                        ) : (
                            <p className="text-sm">{teacher.nationality || '-'}</p>
                        )}
                    </div>

                    <div className="md:col-span-2 space-y-2">
                        <Label>العنوان التفصيلي</Label>
                        {isEditing ? (
                            <Textarea
                                value={formData.detailed_address || ''}
                                onChange={(e) => setFormData({ ...formData, detailed_address: e.target.value })}
                                rows={2}
                            />
                        ) : (
                            <p className="text-sm">{teacher.detailed_address || '-'}</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Transportation */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bus className="h-5 w-5" />
                        المواصلات
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>نوع المواصلات</Label>
                        {isEditing ? (
                            <Select
                                value={formData.transportation_type || ''}
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
                        ) : (
                            <p className="text-sm">
                                {transportationOptions.find(o => o.value === teacher.transportation_type)?.label || '-'}
                            </p>
                        )}
                    </div>

                    {(formData.transportation_type && formData.transportation_type !== 'walking') && (
                        <div className="space-y-2">
                            <Label>رقم الباص</Label>
                            {isEditing ? (
                                <Input
                                    value={formData.bus_number || ''}
                                    onChange={(e) => setFormData({ ...formData, bus_number: e.target.value })}
                                />
                            ) : (
                                <p className="text-sm">{teacher.bus_number || '-'}</p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Qualifications */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5" />
                            الشهادات العلمية
                        </CardTitle>
                        {isEditing && (
                            <Button
                                size="sm"
                                onClick={() => {
                                    setEditingQualification(null);
                                    setShowQualificationDialog(true);
                                }}
                                className="gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                إضافة شهادة
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {(formData.qualifications && formData.qualifications.length > 0) ? (
                        <div className="space-y-3">
                            {formData.qualifications.map((qual) => (
                                <div key={qual.id} className="border rounded-md p-3 space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-base">{qual.degree}</h4>
                                            <p className="text-sm text-muted-foreground">{qual.specialization}</p>
                                        </div>
                                        {isEditing && (
                                            <div className="flex gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditingQualification(qual);
                                                        setShowQualificationDialog(true);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteQualification(qual.id!)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">المؤسسة: </span>
                                            {qual.institution}
                                        </div>
                                        {qual.graduation_year && (
                                            <div>
                                                <span className="text-muted-foreground">سنة التخرج: </span>
                                                {qual.graduation_year}
                                            </div>
                                        )}
                                        {qual.grade && (
                                            <div>
                                                <span className="text-muted-foreground">التقدير: </span>
                                                {qual.grade}
                                            </div>
                                        )}
                                    </div>
                                    {qual.notes && (
                                        <p className="text-sm text-muted-foreground">{qual.notes}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">لا توجد شهادات مضافة</p>
                    )}
                </CardContent>
            </Card>

            {/* Experience */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Briefcase className="h-5 w-5" />
                            الخبرات العملية
                        </CardTitle>
                        {isEditing && (
                            <Button
                                size="sm"
                                onClick={() => {
                                    setEditingExperience(null);
                                    setShowExperienceDialog(true);
                                }}
                                className="gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                إضافة خبرة
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {(formData.experience && formData.experience.length > 0) ? (
                        <div className="space-y-3">
                            {formData.experience.map((exp) => (
                                <div key={exp.id} className="border rounded-md p-3 space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-base">{exp.job_title}</h4>
                                            <p className="text-sm text-muted-foreground">{exp.institution}</p>
                                        </div>
                                        {isEditing && (
                                            <div className="flex gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditingExperience(exp);
                                                        setShowExperienceDialog(true);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteExperience(exp.id!)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">الفترة: </span>
                                        {exp.start_date} - {exp.end_date || 'حتى الآن'}
                                    </div>
                                    {exp.description && (
                                        <p className="text-sm">{exp.description}</p>
                                    )}
                                    {exp.responsibilities && (
                                        <p className="text-sm text-muted-foreground">{exp.responsibilities}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">لا توجد خبرات مضافة</p>
                    )}
                </CardContent>
            </Card>

            {/* Notes */}
            <Card>
                <CardHeader>
                    <CardTitle>ملاحظات</CardTitle>
                </CardHeader>
                <CardContent>
                    {isEditing ? (
                        <Textarea
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={4}
                            placeholder="أي ملاحظات إضافية..."
                        />
                    ) : (
                        <p className="text-sm">{teacher.notes || '-'}</p>
                    )}
                </CardContent>
            </Card>

            {/* Qualification Dialog */}
            <QualificationDialog
                open={showQualificationDialog}
                onOpenChange={setShowQualificationDialog}
                qualification={editingQualification}
                onSave={handleAddQualification}
            />

            {/* Experience Dialog */}
            <ExperienceDialog
                open={showExperienceDialog}
                onOpenChange={setShowExperienceDialog}
                experience={editingExperience}
                onSave={handleAddExperience}
            />
        </div>
    );
};

// Qualification Dialog Component
interface QualificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    qualification: Qualification | null;
    onSave: (qualification: Qualification) => void;
}

const QualificationDialog: React.FC<QualificationDialogProps> = ({ open, onOpenChange, qualification, onSave }) => {
    const [formData, setFormData] = useState<Qualification>(
        qualification || {
            degree: '',
            specialization: '',
            institution: '',
            graduation_year: '',
            grade: '',
            notes: ''
        }
    );

    React.useEffect(() => {
        if (qualification) {
            setFormData(qualification);
        } else {
            setFormData({
                degree: '',
                specialization: '',
                institution: '',
                graduation_year: '',
                grade: '',
                notes: ''
            });
        }
    }, [qualification, open]);

    const handleSubmit = () => {
        if (!formData.degree || !formData.specialization || !formData.institution) {
            toast({
                title: "تحذير",
                description: "يرجى ملء الحقول المطلوبة",
                variant: "destructive"
            });
            return;
        }
        onSave({ ...formData, id: qualification?.id });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>{qualification ? 'تعديل الشهادة' : 'إضافة شهادة جديدة'}</DialogTitle>
                    <DialogDescription>أدخل معلومات الشهادة العلمية</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>الشهادة *</Label>
                        <Input
                            value={formData.degree}
                            onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                            placeholder="بكالوريوس، ماجستير، دكتوراه..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>التخصص *</Label>
                        <Input
                            value={formData.specialization}
                            onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                            placeholder="رياضيات، فيزياء، كيمياء..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>المؤسسة/الجامعة *</Label>
                        <Input
                            value={formData.institution}
                            onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                            placeholder="اسم الجامعة أو المؤسسة"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>سنة التخرج</Label>
                            <Input
                                value={formData.graduation_year || ''}
                                onChange={(e) => setFormData({ ...formData, graduation_year: e.target.value })}
                                placeholder="2020"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>التقدير</Label>
                            <Input
                                value={formData.grade || ''}
                                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                                placeholder="امتياز، جيد جداً..."
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>ملاحظات</Label>
                        <Textarea
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={2}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSubmit}>
                        {qualification ? 'تحديث' : 'إضافة'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Experience Dialog Component
interface ExperienceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    experience: Experience | null;
    onSave: (experience: Experience) => void;
}

const ExperienceDialog: React.FC<ExperienceDialogProps> = ({ open, onOpenChange, experience, onSave }) => {
    const [formData, setFormData] = useState<Experience>(
        experience || {
            job_title: '',
            institution: '',
            start_date: '',
            end_date: '',
            description: '',
            responsibilities: ''
        }
    );

    React.useEffect(() => {
        if (experience) {
            setFormData(experience);
        } else {
            setFormData({
                job_title: '',
                institution: '',
                start_date: '',
                end_date: '',
                description: '',
                responsibilities: ''
            });
        }
    }, [experience, open]);

    const handleSubmit = () => {
        if (!formData.job_title || !formData.institution || !formData.start_date) {
            toast({
                title: "تحذير",
                description: "يرجى ملء الحقول المطلوبة",
                variant: "destructive"
            });
            return;
        }
        onSave({ ...formData, id: experience?.id });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>{experience ? 'تعديل الخبرة' : 'إضافة خبرة جديدة'}</DialogTitle>
                    <DialogDescription>أدخل معلومات الخبرة العملية</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>المسمى الوظيفي *</Label>
                        <Input
                            value={formData.job_title}
                            onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                            placeholder="مدرس، رئيس قسم..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>المؤسسة/المدرسة *</Label>
                        <Input
                            value={formData.institution}
                            onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                            placeholder="اسم المدرسة أو المؤسسة"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <DateInput
                                label="تاريخ البداية *"
                                value={formData.start_date}
                                onChange={(date) => setFormData({ ...formData, start_date: date })}
                                placeholder="اختر تاريخ البداية"
                            />
                        </div>
                        <div className="space-y-2">
                            <DateInput
                                label="تاريخ النهاية"
                                value={formData.end_date || ''}
                                onChange={(date) => setFormData({ ...formData, end_date: date })}
                                placeholder="اتركه فارغاً إذا كان مستمراً"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>وصف العمل</Label>
                        <Textarea
                            value={formData.description || ''}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>المسؤوليات</Label>
                        <Textarea
                            value={formData.responsibilities || ''}
                            onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                            rows={2}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSubmit}>
                        {experience ? 'تحديث' : 'إضافة'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

