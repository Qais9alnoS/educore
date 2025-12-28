import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DateInput } from '@/components/ui/date-input';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    User,
    Phone,
    MapPin,
    Calendar,
    BookOpen,
    Car,
    Save,
    ArrowLeft,
    ArrowRight,
    CheckCircle,
    Globe,
    FileText
} from 'lucide-react';
import { teachersApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Teacher } from '@/types/school';

// Teacher Registration Schema
const teacherSchema = z.object({
    // Personal Information
    full_name: z.string().min(2, 'اسم المعلم مطلوب'),
    gender: z.enum(['male', 'female'], { required_error: 'الجنس مطلوب' }),
    birth_date: z.string().optional(),
    nationality: z.string().optional(),
    session_type: z.enum(['morning', 'evening'], { required_error: 'نوع الدوام مطلوب' }),

    // Contact Information
    phone: z.string().optional(),
    detailed_address: z.string().optional(),

    // Transportation
    transportation_type: z.enum(['walking', 'full_bus', 'half_bus_to_school', 'half_bus_from_school']).optional(),

    // Professional Information
    qualifications: z.string().min(2, 'المؤهلات مطلوبة'),
    experience: z.string().optional(),
    free_time_slots: z.string().optional(),

    // Additional
    notes: z.string().optional()
});

type TeacherFormData = z.infer<typeof teacherSchema>;

interface TeacherRegistrationFormProps {
    onSubmit?: (data: TeacherFormData) => void;
    onCancel?: () => void;
    initialData?: Partial<TeacherFormData>;
    mode?: 'create' | 'edit';
}

export const TeacherRegistrationForm: React.FC<TeacherRegistrationFormProps> = ({
    onSubmit,
    onCancel,
    initialData,
    mode = 'create'
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const {
        control,
        handleSubmit,
        formState: { errors, isValid },
        watch,
        setValue,
        trigger
    } = useForm<TeacherFormData>({
        resolver: zodResolver(teacherSchema),
        defaultValues: {
            full_name: '',
            gender: undefined,
            birth_date: '',
            nationality: 'عراقي',
            phone: '',
            detailed_address: '',
            transportation_type: undefined,
            qualifications: '',
            experience: '',
            free_time_slots: '',
            notes: '',
            ...initialData
        },
        mode: 'onChange'
    });

    const steps = [
        {
            id: 1,
            title: 'المعلومات الشخصية',
            description: 'البيانات الأساسية للمعلم',
            icon: User,
            fields: ['full_name', 'gender', 'birth_date', 'nationality']
        },
        {
            id: 2,
            title: 'معلومات الاتصال والنقل',
            description: 'بيانات التواصل ووسائل النقل',
            icon: Phone,
            fields: ['phone', 'detailed_address', 'transportation_type']
        },
        {
            id: 3,
            title: 'المعلومات المهنية',
            description: 'المؤهلات والخبرات',
            icon: BookOpen,
            fields: ['qualifications', 'experience', 'free_time_slots']
        },
        {
            id: 4,
            title: 'ملاحظات إضافية',
            description: 'معلومات إضافية ومراجعة البيانات',
            icon: FileText,
            fields: ['notes']
        }
    ];

    const currentStepData = steps.find(step => step.id === currentStep);

    const handleNext = async () => {
        const fieldsToValidate = currentStepData?.fields || [];
        const isStepValid = await trigger(fieldsToValidate as any);

        if (isStepValid && currentStep < steps.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleFormSubmit = async (data: TeacherFormData) => {
        setIsSubmitting(true);
        try {
            // Call the real API to create/update teacher
            let response;
            if (mode === 'create') {
                // Create a properly typed object for the API call
                const teacherData = {
                    academic_year_id: 1, // This should be dynamically set based on current academic year
                    is_active: true,
                    full_name: data.full_name,
                    gender: data.gender,
                    session_type: data.session_type,
                    birth_date: data.birth_date || undefined,
                    nationality: data.nationality || undefined,
                    phone: data.phone || undefined,
                    detailed_address: data.detailed_address || undefined,
                    transportation_type: data.transportation_type || undefined,
                    qualifications: data.qualifications ? [{
                        degree: data.qualifications,
                        specialization: '',
                        institution: ''
                    }] : undefined,
                    experience: data.experience ? [{
                        job_title: data.experience,
                        institution: '',
                        start_date: ''
                    }] : undefined,
                    free_time_slots: data.free_time_slots || undefined,
                    notes: data.notes || undefined
                };

                // Create teacher with properly typed data
                response = await teachersApi.create(teacherData as any);
            } else {
                // For edit mode, we would need an ID
                // response = await teachersApi.update(teacherId, data);
                throw new Error('Edit mode not implemented yet');
            }

            if (response.success) {
                toast({
                    title: "نجاح",
                    description: `تم ${mode === 'create' ? 'تسجيل' : 'تحديث'} بيانات المعلم بنجاح!`,
                    variant: "default"
                });

                // Reset form or redirect
                if (onSubmit) {
                    await onSubmit(data);
                }
            } else {
                throw new Error(response.message || `فشل في ${mode === 'create' ? 'تسجيل' : 'تحديث'} المعلم`);
            }
        } catch (error) {
            toast({
                title: "خطأ",
                description: error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ البيانات',
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const genderOptions = [
        { value: 'male', label: 'ذكر' },
        { value: 'female', label: 'أنثى' }
    ];

    const transportationOptions = [
        { value: 'walking', label: 'مشي' },
        { value: 'full_bus', label: 'باص كامل (ذهاب وإياب)' },
        { value: 'half_bus_to_school', label: 'باص ذهاب فقط' },
        { value: 'half_bus_from_school', label: 'باص إياب فقط' }
    ];

    const watchedValues = watch();

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Progress Indicator */}
            <div className="flex items-center justify-between">
                {steps.map((step, index) => (
                    <React.Fragment key={step.id}>
                        <div className={`flex items-center space-x-2 space-x-reverse ${step.id === currentStep ? 'text-primary' :
                                step.id < currentStep ? 'text-green-600' : 'text-muted-foreground'
                            }`}>
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center border-2
                                ${step.id === currentStep ? 'border-primary bg-primary text-white' :
                                    step.id < currentStep ? 'border-green-600 bg-green-600 text-white' :
                                        'border-gray-300 bg-white text-gray-400'}
                            `}>
                                {step.id < currentStep ? (
                                    <CheckCircle className="w-5 h-5" />
                                ) : (
                                    <step.icon className="w-5 h-5" />
                                )}
                            </div>
                            <div className="hidden md:block">
                                <div className="text-sm font-medium">{step.title}</div>
                                <div className="text-xs text-muted-foreground">{step.description}</div>
                            </div>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`flex-1 h-1 mx-4 rounded ${step.id < currentStep ? 'bg-green-600' : 'bg-gray-200'
                                }`} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <div className="flex items-center space-x-3 space-x-reverse">
                            <currentStepData.icon className="w-6 h-6 text-primary" />
                            <div>
                                <CardTitle>{currentStepData.title}</CardTitle>
                                <CardDescription>{currentStepData.description}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Step 1: Personal Information */}
                        {currentStep === 1 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Full Name */}
                                <div className="md:col-span-2 space-y-2">
                                    <Label htmlFor="full_name" className="flex items-center space-x-2 space-x-reverse">
                                        <User className="w-4 h-4" />
                                        <span>اسم المعلم الكامل *</span>
                                    </Label>
                                    <Controller
                                        name="full_name"
                                        control={control}
                                        render={({ field }) => (
                                            <Input
                                                {...field}
                                                placeholder="اسم المعلم الكامل"
                                                className={errors.full_name ? 'border-red-500' : ''}
                                            />
                                        )}
                                    />
                                    {errors.full_name && (
                                        <p className="text-sm text-red-500">{errors.full_name.message}</p>
                                    )}
                                </div>

                                {/* Gender */}
                                <div className="space-y-2">
                                    <Label>الجنس *</Label>
                                    <Controller
                                        name="gender"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className={errors.gender ? 'border-red-500' : ''}>
                                                    <SelectValue placeholder="اختر الجنس" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {genderOptions.map(option => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.gender && (
                                        <p className="text-sm text-red-500">{errors.gender.message}</p>
                                    )}
                                </div>

                                {/* Birth Date */}
                                <div className="space-y-2">
                                    <Controller
                                        name="birth_date"
                                        control={control}
                                        render={({ field }) => (
                                            <DateInput
                                                label="تاريخ الميلاد"
                                                value={field.value || ''}
                                                onChange={field.onChange}
                                                placeholder="اختر تاريخ الميلاد"
                                            />
                                        )}
                                    />
                                </div>

                                {/* Nationality */}
                                <div className="space-y-2">
                                    <Label htmlFor="nationality" className="flex items-center space-x-2 space-x-reverse">
                                        <Globe className="w-4 h-4" />
                                        <span>الجنسية</span>
                                    </Label>
                                    <Controller
                                        name="nationality"
                                        control={control}
                                        render={({ field }) => (
                                            <Input
                                                {...field}
                                                placeholder="الجنسية"
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 2: Contact and Transportation */}
                        {currentStep === 2 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Phone */}
                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="flex items-center space-x-2 space-x-reverse">
                                        <Phone className="w-4 h-4" />
                                        <span>رقم الهاتف</span>
                                    </Label>
                                    <Controller
                                        name="phone"
                                        control={control}
                                        render={({ field }) => (
                                            <Input
                                                {...field}
                                                placeholder="رقم الهاتف"
                                                type="tel"
                                            />
                                        )}
                                    />
                                </div>

                                {/* Transportation */}
                                <div className="space-y-2">
                                    <Label className="flex items-center space-x-2 space-x-reverse">
                                        <Car className="w-4 h-4" />
                                        <span>وسيلة النقل</span>
                                    </Label>
                                    <Controller
                                        name="transportation_type"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="اختر وسيلة النقل" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {transportationOptions.map(option => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>

                                {/* Address */}
                                <div className="md:col-span-2 space-y-2">
                                    <Label htmlFor="detailed_address" className="flex items-center space-x-2 space-x-reverse">
                                        <MapPin className="w-4 h-4" />
                                        <span>العنوان التفصيلي</span>
                                    </Label>
                                    <Controller
                                        name="detailed_address"
                                        control={control}
                                        render={({ field }) => (
                                            <Textarea
                                                {...field}
                                                placeholder="العنوان التفصيلي"
                                                rows={3}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 3: Professional Information */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                {/* Qualifications */}
                                <div className="space-y-2">
                                    <Label htmlFor="qualifications" className="flex items-center space-x-2 space-x-reverse">
                                        <BookOpen className="w-4 h-4" />
                                        <span>المؤهلات العلمية *</span>
                                    </Label>
                                    <Controller
                                        name="qualifications"
                                        control={control}
                                        render={({ field }) => (
                                            <Textarea
                                                {...field}
                                                placeholder="المؤهلات العلمية والشهادات"
                                                rows={3}
                                                className={errors.qualifications ? 'border-red-500' : ''}
                                            />
                                        )}
                                    />
                                    {errors.qualifications && (
                                        <p className="text-sm text-red-500">{errors.qualifications.message}</p>
                                    )}
                                </div>

                                {/* Experience */}
                                <div className="space-y-2">
                                    <Label htmlFor="experience">الخبرة المهنية</Label>
                                    <Controller
                                        name="experience"
                                        control={control}
                                        render={({ field }) => (
                                            <Textarea
                                                {...field}
                                                placeholder="الخبرة المهنية والوظائف السابقة"
                                                rows={3}
                                            />
                                        )}
                                    />
                                </div>

                                {/* Free Time Slots */}
                                <div className="space-y-2">
                                    <Label htmlFor="free_time_slots">الأوقات المتاحة للتدريس</Label>
                                    <Controller
                                        name="free_time_slots"
                                        control={control}
                                        render={({ field }) => (
                                            <Textarea
                                                {...field}
                                                placeholder="الأوقات المتاحة والفترات المفضلة للتدريس"
                                                rows={3}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 4: Additional Notes and Review */}
                        {currentStep === 4 && (
                            <div className="space-y-6">
                                {/* Notes */}
                                <div className="space-y-2">
                                    <Label htmlFor="notes">ملاحظات إضافية</Label>
                                    <Controller
                                        name="notes"
                                        control={control}
                                        render={({ field }) => (
                                            <Textarea
                                                {...field}
                                                placeholder="أي ملاحظات إضافية أو معلومات مهمة"
                                                rows={4}
                                            />
                                        )}
                                    />
                                </div>

                                <Separator />

                                {/* Data Review */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">مراجعة البيانات</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium text-muted-foreground">اسم المعلم</Label>
                                            <p className="text-sm">{watchedValues.full_name || '-'}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium text-muted-foreground">الجنس</Label>
                                            <p className="text-sm">
                                                {watchedValues.gender === 'male' ? 'ذكر' :
                                                    watchedValues.gender === 'female' ? 'أنثى' : '-'}
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium text-muted-foreground">رقم الهاتف</Label>
                                            <p className="text-sm">{watchedValues.phone || '-'}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium text-muted-foreground">المؤهلات</Label>
                                            <p className="text-sm">{watchedValues.qualifications || '-'}</p>
                                        </div>
                                    </div>

                                    {!isValid && (
                                        <Alert>
                                            <AlertDescription>
                                                يرجى التأكد من ملء جميع الحقول المطلوبة بشكل صحيح
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between">
                    <div className="flex space-x-2 space-x-reverse">
                        {currentStep > 1 && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handlePrevious}
                                className="flex items-center space-x-2 space-x-reverse"
                            >
                                <ArrowRight className="w-4 h-4" />
                                <span>السابق</span>
                            </Button>
                        )}

                        {onCancel && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onCancel}
                            >
                                إلغاء
                            </Button>
                        )}
                    </div>

                    <div className="flex space-x-2 space-x-reverse">
                        {currentStep < steps.length ? (
                            <Button
                                type="button"
                                onClick={handleNext}
                                className="flex items-center space-x-2 space-x-reverse"
                            >
                                <span>التالي</span>
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                disabled={!isValid || isSubmitting}
                                className="flex items-center space-x-2 space-x-reverse btn-premium"
                            >
                                <Save className="w-4 h-4" />
                                <span>
                                    {isSubmitting ? 'جاري الحفظ...' :
                                        mode === 'create' ? 'تسجيل المعلم' : 'تحديث البيانات'}
                                </span>
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
};