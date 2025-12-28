import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import { StudentPayment } from '@/types/school';
import { studentsApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Save, AlertCircle } from 'lucide-react';

interface PaymentRecordingFormProps {
    studentId: number;
    academicYearId: number;
    onSuccess: () => void;
    onCancel: () => void;
}

export const PaymentRecordingForm = ({ studentId, academicYearId, onSuccess, onCancel }: PaymentRecordingFormProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors }
    } = useForm<StudentPayment>({
        defaultValues: {
            student_id: studentId,
            academic_year_id: academicYearId,
            payment_amount: 0,
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: 'cash'
        }
    });

    const onSubmit = async (data: StudentPayment) => {
        setIsSubmitting(true);
        try {
            // Call the API to record payment
            const response = await studentsApi.recordPayment(studentId, {
                ...data,
                academic_year_id: academicYearId
            });

            if (response.success) {
                toast({
                    title: "نجاح",
                    description: "تم تسجيل الدفعة المالية بنجاح!",
                    variant: "default"
                });
                onSuccess();
            } else {
                throw new Error(response.message || 'فشل في تسجيل الدفعة المالية');
            }
        } catch (error) {
            toast({
                title: "خطأ",
                description: error instanceof Error ? error.message : 'حدث خطأ أثناء تسجيل الدفعة',
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ar-IQ', {
            style: 'currency',
            currency: 'IQD',
            minimumFractionDigits: 0
        }).format(amount);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Save className="h-5 w-5" />
                    تسجيل دفعة مالية جديدة
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="payment_amount">المبلغ *</Label>
                            <Input
                                id="payment_amount"
                                type="number"
                                step="1000"
                                min="0"
                                {...register('payment_amount', {
                                    required: 'المبلغ مطلوب',
                                    min: { value: 1, message: 'المبلغ يجب أن يكون أكبر من صفر' }
                                })}
                                placeholder="أدخل المبلغ"
                            />
                            {errors.payment_amount && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{errors.payment_amount.message}</AlertDescription>
                                </Alert>
                            )}
                        </div>

                        <div className="space-y-2">
                            <DateInput
                                label="تاريخ الدفع *"
                                value={watch('payment_date') || ''}
                                onChange={(date) => setValue('payment_date', date, { shouldValidate: true })}
                                placeholder="اختر تاريخ الدفع"
                            />
                            {errors.payment_date && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{errors.payment_date.message}</AlertDescription>
                                </Alert>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="payment_method">طريقة الدفع</Label>
                            <Select
                                {...register('payment_method')}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر طريقة الدفع" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">نقداً</SelectItem>
                                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                                    <SelectItem value="check">شيك</SelectItem>
                                    <SelectItem value="credit_card">بطاقة ائتمان</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="receipt_number">رقم الإيصال</Label>
                            <Input
                                id="receipt_number"
                                {...register('receipt_number')}
                                placeholder="أدخل رقم الإيصال (إن وجد)"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">ملاحظات</Label>
                        <Textarea
                            id="notes"
                            {...register('notes')}
                            placeholder="أي ملاحظات إضافية حول الدفعة"
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end space-x-2 rtl:space-x-reverse">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            disabled={isSubmitting}
                        >
                            إلغاء
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    جاري التسجيل...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    تسجيل الدفعة
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};