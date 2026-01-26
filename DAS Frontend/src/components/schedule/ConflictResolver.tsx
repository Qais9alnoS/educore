import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  BookOpen,
  Lightbulb,
  Save,
  Send
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { clearScheduleCache } from '@/lib/scheduleCache';

interface ConflictResolverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: number;
  onSaveAsDraft: () => void;
  onPublish: () => void;
  onResolve: (conflictId: string, resolution: any) => void;
}

interface Conflict {
  id: string;
  type: 'teacher_double_booking' | 'constraint_violation' | 'room_conflict';
  severity: 'critical' | 'warning' | 'info';
  priority_level: number;
  description: string;
  affected_entities: {
    subject_name?: string;
    teacher_name?: string;
    class_name?: string;
    day?: number;
    period?: number;
    room?: string;
  };
  suggested_resolution: string;
  can_override: boolean;
  details?: string;
}

interface ConflictAnalysis {
  total_conflicts: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  can_publish: boolean;
  can_save_as_draft: boolean;
  conflicts: Conflict[];
  summary: string;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: XCircle,
    label: 'حرج',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeClass: 'bg-red-100 text-red-800'
  },
  warning: {
    icon: AlertTriangle,
    label: 'تحذير',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    badgeClass: 'bg-yellow-100 text-yellow-800'
  },
  info: {
    icon: Info,
    label: 'معلومة',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800'
  }
};

const DAY_NAMES: { [key: number]: string } = {
  1: 'الأحد',
  2: 'الاثنين',
  3: 'الثلاثاء',
  4: 'الأربعاء',
  5: 'الخميس'
};

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  open,
  onOpenChange,
  scheduleId,
  onSaveAsDraft,
  onPublish,
  onResolve
}) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<ConflictAnalysis | null>(null);
  const [selectedTab, setSelectedTab] = useState('all');
  const [resolvedConflicts, setResolvedConflicts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && scheduleId) {
      loadConflicts();
    }
  }, [open, scheduleId]);

  const loadConflicts = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/schedules/${scheduleId}/conflicts`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('das_token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('فشل تحميل التعارضات');
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحميل التعارضات',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsDraft = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/schedules/${scheduleId}/save-as-draft`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('das_token')}`
          }
        }
      );

      if (response.ok) {
        toast({
          title: 'تم الحفظ كمسودة',
          description: 'تم حفظ الجدول كمسودة. يمكنك حل التعارضات لاحقاً.'
        });
        onSaveAsDraft();
        onOpenChange(false);
      } else {
        throw new Error('فشل حفظ المسودة');
      }
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handlePublish = async () => {
    if (!analysis?.can_publish) {
      toast({
        title: 'لا يمكن النشر',
        description: 'يجب حل التعارضات الحرجة أولاً',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8000/api/schedules/${scheduleId}/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('das_token')}`
          }
        }
      );

      if (response.ok) {
        // Clear schedule cache so the page resets when re-entering
        clearScheduleCache();
        
        toast({
          title: 'تم النشر',
          description: 'تم نشر الجدول بنجاح'
        });
        onPublish();
        onOpenChange(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'فشل النشر');
      }
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const markAsResolved = (conflictId: string) => {
    setResolvedConflicts(prev => new Set([...prev, conflictId]));
    toast({
      title: 'تم وضع علامة',
      description: 'تم وضع علامة على التعارض كمحلول'
    });
  };

  const filterConflicts = (conflicts: Conflict[]) => {
    if (selectedTab === 'all') return conflicts;
    if (selectedTab === 'critical') return conflicts.filter(c => c.severity === 'critical');
    if (selectedTab === 'warning') return conflicts.filter(c => c.severity === 'warning');
    if (selectedTab === 'info') return conflicts.filter(c => c.severity === 'info');
    return conflicts;
  };

  const renderConflictCard = (conflict: Conflict) => {
    const config = SEVERITY_CONFIG[conflict.severity];
    const Icon = config.icon;
    const isResolved = resolvedConflicts.has(conflict.id);

    return (
      <Card
        key={conflict.id}
        className={`${config.borderColor} ${isResolved ? 'opacity-50' : ''}`}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className={`p-2 rounded-lg ${config.bgColor}`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={config.badgeClass}>{config.label}</Badge>
                    <Badge variant="outline">
                      أولوية {conflict.priority_level}
                    </Badge>
                    {isResolved && (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="h-3 w-3 ml-1" />
                        تم الحل
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium text-gray-900">{conflict.description}</p>
                </div>
              </div>
            </div>

            {/* Affected Entities */}
            {conflict.affected_entities && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {conflict.affected_entities.subject_name && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">المادة:</span>
                    <span className="font-medium">{conflict.affected_entities.subject_name}</span>
                  </div>
                )}
                {conflict.affected_entities.teacher_name && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">المعلم:</span>
                    <span className="font-medium">{conflict.affected_entities.teacher_name}</span>
                  </div>
                )}
                {conflict.affected_entities.day && conflict.affected_entities.period && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">الوقت:</span>
                    <span className="font-medium">
                      {DAY_NAMES[conflict.affected_entities.day]} - الحصة {conflict.affected_entities.period}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Details */}
            {conflict.details && (
              <Alert className={`${config.bgColor} ${config.borderColor}`}>
                <AlertDescription className="text-sm">{conflict.details}</AlertDescription>
              </Alert>
            )}

            {/* Suggested Resolution */}
            {conflict.suggested_resolution && (
              <div className={`p-3 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
                <div className="flex items-start gap-2">
                  <Lightbulb className={`h-4 w-4 mt-0.5 ${config.color}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 mb-1">الحل المقترح:</p>
                    <p className="text-sm text-gray-600">{conflict.suggested_resolution}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              {conflict.can_override && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markAsResolved(conflict.id)}
                  disabled={isResolved}
                >
                  {isResolved ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 ml-1" />
                      تم الحل
                    </>
                  ) : (
                    'وضع علامة كمحلول'
                  )}
                </Button>
              )}
              {!conflict.can_override && (
                <p className="text-xs text-red-600 font-medium">
                  ⚠ يجب حل هذا التعارض قبل النشر
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تحليل التعارضات</DialogTitle>
            <DialogDescription>جاري فحص الجدول...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
              <p className="text-muted-foreground">جاري تحليل التعارضات...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!analysis) {
    return null;
  }

  const filteredConflicts = filterConflicts(analysis.conflicts);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl">تحليل التعارضات</DialogTitle>
          <DialogDescription>
            مراجعة وحل التعارضات قبل نشر الجدول
          </DialogDescription>
        </DialogHeader>

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className={analysis.total_conflicts === 0 ? 'border-green-200 bg-green-50' : ''}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{analysis.total_conflicts}</div>
              <div className="text-xs text-gray-600">إجمالي التعارضات</div>
            </CardContent>
          </Card>
          <Card className={analysis.critical_count > 0 ? 'border-red-200 bg-red-50' : ''}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-red-900">{analysis.critical_count}</div>
              <div className="text-xs text-red-600">تعارضات حرجة</div>
            </CardContent>
          </Card>
          <Card className={analysis.warning_count > 0 ? 'border-yellow-200 bg-yellow-50' : ''}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-yellow-900">{analysis.warning_count}</div>
              <div className="text-xs text-yellow-600">تحذيرات</div>
            </CardContent>
          </Card>
          <Card className={analysis.info_count > 0 ? 'border-blue-200 bg-blue-50' : ''}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-900">{analysis.info_count}</div>
              <div className="text-xs text-blue-600">معلومات</div>
            </CardContent>
          </Card>
        </div>

        {/* Status Alert */}
        {analysis.can_publish ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900">جاهز للنشر</AlertTitle>
            <AlertDescription className="text-green-700">
              {analysis.warning_count > 0 || analysis.info_count > 0
                ? 'لا توجد تعارضات حرجة. يمكنك النشر مع وجود تحذيرات.'
                : 'لا توجد تعارضات. الجدول جاهز للنشر.'}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>لا يمكن النشر</AlertTitle>
            <AlertDescription>
              يجب حل جميع التعارضات الحرجة ({analysis.critical_count}) قبل نشر الجدول.
            </AlertDescription>
          </Alert>
        )}

        {/* Conflicts List */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">
              الكل ({analysis.total_conflicts})
            </TabsTrigger>
            <TabsTrigger value="critical">
              حرجة ({analysis.critical_count})
            </TabsTrigger>
            <TabsTrigger value="warning">
              تحذيرات ({analysis.warning_count})
            </TabsTrigger>
            <TabsTrigger value="info">
              معلومات ({analysis.info_count})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-4">
            <div className="h-[400px] overflow-y-auto pr-4">
              {filteredConflicts.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-green-900">لا توجد تعارضات في هذه الفئة</p>
                  <p className="text-sm text-green-600 mt-2">الجدول يبدو جيداً!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredConflicts.map(renderConflictCard)}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Footer Actions */}
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          <Button
            variant="secondary"
            onClick={handleSaveAsDraft}
            disabled={!analysis.can_save_as_draft}
          >
            <Save className="h-4 w-4 ml-2" />
            حفظ كمسودة
          </Button>
          <Button
            onClick={handlePublish}
            disabled={!analysis.can_publish}
          >
            <Send className="h-4 w-4 ml-2" />
            نشر الجدول
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

