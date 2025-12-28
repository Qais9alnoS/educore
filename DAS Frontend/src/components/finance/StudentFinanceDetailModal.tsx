import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DateInput } from '@/components/ui/date-input';
import { BalanceHistoryModal } from './BalanceHistoryModal';
import {
  Save,
  Plus,
  Receipt,
  TrendingDown,
  DollarSign,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle,
  History
} from 'lucide-react';
import { StudentFinanceDetailed, StudentPayment, StudentFinance } from '@/types/school';
import { financeManagerApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface StudentFinanceDetailModalProps {
  open: boolean;
  onClose: () => void;
  studentId: number;
  academicYearId: number;
  onUpdate?: () => void;
}

export const StudentFinanceDetailModal: React.FC<StudentFinanceDetailModalProps> = ({
  open,
  onClose,
  studentId,
  academicYearId,
  onUpdate
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState<StudentFinanceDetailed | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptNumber, setReceiptNumber] = useState('');

  // Finance form state
  const [schoolFee, setSchoolFee] = useState(0);
  const [schoolDiscountType, setSchoolDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [schoolDiscountValue, setSchoolDiscountValue] = useState(0);
  const [schoolDiscountReason, setSchoolDiscountReason] = useState('');

  const [busFee, setBusFee] = useState(0);
  const [busDiscountType, setBusDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [busDiscountValue, setBusDiscountValue] = useState(0);
  const [busDiscountReason, setBusDiscountReason] = useState('');

  const [uniformType, setUniformType] = useState('');
  const [uniformAmount, setUniformAmount] = useState(0);
  const [courseType, setCourseType] = useState('');
  const [courseAmount, setCourseAmount] = useState(0);
  const [otherRevenueItems, setOtherRevenueItems] = useState<Array<{ name: string; amount: number }>>([]);
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    if (open && studentId && academicYearId) {
      loadStudentDetails();
    }
  }, [open, studentId, academicYearId]);

  const loadStudentDetails = async () => {
    try {
      setLoading(true);
      const response = await financeManagerApi.getStudentFinanceDetailed(studentId, academicYearId);
      setStudent(response.data);

      // Populate form with existing data
      if (response.data) {
        setSchoolFee(response.data.school_fee);
        setSchoolDiscountType(response.data.school_discount_type);
        setSchoolDiscountValue(response.data.school_discount_value);
        setSchoolDiscountReason(''); // school_discount_reason not in type

        setBusFee(response.data.bus_fee);
        setBusDiscountType(response.data.bus_discount_type);
        setBusDiscountValue(response.data.bus_discount_value);
        setBusDiscountReason(''); // bus_discount_reason not in type

        setUniformType(response.data.uniform_type || '');
        setUniformAmount(response.data.uniform_amount);
        setCourseType(response.data.course_type || '');
        setCourseAmount(response.data.course_amount);
        setOtherRevenueItems(response.data.other_revenue_items || []);
        setPaymentNotes(response.data.payment_notes || '');
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل تحميل البيانات المالية للطالب',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({
        title: 'تنبيه',
        description: 'يرجى إدخال مبلغ صحيح',
        variant: 'destructive'
      });
      return;
    }

    // Validate payment amount doesn't exceed what is owed (only if total owed > 0)
    const amount = parseFloat(paymentAmount);
    if (student) {
      const totalOwed = Number(student.total_amount) || 0;
      const totalPaid = Number(student.total_paid) || 0;

      // Only validate if totalOwed > 0 (to avoid false positives when data is incomplete)
      if (totalOwed > 0 && (totalPaid + amount) > totalOwed) {
        const remaining = totalOwed - totalPaid;
        if (remaining <= 0) {
          toast({
            title: 'خطأ',
            description: `لا يمكن إضافة دفعة. الطالب قد سدد كامل المبلغ المطلوب (${totalOwed.toLocaleString('ar-SY')} ل.س)`,
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'خطأ',
            description: `المبلغ المدخل (${amount.toLocaleString('ar-SY')} ل.س) يتجاوز الرصيد المتبقي (${remaining.toLocaleString('ar-SY')} ل.س). الإجمالي المطلوب: ${totalOwed.toLocaleString('ar-SY')} ل.س`,
            variant: 'destructive'
          });
        }
        return;
      }
    }

    try {
      setLoading(true);
      await financeManagerApi.addStudentPayment(studentId, {
        student_id: studentId,
        academic_year_id: academicYearId,
        payment_amount: amount,
        payment_date: paymentDate,
        receipt_number: receiptNumber || undefined
      });

      toast({
        title: 'نجح',
        description: 'تم تسجيل الدفعة بنجاح'
      });

      setPaymentAmount('');
      setReceiptNumber('');
      setShowPaymentForm(false);
      loadStudentDetails();
      onUpdate?.();
    } catch (error: any) {
      // استخراج رسالة الخطأ من صيغ مختلفة
      let errorMessage = 'فشل تسجيل الدفعة';

      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.details?.detail) {
        errorMessage = error.details.detail;
      } else if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }

      toast({
        title: 'خطأ في تسجيل الدفعة',
        description: errorMessage,
        variant: 'destructive',
        duration: 6000 // عرض الرسالة لمدة أطول
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFinances = async () => {
    try {
      setLoading(true);
      const updateData: Partial<StudentFinance> = {
        school_fee: schoolFee,
        school_discount_type: schoolDiscountType,
        school_discount_value: schoolDiscountValue,
        school_discount_reason: schoolDiscountReason,
        bus_fee: busFee,
        bus_discount_type: busDiscountType,
        bus_discount_value: busDiscountValue,
        bus_discount_reason: busDiscountReason,
        uniform_type: uniformType,
        uniform_amount: uniformAmount,
        course_type: courseType,
        course_amount: courseAmount,
        other_revenue_items: otherRevenueItems,
        payment_notes: paymentNotes
      };

      await financeManagerApi.updateStudentFinances(studentId, academicYearId, updateData);

      toast({
        title: 'نجح',
        description: 'تم تحديث المعلومات المالية بنجاح'
      });

      loadStudentDetails();
      onUpdate?.();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل تحديث المعلومات المالية',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDiscount = (amount: number, type: 'fixed' | 'percentage', value: number) => {
    if (type === 'percentage') {
      return (amount * value) / 100;
    }
    return value;
  };

  if (!student && !loading) return null;

  const schoolDiscount = calculateDiscount(schoolFee, schoolDiscountType, schoolDiscountValue);
  const busDiscount = calculateDiscount(busFee, busDiscountType, busDiscountValue);
  const totalOtherRevenues = uniformAmount + courseAmount + otherRevenueItems.reduce((sum, item) => sum + item.amount, 0);
  const totalAmount = (schoolFee - schoolDiscount) + (busFee - busDiscount) + totalOtherRevenues;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {student?.student_name} - المعلومات المالية
          </DialogTitle>
        </DialogHeader>

        {loading && <div className="text-center py-8">جاري التحميل...</div>}

        {student && !loading && (
          <div className="space-y-6">
            {/* Section 1: إضافة تسديد */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    إضافة تسديد
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPaymentForm(!showPaymentForm)}
                  >
                    {showPaymentForm ? 'إلغاء' : <Plus className="w-4 h-4" />}
                  </Button>
                </div>

                {showPaymentForm && (
                  <div className="space-y-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>قيمة الدفعة</Label>
                        <Input
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <DateInput
                        label="تاريخ التسديد"
                        value={paymentDate}
                        onChange={(date) => setPaymentDate(date)}
                        placeholder="اختر التاريخ"
                      />
                      <div>
                        <Label>رقم أمر القبض</Label>
                        <Input
                          value={receiptNumber}
                          onChange={(e) => setReceiptNumber(e.target.value)}
                          placeholder="اختياري"
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddPayment} disabled={loading} className="w-full">
                      <Save className="w-4 h-4 ml-2" />
                      حفظ التسديد
                    </Button>
                  </div>
                )}

                {/* الإجمالي المسدد */}
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-green-800 dark:text-green-300">الإجمالي المسدد</span>
                    <span className="text-xl font-bold text-green-700 dark:text-green-400">
                      {student.total_paid.toLocaleString('ar-SY')} ل.س
                    </span>
                  </div>
                  {student.payments && student.payments.length > 0 && (
                    <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
                      {student.payments.slice(0, 3).map((payment, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                          <span>{new Date(payment.payment_date).toLocaleDateString('ar-SY')}</span>
                          <span>{payment.payment_amount.toLocaleString('ar-SY')} ل.س</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Section 3: تفاصيل الأقساط */}
            <Card>
              <CardContent className="pt-6 space-y-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                  <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  تفاصيل الأقساط
                </h3>

                {/* قسط الباص */}
                <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-300">قسط الباص</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>المبلغ الأساسي</Label>
                      <Input
                        type="number"
                        value={busFee}
                        onChange={(e) => setBusFee(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>نوع الحسم</Label>
                      <SegmentedControl
                        value={busDiscountType}
                        onValueChange={(value) => setBusDiscountType(value as 'fixed' | 'percentage')}
                        options={[
                          { label: 'ثابت', value: 'fixed' },
                          { label: 'نسبة %', value: 'percentage' }
                        ]}
                      />
                    </div>
                    <div>
                      <Label>قيمة الحسم</Label>
                      <Input
                        type="number"
                        value={busDiscountValue}
                        onChange={(e) => setBusDiscountValue(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>سبب الحسم (اختياري)</Label>
                      <Input
                        value={busDiscountReason}
                        onChange={(e) => setBusDiscountReason(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <span className="text-gray-700 dark:text-gray-300">القيمة بعد الحسم:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {(busFee - busDiscount).toLocaleString('ar-SY')} ل.س
                    </span>
                  </div>
                </div>

                {/* القسط المدرسي */}
                <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h4 className="font-medium text-purple-900 dark:text-purple-300">القسط المدرسي</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>المبلغ الأساسي</Label>
                      <Input
                        type="number"
                        value={schoolFee}
                        onChange={(e) => setSchoolFee(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>نوع الحسم</Label>
                      <SegmentedControl
                        value={schoolDiscountType}
                        onValueChange={(value) => setSchoolDiscountType(value as 'fixed' | 'percentage')}
                        options={[
                          { label: 'ثابت', value: 'fixed' },
                          { label: 'نسبة %', value: 'percentage' }
                        ]}
                      />
                    </div>
                    <div>
                      <Label>قيمة الحسم</Label>
                      <Input
                        type="number"
                        value={schoolDiscountValue}
                        onChange={(e) => setSchoolDiscountValue(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>سبب الحسم (اختياري)</Label>
                      <Input
                        value={schoolDiscountReason}
                        onChange={(e) => setSchoolDiscountReason(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <span className="text-gray-700 dark:text-gray-300">القيمة بعد الحسم:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {(schoolFee - schoolDiscount).toLocaleString('ar-SY')} ل.س
                    </span>
                  </div>
                </div>

                {/* إيرادات أخرى */}
                <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <h4 className="font-medium text-green-900 dark:text-green-300">إيرادات أخرى</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>نوع اللباس</Label>
                      <Input
                        value={uniformType}
                        onChange={(e) => setUniformType(e.target.value)}
                        placeholder="مثال: زي صيفي"
                      />
                    </div>
                    <div>
                      <Label>مبلغ اللباس</Label>
                      <Input
                        type="number"
                        value={uniformAmount}
                        onChange={(e) => setUniformAmount(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>نوع الدورة</Label>
                      <Input
                        value={courseType}
                        onChange={(e) => setCourseType(e.target.value)}
                        placeholder="مثال: دورة لغة إنجليزية"
                      />
                    </div>
                    <div>
                      <Label>مبلغ الدورة</Label>
                      <Input
                        type="number"
                        value={courseAmount}
                        onChange={(e) => setCourseAmount(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>

                {/* الإجمالي المطلوب */}
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <AlertDescription className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">الإجمالي المطلوب:</span>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {totalAmount.toLocaleString('ar-SY')} ل.س
                    </span>
                  </AlertDescription>
                </Alert>

                <Button onClick={handleUpdateFinances} disabled={loading} className="w-full">
                  <Save className="w-4 h-4 ml-2" />
                  حفظ التغييرات
                </Button>
              </CardContent>
            </Card>

            <Separator />

            {/* Section 4: الرصيد الجزئي */}
            <Card className={student.partial_balance > 0 ? 'border-red-300 dark:border-red-700' : 'border-green-300 dark:border-green-700'}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {student.partial_balance > 0 ? (
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    )}
                    الرصيد الجزئي
                  </span>
                  <span className={`text-2xl font-bold ${
                    student.partial_balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                  }`}>
                    {student.partial_balance.toLocaleString('ar-SY')} ل.س
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: ملاحظات الدفع */}
            <Card>
              <CardContent className="pt-6">
                <Label className="flex items-center gap-2 mb-2 text-gray-900 dark:text-gray-100">
                  <FileText className="w-4 h-4" />
                  ملاحظات الدفع
                </Label>
                <Textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  placeholder="أضف ملاحظات حول الدفع..."
                />
              </CardContent>
            </Card>

            {/* Section 6: الرصيد الكلي */}
            <Card className="border-2 border-blue-500 dark:border-blue-700">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    الرصيد الكلي
                  </span>
                  <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {student.total_balance.toLocaleString('ar-SY')} ل.س
                  </span>
                </div>
                {student.previous_years_balance > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                    <span>رصيد السنوات السابقة:</span>
                    <span>{student.previous_years_balance.toLocaleString('ar-SY')} ل.س</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => setShowHistoryModal(true)}
                >
                  عرض تاريخ الأرصدة
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Balance History Modal */}
        <BalanceHistoryModal
          open={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          studentId={studentId}
        />
      </DialogContent>
    </Dialog>
  );
};

export default StudentFinanceDetailModal;

