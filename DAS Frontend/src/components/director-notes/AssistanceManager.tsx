import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Plus, Edit, Trash2, ArrowLeft, Calendar, Building, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { directorApi } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { AssistanceRecord } from '@/types/school';

const AssistanceManager: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [records, setRecords] = useState<AssistanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AssistanceRecord | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    assistance_date: new Date().toISOString().split('T')[0],
    organization: '',
    amount: '',
    description: ''
  });

  const academicYearId = parseInt(localStorage.getItem('selected_academic_year_id') || '0');

  useEffect(() => {
    if (academicYearId) {
      fetchRecords();
    }
  }, [academicYearId]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await directorApi.getAssistanceRecords(academicYearId);
      if (response.success && response.data) {
        setRecords(response.data);
      }
    } catch (error) {

      toast({
        title: 'خطأ',
        description: 'فشل في تحميل المساعدات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validate amount is a valid number
    const amountValue = parseFloat(formData.amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast({
        title: 'خطأ في الإدخال',
        description: 'يرجى إدخال مبلغ صحيح (رقم موجب)',
        variant: 'destructive',
      });
      return;
    }

    // Validate required fields
    if (!formData.title.trim() || !formData.organization.trim()) {
      toast({
        title: 'خطأ في الإدخال',
        description: 'يرجى ملء جميع الحقول المطلوبة',
        variant: 'destructive',
      });
      return;
    }

    try {
      const recordData = {
        ...formData,
        amount: amountValue,
        academic_year_id: academicYearId,
      };

      if (editingRecord) {
        await directorApi.updateAssistanceRecord(editingRecord.id, recordData);
        toast({ title: 'نجاح', description: 'تم تحديث المساعدة' });
      } else {
        await directorApi.createAssistanceRecord(recordData as any);
        toast({ title: 'نجاح', description: 'تم إضافة المساعدة' });
      }

      setShowDialog(false);
      resetForm();
      fetchRecords();
    } catch (error) {

      toast({
        title: 'خطأ',
        description: 'فشل في حفظ المساعدة',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (record: AssistanceRecord) => {
    setEditingRecord(record);
    setFormData({
      title: record.title,
      assistance_date: record.assistance_date,
      organization: record.organization,
      amount: record.amount.toString(),
      description: record.description || ''
    });
    setShowDialog(true);
  };

  const handleDelete = (id: number) => {
    setRecordToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteRecord = async () => {
    if (recordToDelete === null) return;

    try {
      await directorApi.deleteAssistanceRecord(recordToDelete);
      toast({ title: 'نجاح', description: 'تم حذف المساعدة' });
      fetchRecords();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حذف المساعدة',
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setRecordToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      assistance_date: new Date().toISOString().split('T')[0],
      organization: '',
      amount: '',
      description: ''
    });
    setEditingRecord(null);
  };

  const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/director/notes')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Heart className="h-8 w-8 text-destructive" />
              المساعدات
            </h1>
            <p className="text-muted-foreground">إدارة المساعدات والدعم المقدم</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة مساعدة
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>ملخص المساعدات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">إجمالي المساعدات</p>
              <p className="text-2xl font-bold">{records.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي المبلغ</p>
              <p className="text-2xl font-bold">{totalAmount.toLocaleString()} ليرة</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assistance Records List */}
      <div className="space-y-4">
        {records.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>لا توجد مساعدات مسجلة</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowDialog(true)}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة أول مساعدة
              </Button>
            </CardContent>
          </Card>
        ) : (
          records.map((record) => (
            <Card key={record.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{record.title}</CardTitle>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        {record.organization}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(record.assistance_date).toLocaleDateString('ar-SA')}
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        {record.amount.toLocaleString()} ليرة
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(record)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(record.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {record.description && (
                <CardContent>
                  <p className="text-sm">{record.description}</p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRecord ? 'تحرير المساعدة' : 'إضافة مساعدة جديدة'}</DialogTitle>
            <DialogDescription>
              املأ المعلومات التالية
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">العنوان</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="organization">الجهة</Label>
                <Input
                  id="organization"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">المبلغ</Label>
                <Input
                  id="amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <DateInput
                label="التاريخ"
                value={formData.assistance_date}
                onChange={(date) => setFormData({ ...formData, assistance_date: date })}
                placeholder="اختر التاريخ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">الوصف</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit}>
              {editingRecord ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="حذف المساعدة"
        description="هل أنت متأكد من حذف هذه المساعدة؟"
        confirmText="حذف"
        cancelText="إلغاء"
        variant="destructive"
        onConfirm={confirmDeleteRecord}
      />
    </div>
  );
};

export default AssistanceManager;

