import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { FinanceCard } from './FinanceCard';
import { FinanceCardDetailModal } from './FinanceCardDetailModal';
import { AddFinanceCardModal } from './AddFinanceCardModal';
import { Plus, TrendingUp, TrendingDown, DollarSign, AlertCircle, Search } from 'lucide-react';
import { financeManagerApi } from '@/services/api';
import { FinanceManagerDashboard, FinanceCardSummary } from '@/types/school';
import { useToast } from '@/hooks/use-toast';

interface TreasurySectionProps {
  academicYearId: number;
  preselectedCardId?: number;
  openCardPopup?: boolean;
  openAddCardDialog?: boolean;
}

export const TreasurySection: React.FC<TreasurySectionProps> = ({ academicYearId, preselectedCardId, openCardPopup, openAddCardDialog }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<FinanceManagerDashboard | null>(null);
  const [selectedCardType, setSelectedCardType] = useState<'all' | 'activity' | 'student' | 'custom'>('all');
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<number | null>(null);

  useEffect(() => {
    if (academicYearId) {
      loadDashboard();
    }
  }, [academicYearId]);

  // Handle preselected card from search navigation
  useEffect(() => {
    if (preselectedCardId && openCardPopup && dashboard) {
      setSelectedCard(preselectedCardId);
      setShowDetailModal(true);
    }
  }, [preselectedCardId, openCardPopup, dashboard]);

  // Handle opening add card dialog from quick actions
  useEffect(() => {
    if (openAddCardDialog) {
      setShowAddModal(true);
      // Clear the state to prevent reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [openAddCardDialog]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await financeManagerApi.getDashboard(academicYearId);
      setDashboard(response.data);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل تحميل بيانات الصندوق',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (card: FinanceCardSummary) => {
    // Check if it's the default student card - navigate to students page instead of modal
    // Only default student cards should navigate, custom student cards should open modal
    if (card.category === 'student' && card.is_default) {
      navigate('/finance?tab=students');
      return;
    }

    setSelectedCard(card.card_id);
    setShowDetailModal(true);
  };

  const handleAddCard = () => {
    setShowAddModal(true);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedCard(null);
  };

  const handleUpdate = () => {
    loadDashboard();
  };

  const handleDeleteCard = (cardId: number) => {
    setCardToDelete(cardId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteCard = async () => {
    if (cardToDelete === null) return;

    try {
      await financeManagerApi.deleteFinanceCard(cardToDelete);
      toast({
        title: 'نجح',
        description: 'تم حذف الكارد بنجاح'
      });
      loadDashboard();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error?.response?.data?.detail || 'فشل حذف الكارد',
        variant: 'destructive'
      });
    } finally {
      setDeleteConfirmOpen(false);
      setCardToDelete(null);
    }
  };

  const filteredCards = dashboard?.finance_cards.filter(card => {
    // Filter by card type
    let matchesType = true;
    if (selectedCardType !== 'all') {
      if (card.card_name.includes('طلاب') || card.card_name.includes('Students')) {
        matchesType = selectedCardType === 'student';
      } else if (card.card_name.includes('نشاط') || card.card_name.includes('Activity')) {
        matchesType = selectedCardType === 'activity';
      } else {
        matchesType = selectedCardType === 'custom';
      }
    }

    // Filter by search query
    let matchesSearch = true;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      matchesSearch = card.card_name.toLowerCase().includes(query);
    }

    return matchesType && matchesSearch;
  }) || [];

  if (loading) {
    return <div className="flex justify-center items-center h-64">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            الصندوق
          </h1>
          <p className="text-muted-foreground mt-1">إدارة المعاملات المالية والكاردات</p>
        </div>
      </div>

      {/* Header Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* صافي الربح */}
        <Card className="ios-card border-t-4 border-t-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              صافي الربح
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              (dashboard?.net_profit || 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {(dashboard?.net_profit || 0).toLocaleString('ar-SY')} ل.س
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {(dashboard?.summary.total_income || 0).toLocaleString('ar-SY')} (دخل) - {(dashboard?.summary.total_expenses || 0).toLocaleString('ar-SY')} (مصروفات)
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">
              * لا يشمل الديون
            </div>
          </CardContent>
        </Card>

        {/* الديون المستحقة للمدرسة */}
        <Card className="ios-card border-t-4 border-t-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              الديون المستحقة للمدرسة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {(dashboard?.total_receivables || 0).toLocaleString('ar-SY')} ل.س
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              المبالغ التي لم تُحصّل بعد
            </div>
          </CardContent>
        </Card>

        {/* الديون المستحقة على المدرسة */}
        <Card className="ios-card border-t-4 border-t-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              الديون المستحقة على المدرسة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {(dashboard?.total_payables || 0).toLocaleString('ar-SY')} ل.س
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              المبالغ التي لم تُدفع بعد
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="ios-card">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن كارد مالي بالاسم..."
              className="pr-12"
            />
          </div>
        </CardContent>
      </Card>

      {/* Filter & Add Button */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant={selectedCardType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCardType('all')}
          >
            الكل
          </Button>
          <Button
            variant={selectedCardType === 'student' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCardType('student')}
          >
            الطلاب
          </Button>
          <Button
            variant={selectedCardType === 'activity' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCardType('activity')}
          >
            النشاطات
          </Button>
          <Button
            variant={selectedCardType === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCardType('custom')}
          >
            مخصص
          </Button>
        </div>

        <Button onClick={handleAddCard} size="sm">
          <Plus className="w-4 h-4 ml-2" />
          إضافة كارد
        </Button>
      </div>

      {/* Finance Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* معلومات المدير المالية Card - ككارد خرج عادي */}
        <Card className="ios-card hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  معلومات المدير المالية
                </CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    خرج
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                    مفتوح
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Expense Summary */}
            <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                المصروفات
              </span>
              <span className="font-semibold text-red-700 dark:text-red-400">
                {(dashboard?.rewards_and_assistance?.total || 0).toLocaleString('ar-SY')} ل.س
              </span>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
              المساعدات والمكافئات
            </div>
          </CardContent>
        </Card>

        {/* Regular Finance Cards */}
        {filteredCards.length === 0 ? (
          <div className="col-span-full">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                لا توجد كاردات مالية. قم بإضافة كارد جديد للبدء.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          filteredCards.map((card) => (
            <FinanceCard
              key={card.card_id}
              card={card}
              onClick={() => handleCardClick(card)}
              onDelete={handleDeleteCard}
            />
          ))
        )}
      </div>

      {/* Finance Card Detail Modal */}
      {selectedCard && (
        <FinanceCardDetailModal
          open={showDetailModal}
          onClose={handleCloseDetailModal}
          cardId={selectedCard}
          academicYearId={academicYearId}
          onUpdate={handleUpdate}
        />
      )}

      {/* Add Finance Card Modal */}
      <AddFinanceCardModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        academicYearId={academicYearId}
        onSuccess={handleUpdate}
      />

      {/* Delete Card Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="حذف الكارد"
        description="هل أنت متأكد من حذف هذا الكارد؟ سيتم حذف جميع المعاملات المرتبطة به."
        confirmText="حذف"
        cancelText="إلغاء"
        variant="destructive"
        onConfirm={confirmDeleteCard}
      />
    </div>
  );
};

export default TreasurySection;

