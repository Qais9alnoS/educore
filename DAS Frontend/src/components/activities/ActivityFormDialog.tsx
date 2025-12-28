import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Activity } from '@/types/school';
import { ImageUploadManager } from './ImageUploadManager';
import { DateInput } from '@/components/ui/date-input';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';

interface ActivityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: Activity | null;
  academicYearId: number;
  onSave: (activity: Partial<Activity>) => Promise<void>;
}

type FormStep = 1 | 2 | 3 | 4;

export const ActivityFormDialog: React.FC<ActivityFormDialogProps> = ({
  open,
  onOpenChange,
  activity,
  academicYearId,
  onSave,
}) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<FormStep>(1);
  const [saving, setSaving] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    activity_type: 'academic',
    session_type: 'both',
    target_grades: [] as string[],
    location: '',
    start_date: '',
    end_date: '',
    registration_deadline: '',
    max_participants: '',
    cost_per_student: '',
    requirements: '',
    instructor_name: '',
    images: [] as string[],
  });

  // Load activity data when editing
  useEffect(() => {
    if (activity) {
      const activityImages = activity.images ? (typeof activity.images === 'string' ? JSON.parse(activity.images) : activity.images) : [];
      setFormData({
        name: activity.name || '',
        description: activity.description || '',
        activity_type: activity.activity_type || 'academic',
        session_type: activity.session_type || 'both',
        target_grades: activity.target_grades || [],
        location: activity.location || '',
        start_date: activity.start_date || '',
        end_date: activity.end_date || '',
        registration_deadline: activity.registration_deadline || '',
        max_participants: activity.max_participants?.toString() || '',
        cost_per_student: activity.cost_per_student?.toString() || '',
        requirements: activity.requirements || '',
        instructor_name: activity.instructor_name || '',
        images: activityImages,
      });
    } else {
      // Reset form for new activity
      setFormData({
        name: '',
        description: '',
        activity_type: 'academic',
        session_type: 'both',
        target_grades: [],
        location: '',
        start_date: '',
        end_date: '',
        registration_deadline: '',
        max_participants: '',
        cost_per_student: '',
        requirements: '',
        instructor_name: '',
        images: [],
      });
    }
    setCurrentStep(1);
  }, [activity, open]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGradeToggle = (grade: string) => {
    setFormData((prev) => ({
      ...prev,
      target_grades: prev.target_grades.includes(grade)
        ? prev.target_grades.filter((g) => g !== grade)
        : [...prev.target_grades, grade],
    }));
  };

  const validateStep = (step: FormStep): boolean => {
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          toast({
            title: 'خطأ',
            description: 'يرجى إدخال اسم النشاط',
            variant: 'destructive',
          });
          return false;
        }
        if (!formData.activity_type) {
          toast({
            title: 'خطأ',
            description: 'يرجى اختيار نوع النشاط',
            variant: 'destructive',
          });
          return false;
        }
        if (formData.target_grades.length === 0) {
          toast({
            title: 'خطأ',
            description: 'يرجى اختيار المراحل المستهدفة',
            variant: 'destructive',
          });
          return false;
        }
        return true;

      case 2:
        if (!formData.start_date) {
          toast({
            title: 'خطأ',
            description: 'يرجى إدخال تاريخ البداية',
            variant: 'destructive',
          });
          return false;
        }
        if (!formData.end_date) {
          toast({
            title: 'خطأ',
            description: 'يرجى إدخال تاريخ النهاية',
            variant: 'destructive',
          });
          return false;
        }
        if (new Date(formData.end_date) < new Date(formData.start_date)) {
          toast({
            title: 'خطأ',
            description: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية',
            variant: 'destructive',
          });
          return false;
        }
        if (formData.registration_deadline && new Date(formData.registration_deadline) > new Date(formData.start_date)) {
          toast({
            title: 'خطأ',
            description: 'آخر موعد للتسجيل يجب أن يكون قبل تاريخ البداية',
            variant: 'destructive',
          });
          return false;
        }
        return true;

      case 3:
      case 4:
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(4, prev + 1) as FormStep);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1) as FormStep);
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    try {
      setSaving(true);
      const activityData: any = {
        academic_year_id: academicYearId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        activity_type: formData.activity_type,
        session_type: formData.session_type,
        target_grades: formData.target_grades,
        location: formData.location.trim() || undefined,
        start_date: formData.start_date,
        end_date: formData.end_date,
        registration_deadline: formData.registration_deadline || undefined,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : undefined,
        cost_per_student: formData.cost_per_student ? parseFloat(formData.cost_per_student) : 0,
        requirements: formData.requirements.trim() || undefined,
        instructor_name: formData.instructor_name.trim() || undefined,
        images: formData.images.length > 0 ? JSON.stringify(formData.images) : undefined,
        is_active: true,
      };

      await onSave(activityData);
      onOpenChange(false);
    } catch (error) {

      toast({
        title: 'خطأ',
        description: 'فشل في حفظ النشاط',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">اسم النشاط *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="مثال: معرض العلوم السنوي"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">الوصف</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="وصف تفصيلي للنشاط..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="activity_type">نوع النشاط *</Label>
                <Select value={formData.activity_type} onValueChange={(value) => handleInputChange('activity_type', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic">أكاديمي</SelectItem>
                    <SelectItem value="sports">رياضي</SelectItem>
                    <SelectItem value="cultural">ثقافي</SelectItem>
                    <SelectItem value="social">اجتماعي</SelectItem>
                    <SelectItem value="trip">رحلة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="session_type">نوع الدوام</Label>
                <Select value={formData.session_type} onValueChange={(value) => handleInputChange('session_type', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">صباحي</SelectItem>
                    <SelectItem value="evening">مسائي</SelectItem>
                    <SelectItem value="both">كلاهما</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>المراحل المستهدفة *</Label>
              <div className="flex flex-wrap gap-2">
                {['primary', 'intermediate', 'secondary'].map((grade) => (
                  <div key={grade} className="flex items-center gap-2">
                    <Checkbox
                      id={`grade-${grade}`}
                      checked={formData.target_grades.includes(grade)}
                      onCheckedChange={() => handleGradeToggle(grade)}
                    />
                    <Label htmlFor={`grade-${grade}`} className="cursor-pointer">
                      {grade === 'primary' ? 'ابتدائي' : grade === 'intermediate' ? 'إعدادي' : 'ثانوي'}
                    </Label>
                  </div>
                ))}
              </div>
              {formData.target_grades.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.target_grades.map((grade) => (
                    <Badge key={grade} variant="secondary">
                      {grade === 'primary' ? 'ابتدائي' : grade === 'intermediate' ? 'إعدادي' : 'ثانوي'}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">المكان</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="مثال: قاعة المدرسة الرئيسية"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <DateInput
                  label="تاريخ البداية *"
                  value={formData.start_date}
                  onChange={(date) => handleInputChange('start_date', date)}
                  placeholder="اختر تاريخ البداية"
                />
              </div>

              <div className="space-y-2">
                <DateInput
                  label="تاريخ النهاية *"
                  value={formData.end_date}
                  onChange={(date) => handleInputChange('end_date', date)}
                  placeholder="اختر تاريخ النهاية"
                />
              </div>
            </div>

            <div className="space-y-2">
              <DateInput
                label="آخر موعد للتسجيل"
                value={formData.registration_deadline}
                onChange={(date) => handleInputChange('registration_deadline', date)}
                placeholder="اختر آخر موعد للتسجيل (اختياري)"
              />
              <p className="text-sm text-muted-foreground">
                اختياري - يجب أن يكون قبل تاريخ بداية النشاط
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_participants">الحد الأقصى للمشاركين</Label>
              <Input
                id="max_participants"
                type="number"
                min="0"
                value={formData.max_participants}
                onChange={(e) => handleInputChange('max_participants', e.target.value)}
                placeholder="مثال: 50"
              />
              <p className="text-sm text-muted-foreground">
                اتركه فارغاً لعدد غير محدود
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cost_per_student">التكلفة لكل طالب (ل.س)</Label>
              <Input
                id="cost_per_student"
                type="number"
                min="0"
                step="0.01"
                value={formData.cost_per_student}
                onChange={(e) => handleInputChange('cost_per_student', e.target.value)}
                placeholder="0"
              />
              <p className="text-sm text-muted-foreground">
                اتركه 0 إذا كان النشاط مجانياً
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requirements">المتطلبات والملاحظات</Label>
              <Textarea
                id="requirements"
                value={formData.requirements}
                onChange={(e) => handleInputChange('requirements', e.target.value)}
                placeholder="مثال: إحضار معطف المختبر، دفتر الملاحظات..."
                rows={4}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instructor_name">اسم المشرف/المدرب</Label>
              <Input
                id="instructor_name"
                value={formData.instructor_name}
                onChange={(e) => handleInputChange('instructor_name', e.target.value)}
                placeholder="مثال: أ. محمد أحمد"
              />
            </div>

            <div className="space-y-2">
              <Label>الصور</Label>
              <ImageUploadManager
                images={formData.images}
                onImagesChange={(images) => handleInputChange('images', images)}
                maxImages={5}
              />
            </div>

            {/* Summary */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <h4 className="font-semibold mb-3">ملخص النشاط</h4>
              <div className="text-sm space-y-1">
                <p><span className="font-medium">الاسم:</span> {formData.name}</p>
                <p><span className="font-medium">النوع:</span> {formData.activity_type}</p>
                <p><span className="font-medium">الفترة:</span> {formData.start_date} إلى {formData.end_date}</p>
                <p><span className="font-medium">التكلفة:</span> {formData.cost_per_student || '0'} ل.س</p>
                {formData.max_participants && (
                  <p><span className="font-medium">الحد الأقصى:</span> {formData.max_participants} مشارك</p>
                )}
                {formData.images.length > 0 && (
                  <p><span className="font-medium">الصور:</span> {formData.images.length} صورة</p>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const steps = [
    { number: 1, title: 'المعلومات الأساسية' },
    { number: 2, title: 'التواريخ والحدود' },
    { number: 3, title: 'المالية' },
    { number: 4, title: 'التفاصيل النهائية' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{activity ? 'تعديل النشاط' : 'إضافة نشاط جديد'}</DialogTitle>
          <DialogDescription>
            {activity ? 'تعديل تفاصيل النشاط' : 'أضف نشاطاً جديداً للطلاب'}
          </DialogDescription>
        </DialogHeader>

        {/* Steps Indicator */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep === step.number
                      ? 'bg-primary text-primary-foreground'
                      : currentStep > step.number
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > step.number ? <Check className="h-5 w-5" /> : step.number}
                </div>
                <span className="text-xs mt-2 text-center max-w-[80px]">{step.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.number ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Form Content */}
        <div className="min-h-[300px]">{renderStepContent()}</div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1 || saving}>
            <ChevronRight className="h-4 w-4 ml-1" />
            السابق
          </Button>

          <span className="text-sm text-muted-foreground">
            الخطوة {currentStep} من {steps.length}
          </span>

          {currentStep < 4 ? (
            <Button onClick={handleNext} disabled={saving}>
              التالي
              <ChevronLeft className="h-4 w-4 mr-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 ml-1" />
                  حفظ النشاط
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

