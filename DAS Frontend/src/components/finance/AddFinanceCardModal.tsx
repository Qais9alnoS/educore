import React, { useState } from 'react';
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
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Save } from 'lucide-react';
import { financeManagerApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface AddFinanceCardModalProps {
  open: boolean;
  onClose: () => void;
  academicYearId: number;
  onSuccess?: () => void;
}

export const AddFinanceCardModal: React.FC<AddFinanceCardModalProps> = ({
  open,
  onClose,
  academicYearId,
  onSuccess
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [cardName, setCardName] = useState('');
  const [cardType, setCardType] = useState<'income' | 'expense' | 'both'>('both');
  const [category, setCategory] = useState<'activity' | 'student' | 'custom'>('custom');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!cardName.trim()) {
      toast({
        title: 'تنبيه',
        description: 'يرجى إدخال اسم الكارد',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      await financeManagerApi.createFinanceCard({
        academic_year_id: academicYearId,
        card_name: cardName,
        card_type: cardType,
        category: category,
        created_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        description: description || undefined,
        is_default: false,
        status: 'open'
      });

      toast({
        title: 'نجح',
        description: 'تم إنشاء الكارد المالي بنجاح'
      });

      // Reset form
      setCardName('');
      setDescription('');
      setCardType('both');
      setCategory('custom');

      onSuccess?.();
      onClose();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل إنشاء الكارد المالي',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>إضافة كارد مالي جديد</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>اسم الكارد *</Label>
            <Input
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="مثال: صيانة المباني"
            />
          </div>

          <div>
            <Label>نوع الكارد *</Label>
            <SegmentedControl
              value={cardType}
              onValueChange={(value) => setCardType(value as 'income' | 'expense' | 'both')}
              options={[
                { label: 'دخل', value: 'income' },
                { label: 'خرج', value: 'expense' },
                { label: 'دخل وخرج', value: 'both' }
              ]}
            />
            <div className="text-xs text-gray-500 mt-1">
              • دخل: للإيرادات فقط<br />
              • خرج: للمصروفات فقط<br />
              • دخل وخرج: للعمليات التي تحتوي على الاثنين
            </div>
          </div>

          <div>
            <Label>التفاصيل</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="أضف تفاصيل إضافية عن هذا الكارد..."
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1"
            >
              <Save className="w-4 h-4 ml-2" />
              حفظ
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={loading}
            >
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFinanceCardModal;

