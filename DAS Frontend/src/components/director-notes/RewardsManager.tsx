import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Plus, Edit, Trash2, ArrowLeft, Calendar, User, DollarSign, Search, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { directorApi, studentsApi, teachersApi } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { Reward } from '@/types/school';

const RewardsManager: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [suggestions, setSuggestions] = useState<{ id: number; name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: number; name: string } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [rewardToDelete, setRewardToDelete] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState<{
    title: string;
    reward_date: string;
    recipient_name: string;
    recipient_type: 'student' | 'teacher' | 'other';
    amount: string;
    description: string;
  }>({
    title: '',
    reward_date: new Date().toISOString().split('T')[0],
    recipient_name: '',
    recipient_type: 'student',
    amount: '',
    description: ''
  });

  const academicYearId = parseInt(localStorage.getItem('selected_academic_year_id') || '0');

  useEffect(() => {
    if (academicYearId) {
      fetchRewards();
    }
  }, [academicYearId]);

  const fetchRewards = async () => {
    try {
      setLoading(true);
      const response = await directorApi.getRewards(academicYearId);
      if (response.success && response.data) {
        setRewards(response.data);
      }
    } catch (error) {

      toast({
        title: 'خطأ',
        description: 'فشل في تحميل المكافئات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Search for students or teachers
  useEffect(() => {
    if (searchQuery.length >= 1 && (formData.recipient_type === 'student' || formData.recipient_type === 'teacher')) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(async () => {
        try {
          if (formData.recipient_type === 'student') {
            const response = await studentsApi.search(searchQuery, academicYearId, undefined, 10);
            if (response.success && response.data) {
              const studentList = response.data.map((s: any) => ({
                id: s.id,
                name: s.full_name || `${s.father_name || ''} ${s.mother_name || ''}`.trim()
              }));
              setSuggestions(studentList);
              setShowSuggestions(true);
            } else {
              setSuggestions([]);
              setShowSuggestions(false);
            }
          } else if (formData.recipient_type === 'teacher') {
            const response = await teachersApi.search(searchQuery, 0, 10);
            if (response.success && response.data) {
              const teacherList = response.data.map((t: any) => ({
                id: t.id,
                name: t.full_name || t.name || ''
              }));
              setSuggestions(teacherList);
              setShowSuggestions(true);
            } else {
              setSuggestions([]);
              setShowSuggestions(false);
            }
          }
        } catch (error) {

          setSuggestions([]);
          setShowSuggestions(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, formData.recipient_type, academicYearId]);

  // Reset search when recipient type changes
  useEffect(() => {
    setSearchQuery('');
    setSelectedRecipient(null);
    setFormData(prev => ({ ...prev, recipient_name: '' }));
    setSuggestions([]);
    setShowSuggestions(false);
  }, [formData.recipient_type]);

  const handleSelectSuggestion = (suggestion: { id: number; name: string }) => {
    setSelectedRecipient(suggestion);
    setFormData(prev => ({ ...prev, recipient_name: suggestion.name }));
    setSearchQuery(suggestion.name);
    setShowSuggestions(false);
  };

  const handleRecipientNameChange = (value: string) => {
    setSearchQuery(value);
    setFormData(prev => ({ ...prev, recipient_name: value }));

    // If name doesn't match selected recipient, clear selection
    if (selectedRecipient && selectedRecipient.name !== value) {
      setSelectedRecipient(null);
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
    if (!formData.title.trim() || !formData.recipient_name.trim()) {
      toast({
        title: 'خطأ في الإدخال',
        description: 'يرجى ملء جميع الحقول المطلوبة',
        variant: 'destructive',
      });
      return;
    }

    // Validate that name exists in database if type is student or teacher
    if ((formData.recipient_type === 'student' || formData.recipient_type === 'teacher') && !selectedRecipient) {
      // Check if the entered name exists in suggestions
      const nameExists = suggestions.some(s => s.name.toLowerCase() === formData.recipient_name.trim().toLowerCase());

      if (!nameExists) {
        toast({
          title: 'خطأ في الإدخال',
          description: 'الاسم المدخل غير موجود في قاعدة البيانات. يرجى اختيار "آخر" كنوع المستفيد إذا كان الاسم غير موجود.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const rewardData = {
        ...formData,
        amount: amountValue,
        academic_year_id: academicYearId,
      };

      if (editingReward) {
        await directorApi.updateReward(editingReward.id, rewardData);
        toast({ title: 'نجاح', description: 'تم تحديث المكافأة' });
      } else {
        await directorApi.createReward(rewardData as any);
        toast({ title: 'نجاح', description: 'تم إضافة المكافأة' });
      }

      setShowDialog(false);
      resetForm();
      fetchRewards();
    } catch (error) {

      toast({
        title: 'خطأ',
        description: 'فشل في حفظ المكافأة',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (reward: Reward) => {
    setEditingReward(reward);
    setFormData({
      title: reward.title,
      reward_date: reward.reward_date,
      recipient_name: reward.recipient_name,
      recipient_type: reward.recipient_type as 'student' | 'teacher' | 'other',
      amount: reward.amount.toString(),
      description: reward.description || ''
    });
    setSearchQuery(reward.recipient_name);
    // Don't set selectedRecipient for editing, allow free text for existing records
    setSelectedRecipient(null);
    setShowDialog(true);
  };

  const handleDelete = (id: number) => {
    setRewardToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteReward = async () => {
    if (rewardToDelete === null) return;

    try {
      await directorApi.deleteReward(rewardToDelete);
      toast({ title: 'نجاح', description: 'تم حذف المكافأة' });
      fetchRewards();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في حذف المكافأة',
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setRewardToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      reward_date: new Date().toISOString().split('T')[0],
      recipient_name: '',
      recipient_type: 'student',
      amount: '',
      description: ''
    });
    setEditingReward(null);
    setSearchQuery('');
    setSelectedRecipient(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const totalAmount = rewards.reduce((sum, reward) => sum + reward.amount, 0);

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
              <Award className="h-8 w-8 text-accent" />
              المكافئات
            </h1>
            <p className="text-muted-foreground">إدارة مكافئات الطلاب والمعلمين</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة مكافأة
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>ملخص المكافئات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">إجمالي المكافئات</p>
              <p className="text-2xl font-bold">{rewards.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي المبلغ</p>
              <p className="text-2xl font-bold">{totalAmount.toLocaleString()} ليرة</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rewards List */}
      <div className="space-y-4">
        {rewards.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>لا توجد مكافئات مسجلة</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowDialog(true)}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة أول مكافأة
              </Button>
            </CardContent>
          </Card>
        ) : (
          rewards.map((reward) => (
            <Card key={reward.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{reward.title}</CardTitle>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {reward.recipient_name} ({reward.recipient_type === 'student' ? 'طالب' : reward.recipient_type === 'teacher' ? 'معلم' : 'آخر'})
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(reward.reward_date).toLocaleDateString('ar-SA')}
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        {reward.amount.toLocaleString()} ليرة
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(reward)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(reward.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {reward.description && (
                <CardContent>
                  <p className="text-sm">{reward.description}</p>
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
            <DialogTitle>{editingReward ? 'تحرير المكافأة' : 'إضافة مكافأة جديدة'}</DialogTitle>
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
                <Label htmlFor="recipient_name">اسم المستفيد</Label>
                <div className="relative">
                  <Input
                    id="recipient_name"
                    ref={inputRef}
                    value={searchQuery || formData.recipient_name}
                    onChange={(e) => handleRecipientNameChange(e.target.value)}
                    onFocus={() => {
                      if (suggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    placeholder={
                      formData.recipient_type === 'student'
                        ? 'ابحث عن طالب...'
                        : formData.recipient_type === 'teacher'
                        ? 'ابحث عن معلم...'
                        : 'أدخل اسم المستفيد'
                    }
                    disabled={formData.recipient_type === 'other'}
                  />
                  {formData.recipient_type !== 'other' && (
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  )}
                  {showSuggestions && suggestions.length > 0 && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowSuggestions(false)}
                      />
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg max-h-60 overflow-y-auto">
                        {suggestions.map((suggestion) => (
                          <div
                            key={suggestion.id}
                            onClick={() => handleSelectSuggestion(suggestion)}
                            className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                          >
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span>{suggestion.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {formData.recipient_type !== 'other' && selectedRecipient && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRecipient(null);
                        setSearchQuery('');
                        setFormData(prev => ({ ...prev, recipient_name: '' }));
                      }}
                      className="absolute left-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {formData.recipient_type !== 'other' && !selectedRecipient && formData.recipient_name.trim() && (
                  <p className="text-xs text-gray-500">
                    {suggestions.length === 0 && searchQuery.length >= 1
                      ? 'لم يتم العثور على نتائج. يرجى اختيار "آخر" إذا كان الاسم غير موجود.'
                      : 'ابدأ بالكتابة للبحث'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipient_type">نوع المستفيد</Label>
                <Select value={formData.recipient_type} onValueChange={(v) => setFormData({ ...formData, recipient_type: v as 'student' | 'teacher' | 'other' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">طالب</SelectItem>
                    <SelectItem value="teacher">معلم</SelectItem>
                    <SelectItem value="other">آخر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <DateInput
                  label="التاريخ"
                  value={formData.reward_date}
                  onChange={(date) => setFormData({ ...formData, reward_date: date })}
                  placeholder="اختر التاريخ"
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
              {editingReward ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Reward Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="حذف المكافأة"
        description="هل أنت متأكد من حذف هذه المكافأة؟"
        confirmText="حذف"
        cancelText="إلغاء"
        variant="destructive"
        onConfirm={confirmDeleteReward}
      />
    </div>
  );
};

export default RewardsManager;

