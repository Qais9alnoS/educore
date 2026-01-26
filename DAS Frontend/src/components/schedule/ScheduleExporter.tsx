import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileSpreadsheet,
  Download,
  Loader2,
  FileArchive,
  CheckCircle2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getApiToken } from '@/services/api';

interface ScheduleExporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId?: number;
  scheduleIds?: number[]; // For bulk export
  scheduleName?: string;
}

export const ScheduleExporter: React.FC<ScheduleExporterProps> = ({
  open,
  onOpenChange,
  scheduleId,
  scheduleIds,
  scheduleName = 'الجدول'
}) => {
  const [exporting, setExporting] = useState(false);

  const isBulkExport = scheduleIds && scheduleIds.length > 1;

  const handleExport = async () => {
    setExporting(true);

    try {
      // Get token from API client (which syncs with AuthContext)
      const token = getApiToken();
      
      if (!token) {
        throw new Error('يجب تسجيل الدخول أولاً');
      }

      let url: string;
      let filename: string = '';

      if (isBulkExport && scheduleIds) {
        // Bulk export
        url = 'http://localhost:8000/api/schedules/bulk-export';
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            schedule_ids: scheduleIds,
            format: 'excel'
          })
        });

        if (!response.ok) {
          throw new Error('فشل التصدير');
        }

        const blob = await response.blob();
        filename = `schedules_bulk_${Date.now()}.zip`;
        downloadBlob(blob, filename);
      } else if (scheduleId) {
        // Single export - Excel only
        url = `http://localhost:8000/api/schedules/${scheduleId}/export/excel`;
        filename = `${scheduleName}_${Date.now()}.xlsx`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('فشل التصدير');
        }

        const blob = await response.blob();
        downloadBlob(blob, filename);
      }

      toast({
        title: 'تم التصدير بنجاح',
        description: `تم حفظ الملف`
      });

      // Close dialog after success
      setTimeout(() => {
        onOpenChange(false);
        setExporting(false);
      }, 500);
    } catch (error: any) {
      toast({
        title: 'خطأ في التصدير',
        description: error.message || 'حدث خطأ أثناء تصدير الجدول',
        variant: 'destructive'
      });
      setExporting(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            تصدير إلى Excel
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isBulkExport 
              ? `سيتم تصدير ${scheduleIds?.length} جداول` 
              : `تصدير جدول ${scheduleName}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Export Info Card */}
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                {isBulkExport ? (
                  <FileArchive className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                  {isBulkExport ? 'ملف مضغوط (ZIP)' : 'ملف Excel (xlsx)'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {isBulkExport 
                    ? 'يحتوي على جميع الجداول المحددة'
                    : 'جدول منسق جاهز للطباعة والمشاركة'
                  }
                </p>
              </div>
            </div>

            {/* What's included */}
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">يتضمن الملف:</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>جدول الحصص الأسبوعي</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>أسماء المعلمين والمواد</span>
                </div>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {exporting && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>جاري تحضير الملف...</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
            className="dark:border-slate-700 dark:hover:bg-slate-800"
          >
            إلغاء
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || (!scheduleId && !isBulkExport)}
            className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جاري التصدير...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 ml-2" />
                تصدير الآن
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

