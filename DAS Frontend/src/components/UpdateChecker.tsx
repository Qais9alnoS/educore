import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Download, RefreshCw } from "lucide-react";

interface UseUpdateCheckerReturn {
  checkForUpdates: (manual?: boolean) => Promise<any>;
  updateInfo: any;
  downloading: boolean;
  downloadProgress: number;
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  downloadAndInstall: () => Promise<void>;
}

export function useUpdateChecker(): UseUpdateCheckerReturn {
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showDialog, setShowDialog] = useState(false);

  const checkForUpdates = async (manual: boolean = false) => {
    try {
      // Only work in Tauri environment
      if (typeof window === "undefined" || !("__TAURI__" in window)) {
        if (manual) {
          throw new Error("NOT_TAURI");
        }
        return null;
      }

      // Dynamic import to avoid errors in non-Tauri environments
      const { check } = await import("@tauri-apps/plugin-updater");
      
      let update;
      try {
        update = await check();
      } catch (checkError: any) {
        const errStr = String(checkError?.message || checkError).toLowerCase();
        console.error("Update check error details:", errStr);
        
        // Handle specific error cases
        // "up to date" or "already on latest" means no update needed - not an error
        if (errStr.includes("up to date") || errStr.includes("already") || errStr.includes("latest")) {
          return null; // No update available - this is success, not error
        } else if (errStr.includes("404") || errStr.includes("not found")) {
          throw new Error("UPDATE_NO_RELEASE");
        } else if (errStr.includes("network") || errStr.includes("fetch") || errStr.includes("failed to fetch") || errStr.includes("connection")) {
          throw new Error("UPDATE_NETWORK_ERROR");
        } else if (errStr.includes("could not fetch") || errStr.includes("request")) {
          throw new Error("UPDATE_NETWORK_ERROR");
        }
        throw checkError;
      }

      if (update) {
        setUpdateInfo(update);
        setShowDialog(true);
        return update;
      } else {
        // Return null but don't show dialog - let caller handle it
        return null;
      }
    } catch (error: any) {
      console.error("Failed to check for updates:", error);
      // Provide more context about the error
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("NOT_TAURI")) {
        throw new Error("UPDATE_NOT_AVAILABLE_DEV");
      } else if (errorMessage.includes("UPDATE_NO_RELEASE") || errorMessage.includes("UPDATE_NETWORK_ERROR")) {
        throw error; // Re-throw our custom errors
      } else if (errorMessage.toLowerCase().includes("network") || errorMessage.toLowerCase().includes("fetch") || errorMessage.includes("404")) {
        throw new Error("UPDATE_NETWORK_ERROR");
      }
      throw error; // Throw error so caller can handle it
    }
  };

  const downloadAndInstall = async () => {
    if (!updateInfo) return;

    try {
      setDownloading(true);

      await updateInfo.downloadAndInstall((event: any) => {
        switch (event.event) {
          case "Started":
            setDownloadProgress(0);
            break;
          case "Progress":
            setDownloadProgress(
              Math.round(
                (event.data.downloaded / event.data.contentLength) * 100,
              ),
            );
            break;
          case "Finished":
            setDownloadProgress(100);
            break;
        }
      });

      // Dynamic import and relaunch
      const processPlugin = await import("@tauri-apps/plugin-process");
      await processPlugin.relaunch();
    } catch (error) {
      console.error("Failed to download update:", error);
      setDownloading(false);
    }
  };

  return {
    checkForUpdates,
    updateInfo,
    downloading,
    downloadProgress,
    showDialog,
    setShowDialog,
    downloadAndInstall,
  };
}

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateInfo: any;
  downloading: boolean;
  downloadProgress: number;
  onDownloadAndInstall: () => void;
}

export function UpdateDialog({
  open,
  onOpenChange,
  updateInfo,
  downloading,
  downloadProgress,
  onDownloadAndInstall,
}: UpdateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            تحديث جديد متوفر
          </DialogTitle>
          <DialogDescription className="text-right">
            {updateInfo?.version ? (
              <>
                الإصدار الجديد{" "}
                <span className="font-semibold">{updateInfo.version}</span>{" "}
                متوفر الآن
              </>
            ) : (
              "يوجد تحديث جديد للبرنامج"
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
            onClick={onDownloadAndInstall}
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
            onClick={() => onOpenChange(false)}
            disabled={downloading}
          >
            لاحقاً
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
