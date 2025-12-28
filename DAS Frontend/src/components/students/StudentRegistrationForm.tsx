import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { DateInput } from '@/components/ui/date-input';
import { StudentRegistrationForm as StudentFormType, GradeLevel, SessionType, TransportationType } from '@/types/school';
import { User, Phone, MapPin, GraduationCap, Bus, FileText, Save, AlertCircle } from 'lucide-react';
import { studentsApi } from '@/services/api'; // Import the real API
import { useToast } from '@/hooks/use-toast'; // Import toast hook

export const StudentRegistrationForm = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast(); // Initialize toast

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors }
    } = useForm<StudentFormType>();

    const watchedValues = watch();

    const onSubmit = async (data: StudentFormType) => {
        setIsSubmitting(true);
        try {
            // Call the real API to create student
            const response = await studentsApi.create({
                ...data,
                academic_year_id: 1, // This should be dynamically set based on current academic year
                is_active: true
            });

            if (response.success) {
                toast({
                    title: "نجاح",
                    description: "تم تسجيل الطالب بنجاح!",
                    variant: "default"
                });
                // Reset form or redirect to student list
            } else {
                throw new Error(response.message || 'فشل في تسجيل الطالب');
            }
        } catch (error) {
            toast({
                title: "خطأ",
                description: error instanceof Error ? error.message : 'حدث خطأ أثناء التسجيل',
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const steps = [
        { id: 'personal', title: 'البيانات الشخصية', icon: User },
        { id: 'contact', title: 'بيانات الاتصال', icon: Phone },
        { id: 'academic', title: 'البيانات الأكاديمية', icon: GraduationCap },
        { id: 'transport', title: 'النقل والإضافات', icon: Bus }
    ];

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-8">
                {steps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                        <div
                            className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${index <= currentStep
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-gray-100 text-gray-400 border-gray-300'
                                }`}
                        >
                            <step.icon className="h-5 w-5" />
                        </div>
                        <div className="ml-4">
                            <div className="text-sm font-medium">{step.title}</div>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`w-16 h-1 mx-4 ${index < currentStep ? 'bg-primary' : 'bg-gray-200'
                                }`} />
                        )}
                    </div>
                ))}
            </div>

            <Tabs value={steps[currentStep].id} className="space-y-6">
                {/* Personal Information */}
                <TabsContent value="personal">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                البيانات الشخصية
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="full_name">الاسم الكامل *</Label>
                                    <Input
                                        id="full_name"
                                        {...register('full_name', { required: 'الاسم الكامل مطلوب' })}
                                        placeholder="أدخل الاسم الكامل للطالب"
                                    />
                                    {errors.full_name && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>{errors.full_name.message}</AlertDescription>
                                        </Alert>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="father_name">اسم الأب *</Label>
                                    <Input
                                        id="father_name"
                                        {...register('father_name', { required: 'اسم الأب مطلوب' })}
                                        placeholder="أدخل اسم الأب"
                                    />
                                    {errors.father_name && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>{errors.father_name.message}</AlertDescription>
                                        </Alert>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="grandfather_name">اسم الجد *</Label>
                                    <Input
                                        id="grandfather_name"
                                        {...register('grandfather_name', { required: 'اسم الجد مطلوب' })}
                                        placeholder="أدخل اسم الجد"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="mother_name">اسم الأم *</Label>
                                    <Input
                                        id="mother_name"
                                        {...register('mother_name', { required: 'اسم الأم مطلوب' })}
                                        placeholder="أدخل اسم الأم"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <DateInput
                                        label="تاريخ الميلاد *"
                                        value={watch('birth_date') || ''}
                                        onChange={(date) => setValue('birth_date', date, { shouldValidate: true })}
                                        placeholder="اختر تاريخ الميلاد"
                                    />
                                    {errors.birth_date && (
                                        <p className="text-sm text-red-500">{(errors.birth_date as any)?.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="birth_place">مكان الميلاد</Label>
                                    <Input
                                        id="birth_place"
                                        {...register('birth_place')}
                                        placeholder="أدخل مكان الميلاد"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="nationality">الجنسية</Label>
                                    <Input
                                        id="nationality"
                                        {...register('nationality')}
                                        placeholder="أدخل الجنسية"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="religion">الديانة</Label>
                                    <Input
                                        id="religion"
                                        {...register('religion')}
                                        placeholder="أدخل الديانة"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label>الجنس *</Label>
                                <RadioGroup
                                    value={watchedValues.gender}
                                    onValueChange={(value) => setValue('gender', value as 'male' | 'female')}
                                >
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="male" id="male" />
                                        <Label htmlFor="male">ذكر</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="female" id="female" />
                                        <Label htmlFor="female">أنثى</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {/* Special Needs */}
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <Checkbox
                                        id="has_special_needs"
                                        checked={watchedValues.has_special_needs}
                                        onCheckedChange={(checked) => setValue('has_special_needs', !!checked)}
                                    />
                                    <Label htmlFor="has_special_needs">يحتاج رعاية خاصة</Label>
                                </div>

                                {watchedValues.has_special_needs && (
                                    <div className="space-y-2">
                                        <Label htmlFor="special_needs_details">تفاصيل الرعاية الخاصة</Label>
                                        <Textarea
                                            id="special_needs_details"
                                            {...register('special_needs_details')}
                                            placeholder="اشرح نوع الرعاية الخاصة المطلوبة"
                                        />
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Contact Information */}
                <TabsContent value="contact">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Phone className="h-5 w-5" />
                                بيانات الاتصال والعائلة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="father_phone">هاتف الأب</Label>
                                    <Input
                                        id="father_phone"
                                        {...register('father_phone')}
                                        placeholder="رقم هاتف الأب"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="mother_phone">هاتف الأم</Label>
                                    <Input
                                        id="mother_phone"
                                        {...register('mother_phone')}
                                        placeholder="رقم هاتف الأم"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="landline_phone">الهاتف الأرضي</Label>
                                    <Input
                                        id="landline_phone"
                                        {...register('landline_phone')}
                                        placeholder="رقم الهاتف الأرضي"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="additional_phone">هاتف إضافي</Label>
                                    <Input
                                        id="additional_phone"
                                        {...register('additional_phone')}
                                        placeholder="رقم هاتف إضافي"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="father_occupation">مهنة الأب</Label>
                                    <Input
                                        id="father_occupation"
                                        {...register('father_occupation')}
                                        placeholder="مهنة الأب"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="mother_occupation">مهنة الأم</Label>
                                    <Input
                                        id="mother_occupation"
                                        {...register('mother_occupation')}
                                        placeholder="مهنة الأم"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="detailed_address">العنوان التفصيلي</Label>
                                <Textarea
                                    id="detailed_address"
                                    {...register('detailed_address')}
                                    placeholder="أدخل العنوان التفصيلي للطالب"
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Academic Information */}
                <TabsContent value="academic">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <GraduationCap className="h-5 w-5" />
                                البيانات الأكاديمية
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="grade_level">المرحلة الدراسية *</Label>
                                    <Select
                                        value={watchedValues.grade_level}
                                        onValueChange={(value) => setValue('grade_level', value as GradeLevel)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر المرحلة الدراسية" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="primary">الابتدائية</SelectItem>
                                            <SelectItem value="intermediate">الإعدادية</SelectItem>
                                            <SelectItem value="secondary">الثانوية</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="grade_number">الصف *</Label>
                                    <Select
                                        value={watchedValues.grade_number?.toString()}
                                        onValueChange={(value) => setValue('grade_number', parseInt(value))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الصف" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {watchedValues.grade_level === 'primary' && (
                                                <>
                                                    <SelectItem value="1">الأول الابتدائي</SelectItem>
                                                    <SelectItem value="2">الثاني الابتدائي</SelectItem>
                                                    <SelectItem value="3">الثالث الابتدائي</SelectItem>
                                                    <SelectItem value="4">الرابع الابتدائي</SelectItem>
                                                    <SelectItem value="5">الخامس الابتدائي</SelectItem>
                                                    <SelectItem value="6">السادس الابتدائي</SelectItem>
                                                </>
                                            )}
                                            {watchedValues.grade_level === 'intermediate' && (
                                                <>
                                                    <SelectItem value="1">الأول الإعدادي</SelectItem>
                                                    <SelectItem value="2">الثاني الإعدادي</SelectItem>
                                                    <SelectItem value="3">الثالث الإعدادي</SelectItem>
                                                </>
                                            )}
                                            {watchedValues.grade_level === 'secondary' && (
                                                <>
                                                    <SelectItem value="1">الأول الثانوي</SelectItem>
                                                    <SelectItem value="2">الثاني الثانوي</SelectItem>
                                                    <SelectItem value="3">الثالث الثانوي</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="session_type">الفترة الدراسية *</Label>
                                    <Select
                                        value={watchedValues.session_type}
                                        onValueChange={(value) => setValue('session_type', value as SessionType)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الفترة الدراسية" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="morning">الفترة الصباحية</SelectItem>
                                            <SelectItem value="evening">الفترة المسائية</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="section">الشعبة</Label>
                                    <Input
                                        id="section"
                                        {...register('section')}
                                        placeholder="مثال: أ، ب، ج"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="previous_school">المدرسة السابقة</Label>
                                    <Input
                                        id="previous_school"
                                        {...register('previous_school')}
                                        placeholder="اسم المدرسة السابقة (إن وجدت)"
                                    />
                                </div>

                                {watchedValues.grade_level === 'secondary' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="ninth_grade_total">مجموع التاسع</Label>
                                        <Input
                                            id="ninth_grade_total"
                                            type="number"
                                            {...register('ninth_grade_total', { valueAsNumber: true })}
                                            placeholder="مجموع درجات الصف التاسع"
                                        />
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Transportation */}
                <TabsContent value="transport">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bus className="h-5 w-5" />
                                النقل والملاحظات
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <Label>وسيلة النقل *</Label>
                                <RadioGroup
                                    value={watchedValues.transportation_type}
                                    onValueChange={(value) => setValue('transportation_type', value as TransportationType)}
                                >
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="walking" id="walking" />
                                        <Label htmlFor="walking">مشي</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="full_bus" id="full_bus" />
                                        <Label htmlFor="full_bus">باص كامل (ذهاب وإياب)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="half_bus_to_school" id="half_bus_to_school" />
                                        <Label htmlFor="half_bus_to_school">باص نصف (ذهاب فقط)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="half_bus_from_school" id="half_bus_from_school" />
                                        <Label htmlFor="half_bus_from_school">باص نصف (إياب فقط)</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {watchedValues.transportation_type?.includes('bus') && (
                                <div className="space-y-2">
                                    <Label htmlFor="bus_number">رقم الباص</Label>
                                    <Input
                                        id="bus_number"
                                        {...register('bus_number')}
                                        placeholder="رقم الباص المخصص"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="notes">ملاحظات إضافية</Label>
                                <Textarea
                                    id="notes"
                                    {...register('notes')}
                                    placeholder="أي ملاحظات أو معلومات إضافية عن الطالب"
                                    rows={4}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-6">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                >
                    السابق
                </Button>

                <div className="flex gap-2">
                    {currentStep < steps.length - 1 ? (
                        <Button
                            type="button"
                            onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                            disabled={!watchedValues.full_name || !watchedValues.father_name || !watchedValues.gender}
                        >
                            التالي
                        </Button>
                    ) : (
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    جاري الحفظ...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    حفظ البيانات
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </form>
    );
};