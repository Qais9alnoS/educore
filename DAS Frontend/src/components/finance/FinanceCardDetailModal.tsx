import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
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
import {
  Save,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  Edit2,
  X
} from 'lucide-react';
import { FinanceCardDetailed, FinanceTransaction } from '@/types/school';
import { financeManagerApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface FinanceCardDetailModalProps {
  open: boolean;
  onClose: () => void;
  cardId: number;
  academicYearId: number;
  onUpdate?: () => void;
}

export const FinanceCardDetailModal: React.FC<FinanceCardDetailModalProps> = ({
  open,
  onClose,
  cardId,
  academicYearId,
  onUpdate
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<FinanceCardDetailed | null>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<number | null>(null);

  // Transaction form state
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('income');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionDescription, setTransactionDescription] = useState('');
  const [transactionStatus, setTransactionStatus] = useState<'completed' | 'pending'>('completed');
  const [responsiblePerson, setResponsiblePerson] = useState('');

  // Edit transaction state
  const [editingTransaction, setEditingTransaction] = useState<number | null>(null);
  const [editTransactionData, setEditTransactionData] = useState<any>(null);

  useEffect(() => {
    if (open && cardId && academicYearId) {
      loadCardDetails();
    }
  }, [open, cardId, academicYearId]);

  // Set transaction type based on card type when card loads
  useEffect(() => {
    if (card) {
      if (card.card.card_type === 'income') {
        setTransactionType('income');
      } else if (card.card.card_type === 'expense') {
        setTransactionType('expense');
      }
    }
  }, [card]);

  const loadCardDetails = async () => {
    try {
      setLoading(true);

      const response = await financeManagerApi.getFinanceCardDetailed(cardId, academicYearId);

      setCard(response.data);
    } catch (error) {

      toast({
        title: 'خطأ',
        description: 'فشل تحميل تفاصيل الكارد المالي',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async () => {
    // Validate amount is not empty
    if (!transactionAmount || transactionAmount.trim() === '') {
      toast({
        title: 'تنبيه',
        description: 'يرجى إدخال المبلغ',
        variant: 'destructive'
      });
      return;
    }

    // Validate amount is a valid number
    const amount = parseFloat(transactionAmount);
    if (isNaN(amount)) {
      toast({
        title: 'خطأ في المبلغ',
        description: 'يرجى إدخال رقم صحيح في حقل المبلغ',
        variant: 'destructive'
      });
      return;
    }

    // Validate amount is positive
    if (amount <= 0) {
      toast({
        title: 'خطأ في المبلغ',
        description: 'يجب أن يكون المبلغ أكبر من صفر',
        variant: 'destructive'
      });
      return;
    }

    // Validate transaction date is not empty
    if (!transactionDate || transactionDate.trim() === '') {
      toast({
        title: 'خطأ في التاريخ',
        description: 'يرجى اختيار تاريخ المعاملة',
        variant: 'destructive',
        duration: 5000
      });
      return;
    }

    try {
      setLoading(true);
      await financeManagerApi.addCardTransaction(cardId, {
        transaction_type: transactionType,
        amount: parseFloat(transactionAmount),
        transaction_date: transactionDate,
        notes: transactionDescription,
        is_completed: transactionStatus === 'completed',
        completion_percentage: 100,
        responsible_person: responsiblePerson || undefined
      });

      toast({
        title: 'نجح',
        description: 'تم إضافة المعاملة بنجاح'
      });

      setTransactionAmount('');
      setTransactionDescription('');
      setResponsiblePerson('');
      setShowTransactionForm(false);
      loadCardDetails();
      onUpdate?.();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل إضافة المعاملة',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTransactionStatus = async (transactionId: number, newStatus: boolean) => {
    try {
      setLoading(true);
      await financeManagerApi.updateCardTransaction(transactionId, {
        is_completed: newStatus
      });

      toast({
        title: 'نجح',
        description: 'تم تحديث حالة المعاملة'
      });

      loadCardDetails();
      onUpdate?.();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل تحديث حالة المعاملة',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if transaction is system-generated aggregated activity transaction
  const isAggregatedActivityTransaction = (transaction: any) => {
    return transaction.notes && transaction.notes.startsWith('activity_aggregated');
  };

  const handleEditTransaction = (transaction: any) => {
    // Prevent editing system-generated aggregated transactions
    if (isAggregatedActivityTransaction(transaction)) {
      toast({
        title: 'تنبيه',
        description: 'لا يمكن تعديل المعاملات المجمعة للأنشطة. يتم تحديثها تلقائياً عند تغيير حالة الدفع للمشاركين.',
        variant: 'destructive',
        duration: 5000
      });
      return;
    }

    setEditingTransaction(transaction.id);
    setEditTransactionData({
      transaction_type: transaction.transaction_type,
      amount: transaction.amount.toString(),
      transaction_date: transaction.transaction_date,
      description: transaction.notes || '',
      responsible_person: transaction.responsible_person || '',
      is_completed: transaction.is_completed
    });
  };

  const handleCancelEdit = () => {
    setEditingTransaction(null);
    setEditTransactionData(null);
  };

  const handleSaveEdit = async () => {
    if (!editingTransaction || !editTransactionData) return;

    // Validate amount is not empty
    if (!editTransactionData.amount || editTransactionData.amount.trim() === '') {
      toast({
        title: 'تنبيه',
        description: 'يرجى إدخال المبلغ',
        variant: 'destructive'
      });
      return;
    }

    // Validate amount is a valid number
    const amount = parseFloat(editTransactionData.amount);
    if (isNaN(amount)) {
      toast({
        title: 'خطأ في المبلغ',
        description: 'يرجى إدخال رقم صحيح في حقل المبلغ',
        variant: 'destructive'
      });
      return;
    }

    // Validate amount is positive
    if (amount <= 0) {
      toast({
        title: 'خطأ في المبلغ',
        description: 'يجب أن يكون المبلغ أكبر من صفر',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      await financeManagerApi.updateCardTransaction(editingTransaction, {
        transaction_type: editTransactionData.transaction_type,
        amount: parseFloat(editTransactionData.amount),
        transaction_date: editTransactionData.transaction_date,
        notes: editTransactionData.description,
        responsible_person: editTransactionData.responsible_person,
        is_completed: editTransactionData.is_completed
      });

      toast({
        title: 'نجح',
        description: 'تم تحديث المعاملة بنجاح'
      });

      setEditingTransaction(null);
      setEditTransactionData(null);
      loadCardDetails();
      onUpdate?.();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل تحديث المعاملة',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = (transactionId: number, transaction: any) => {
    // Prevent deleting system-generated aggregated transactions
    if (isAggregatedActivityTransaction(transaction)) {
      toast({
        title: 'تنبيه',
        description: 'لا يمكن حذف المعاملات المجمعة للأنشطة. يتم تحديثها تلقائياً عند تغيير حالة الدفع للمشاركين.',
        variant: 'destructive',
        duration: 5000
      });
      return;
    }

    setTransactionToDelete(transactionId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteTransaction = async () => {
    if (transactionToDelete === null) return;

    try {
      setLoading(true);
      await financeManagerApi.deleteCardTransaction(transactionToDelete);

      toast({
        title: 'نجح',
        description: 'تم حذف المعاملة بنجاح'
      });

      loadCardDetails();
      onUpdate?.();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل حذف المعاملة',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setDeleteConfirmOpen(false);
      setTransactionToDelete(null);
    }
  };

  if (!card && !loading) return null;

  const completedIncome = card?.transactions
    ?.filter(t => t.transaction_type === 'income' && t.is_completed)
    ?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const completedExpense = card?.transactions
    ?.filter(t => t.transaction_type === 'expense' && t.is_completed)
    ?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const pendingIncome = card?.transactions
    ?.filter(t => t.transaction_type === 'income' && !t.is_completed)
    ?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const pendingExpense = card?.transactions
    ?.filter(t => t.transaction_type === 'expense' && !t.is_completed)
    ?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const netAmount = completedIncome - completedExpense;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl font-bold text-ellipsis overflow-hidden whitespace-nowrap max-w-[calc(100%-100px)]">
              {card?.card.card_name}
            </DialogTitle>
            <Badge variant="outline" className="text-xs whitespace-nowrap">
              {card?.card.card_type === 'income' ? 'دخل' : card?.card.card_type === 'expense' ? 'خرج' : 'دخل وخرج'}
            </Badge>
          </div>
        </DialogHeader>

        {loading && <div className="text-center py-8">جاري التحميل...</div>}

        {card && !loading && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="ios-card border-t-4 border-t-green-500">
                <CardContent className="pt-4">
                  <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1 mb-1">
                    <TrendingUp className="w-3 h-3" />
                    الدخل المكتمل
                  </div>
                  <div className="text-xl font-bold text-green-600">
                    {completedIncome.toLocaleString('ar-SY')}
                  </div>
                </CardContent>
              </Card>

              <Card className="ios-card border-t-4 border-t-red-500">
                <CardContent className="pt-4">
                  <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1 mb-1">
                    <TrendingDown className="w-3 h-3" />
                    الخرج المكتمل
                  </div>
                  <div className="text-xl font-bold text-red-600">
                    {completedExpense.toLocaleString('ar-SY')}
                  </div>
                </CardContent>
              </Card>

              <Card className="ios-card border-t-4 border-t-blue-500">
                <CardContent className="pt-4">
                  <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">الصافي</div>
                  <div className={`text-xl font-bold ${
                    netAmount >= 0 ? 'text-blue-600' : 'text-orange-600'
                  }`}>
                    {netAmount >= 0 && '+'}
                    {netAmount.toLocaleString('ar-SY')}
                  </div>
                </CardContent>
              </Card>

              <Card className="ios-card border-t-4 border-t-orange-500">
                <CardContent className="pt-4">
                  <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">غير مكتمل</div>
                  <div className="text-xl font-bold text-orange-600">
                    {(pendingIncome + pendingExpense).toLocaleString('ar-SY')}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Add Transaction Form */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Edit2 className="w-5 h-5 text-blue-600" />
                    إضافة معاملة مالية
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTransactionForm(!showTransactionForm)}
                  >
                    {showTransactionForm ? 'إلغاء' : <Plus className="w-4 h-4" />}
                  </Button>
                </div>

                {showTransactionForm && (
                  <div className="space-y-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    {/* Only show transaction type selector for 'both' card types */}
                    {card?.card.card_type === 'both' ? (
                      <div>
                        <Label>نوع المعاملة</Label>
                        <SegmentedControl
                          value={transactionType}
                          onValueChange={(value) => setTransactionType(value as 'income' | 'expense')}
                          options={[
                            { label: 'دخل', value: 'income' },
                            { label: 'خرج', value: 'expense' }
                          ]}
                        />
                      </div>
                    ) : (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                          <strong>نوع المعاملة:</strong> {transactionType === 'income' ? 'دخل فقط' : 'خرج فقط'}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>المبلغ</Label>
                        <Input
                          type="number"
                          value={transactionAmount}
                          onChange={(e) => setTransactionAmount(e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <DateInput
                        label="التاريخ"
                        value={transactionDate}
                        onChange={(date) => setTransactionDate(date)}
                        placeholder="اختر التاريخ"
                      />
                    </div>

                    <div>
                      <Label>الوصف</Label>
                      <Textarea
                        value={transactionDescription}
                        onChange={(e) => setTransactionDescription(e.target.value)}
                        rows={2}
                        placeholder="تفاصيل المعاملة..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>المسؤول</Label>
                        <Input
                          value={responsiblePerson}
                          onChange={(e) => setResponsiblePerson(e.target.value)}
                          placeholder="اسم المسؤول (اختياري)"
                        />
                      </div>
                      <div>
                        <Label>الحالة</Label>
                        <SegmentedControl
                          value={transactionStatus}
                          onValueChange={(value) => setTransactionStatus(value as 'completed' | 'pending')}
                          options={[
                            { label: 'مكتمل', value: 'completed' },
                            { label: 'معلق', value: 'pending' }
                          ]}
                        />
                      </div>
                    </div>

                    <Button onClick={handleAddTransaction} disabled={loading} className="w-full">
                      <Save className="w-4 h-4 ml-2" />
                      حفظ المعاملة
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Transactions List */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">سجل المعاملات</h3>

                {(!card.transactions || card.transactions.length === 0) ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      لا توجد معاملات بعد. قم بإضافة معاملة جديدة.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {card.transactions
                      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
                      .map((transaction) => (
                        <Card
                          key={transaction.id}
                          className={`border-r-4 ${
                            transaction.transaction_type === 'income'
                              ? 'border-r-green-500'
                              : 'border-r-red-500'
                          }`}
                        >
                          <CardContent className="p-4">
                            {editingTransaction === transaction.id ? (
                              // Edit mode
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {card?.card.card_type === 'both' && (
                                    <div>
                                      <Label className="text-xs">نوع المعاملة</Label>
                                      <SegmentedControl
                                        value={editTransactionData.transaction_type}
                                        onValueChange={(value) => setEditTransactionData({
                                          ...editTransactionData,
                                          transaction_type: value
                                        })}
                                        options={[
                                          { label: 'دخل', value: 'income' },
                                          { label: 'خرج', value: 'expense' }
                                        ]}
                                      />
                                    </div>
                                  )}
                                  <div>
                                    <Label className="text-xs">المبلغ</Label>
                                    <Input
                                      type="number"
                                      value={editTransactionData.amount}
                                      onChange={(e) => setEditTransactionData({
                                        ...editTransactionData,
                                        amount: e.target.value
                                      })}
                                      min="0"
                                      step="0.01"
                                      placeholder="0.00"
                                    />
                                  </div>
                                  <div>
                                    <DateInput
                                      label="التاريخ"
                                      value={editTransactionData.transaction_date}
                                      onChange={(date) => setEditTransactionData({
                                        ...editTransactionData,
                                        transaction_date: date
                                      })}
                                      placeholder="اختر التاريخ"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs">الوصف</Label>
                                  <Textarea
                                    value={editTransactionData.description}
                                    onChange={(e) => setEditTransactionData({
                                      ...editTransactionData,
                                      description: e.target.value
                                    })}
                                    rows={2}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">المسؤول</Label>
                                  <Input
                                    value={editTransactionData.responsible_person}
                                    onChange={(e) => setEditTransactionData({
                                      ...editTransactionData,
                                      responsible_person: e.target.value
                                    })}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">الحالة</Label>
                                  <SegmentedControl
                                    value={editTransactionData.is_completed ? 'completed' : 'pending'}
                                    onValueChange={(value) => setEditTransactionData({
                                      ...editTransactionData,
                                      is_completed: value === 'completed'
                                    })}
                                    options={[
                                      { label: 'مكتمل', value: 'completed' },
                                      { label: 'معلق', value: 'pending' }
                                    ]}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button onClick={handleSaveEdit} size="sm" className="flex-1">
                                    <Save className="w-4 h-4 ml-1" />
                                    حفظ
                                  </Button>
                                  <Button onClick={handleCancelEdit} size="sm" variant="outline" className="flex-1">
                                    <X className="w-4 h-4 ml-1" />
                                    إلغاء
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              // View mode
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    {transaction.transaction_type === 'income' ? (
                                      <TrendingUp className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <TrendingDown className="w-4 h-4 text-red-600" />
                                    )}
                                    <span className="font-medium">
                                      {transaction.transaction_type === 'income' ? 'دخل' : 'خرج'}
                                    </span>
                                    <Badge
                                      variant={transaction.is_completed ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {transaction.is_completed ? (
                                        <CheckCircle className="w-3 h-3 ml-1 inline" />
                                      ) : (
                                        <AlertCircle className="w-3 h-3 ml-1 inline" />
                                      )}
                                      {transaction.is_completed ? 'مكتمل' : 'معلق'}
                                    </Badge>
                                  </div>

                                  <div className="text-sm text-gray-600 space-y-1">
                                    {transaction.notes && (
                                      <div>{transaction.notes}</div>
                                    )}
                                    {transaction.responsible_person && (
                                      <div className="text-xs">المسؤول: {transaction.responsible_person}</div>
                                    )}
                                    <div className="text-xs text-gray-500">
                                      {new Date(transaction.transaction_date).toLocaleDateString('ar-SY')}
                                    </div>
                                  </div>
                                </div>

                                <div className="text-left ml-4">
                                  <div className={`text-lg font-bold ${
                                    transaction.transaction_type === 'income'
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  }`}>
                                    {transaction.amount.toLocaleString('ar-SY')} ل.س
                                  </div>
                                  {/* Hide edit/delete buttons for aggregated activity transactions */}
                                  {!isAggregatedActivityTransaction(transaction) && (
                                    <div className="flex gap-2 mt-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs"
                                        onClick={() => handleEditTransaction(transaction)}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs text-red-600"
                                        onClick={() => handleDeleteTransaction(transaction.id, transaction)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  )}
                                  {/* Show lock icon for protected transactions */}
                                  {isAggregatedActivityTransaction(transaction) && (
                                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                      <Badge variant="secondary" className="text-xs">
                                        محمي
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Delete Transaction Confirmation Dialog */}
    <ConfirmationDialog
      open={deleteConfirmOpen}
      onOpenChange={setDeleteConfirmOpen}
      title="حذف المعاملة"
      description="هل أنت متأكد من حذف هذه المعاملة؟"
      confirmText="حذف"
      cancelText="إلغاء"
      variant="destructive"
      onConfirm={confirmDeleteTransaction}
    />
  );
};

export default FinanceCardDetailModal;

