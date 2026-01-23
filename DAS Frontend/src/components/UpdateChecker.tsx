import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Download, RefreshCw } from 'lucide-react';

interface UpdateCheckerProps {
  onCheckComplete?: (hasUpdate: boolean) => void;
}

export function UpdateChecker({ onCheckComplete }: UpdateCheckerProps) {
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showDialog, setShowDialog] = useState(false);

  // Manual check function that can be called from settings
  const checkForUpdates = async () => {
    try {
      // Only work in Tauri environment
      if (typeof window === 'undefined' || !('__TAURI__' in window)) {
        onCheckComplete?.(false);
        return null;
      }

      // Dynamic import to avoid errors in non-Tauri environments
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      
      if (update) {
        setUpdateInfo(update);
        setShowDialog(true);
        onCheckComplete?.(true);
        return update;
      } else {
        onCheckComplete?.(false);
        return null;
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      onCheckComplete?.(false);
      return null;
    }
  };

  const downloadAndInstall = async () => {
    if (!updateInfo) return;

    try {
      setDownloading(true);
      
      await updateInfo.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            setDownloadProgress(0);
            break;
          case 'Progress':
            setDownloadProgress(Math.round((event.data.downloaded / event.data.contentLength) * 100));
            break;
          case 'Finished':
            setDownloadProgress(100);
            break;
        }
      });

      // Dynamic import and relaunch
      const processPlugin = await import('@tauri-apps/plugin-process');
      await processPlugin.relaunch();
    } catch (error) {
      console.error('Failed to download update:', error);
      setDownloading(false);
    }
  };

  return {
    checkForUpdates,
    dialog: (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              تحديث جديد متوفر
            </DialogTitle>
            <DialogDescription className="text-right">
              {updateInfo?.version ? (
                <>
                  الإصدار الجديد <span className="font-semibold">{updateInfo.version}</span> متوفر الآن
                </>
              ) : (
                'يوجد تحديث جديد للبرنامج'
              )}
            </DialogDescription>
          </DialogHeader>

          {updateInfo?.body && (
            <div className="my-4 rounded-md bg-muted p-4 text-right">
              <h4 className="mb-2 font-semibold">ما الجديد:</h4>
              <div className="text-sm whitespace-pre-wrap">{updateInfo.body}</div>
            </div>
          )}

          {downloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{downloadProgress}%</span>
                <span>جاري التحميل...</span>
              </div>
              <Progress value={downloadProgress} />
            </div>
          )}

          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              onClick={downloadAndInstall}
              disabled={downloading}
              className="gap-2"
            >
              {downloading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  جاري التحميل
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  تحديث الآن
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={downloading}
            >
              لاحقاً
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  };
}
