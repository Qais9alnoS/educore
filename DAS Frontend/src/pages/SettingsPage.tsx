import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useZoom } from '@/contexts/ZoomContext';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserProfileModal } from '@/components/UserProfileModal';
import { IOSSwitch } from '@/components/ui/ios-switch';
import { useUpdateChecker, UpdateDialog } from '@/components/UpdateChecker';
import { useToast } from '@/hooks/use-toast';
import { Sun, Moon, Monitor, FolderOpen, RotateCcw, Settings, Folder, User, Download, RefreshCw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const getRoleDisplay = (role?: string) => {
  const roleLabels: Record<string, string> = {
    director: 'مدير',
    finance: 'مالية',
    morning_school: 'إدارة الفترة الصباحية',
    evening_school: 'إدارة الفترة المسائية',
    morning_supervisor: 'مشرف صباحي',
    evening_supervisor: 'مشرف مسائي',
  };

  if (!role) return 'مستخدم';
  return roleLabels[role] || 'مستخدم';
};

interface SettingsPageProps {}

const SettingsPage: React.FC<SettingsPageProps> = () => {
  const { state: authState } = useAuth();
  const { zoom, setZoom, fontSize, setFontSize } = useZoom();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [isDirector, setIsDirector] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [rememberMeEnabled, setRememberMeEnabled] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  const updateChecker = useUpdateChecker();

  const zoomPresets = [80, 90, 100, 125, 150];
  const fontSizePresets = [14, 16, 18, 20];

  useEffect(() => {
    setMounted(true);
    setIsDirector(authState.user?.role === 'director');
    if (typeof window !== 'undefined') {
      setRememberMeEnabled(Boolean(localStorage.getItem('das_auth')));
    }
  }, [authState]);

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
  };

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
  };

  const handleZoomInputChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      // Clamp between 80 and 150
      const clampedValue = Math.max(80, Math.min(150, numValue));
      handleZoomChange(clampedValue);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
  };

  const handleOpenAppDirectory = async () => {
    try {
      await invoke('open_directory', { path: '' });
    } catch (error) {
      console.error('Failed to open app directory:', error);
    }
  };

  const handleOpenDirectorNotesFolder = async () => {
    try {
      await invoke('open_directory', { path: 'director_notes' });
    } catch (error) {
      console.error('Failed to open director notes folder:', error);
    }
  };

  const handleCheckForUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const update = await updateChecker.checkForUpdates(true); // manual = true
      setCheckingUpdates(false);
      if (!update) {
        toast({
          title: "لا توجد تحديثات",
          description: "أنت تستخدم أحدث إصدار من البرنامج",
        });
      }
      // If update exists, dialog will show automatically
    } catch (error: any) {
      console.error('Failed to check for updates:', error);
      console.error('Error message:', error?.message);
      console.error('Error string:', String(error));
      setCheckingUpdates(false);
      const errorMessage = error?.message || String(error);
      const errorLower = errorMessage.toLowerCase();
      let description = "فشل التحقق من التحديثات. يرجى المحاولة لاحقاً";
      
      if (errorMessage.includes("UPDATE_NOT_AVAILABLE_DEV")) {
        description = "التحديثات غير متوفرة في وضع التطوير";
      } else if (errorMessage.includes("UPDATE_NO_RELEASE")) {
        description = "لا توجد إصدارات متوفرة حالياً. أنت تستخدم أحدث إصدار";
      } else if (errorLower.includes("up to date") || errorLower.includes("already on latest") || errorLower.includes("no update")) {
        // Not an error - user is on latest version
        toast({
          title: "لا توجد تحديثات",
          description: "أنت تستخدم أحدث إصدار من البرنامج",
        });
        return;
      } else if (errorMessage.includes("UPDATE_NETWORK_ERROR") || errorLower.includes("network") || errorLower.includes("fetch") || errorLower.includes("failed to send request")) {
        description = "تعذر الاتصال بخادم التحديثات. تحقق من اتصال الإنترنت";
      } else if (errorLower.includes("404") || errorLower.includes("not found")) {
        description = "لا توجد تحديثات متوفرة حالياً";
      }
      
      toast({
        title: "خطأ",
        description,
        variant: "destructive"
      });
    }
  };

  const handleRememberToggle = (value: boolean) => {
    setRememberMeEnabled(value);
    if (typeof window === 'undefined') return;

    if (value) {
      if (authState.token && authState.user) {
        localStorage.setItem(
          'das_auth',
          JSON.stringify({
            token: authState.token,
            user: authState.user,
          })
        );
      }
    } else {
      localStorage.removeItem('das_auth');
    }
  };

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Settings className="h-8 w-8 text-yellow-500" />
            الإعدادات
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة تفضيلات التطبيق والخيارات العامة
          </p>
        </div>

        {/* Account Section */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-yellow-500" />
              حسابي
            </CardTitle>
            <CardDescription>إدارة بيانات تسجيل الدخول الخاصة بك</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 rounded-2xl bg-muted/50">
              <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-semibold">
                {authState.user?.username?.[0]?.toUpperCase() || 'م'}
              </div>
              <div className="flex-1 w-full space-y-2">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-bold text-foreground">{authState.user?.username || 'مستخدم'}</h3>
                  <Badge className="w-fit">
                    {getRoleDisplay(authState.user?.role)}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-sm">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">رقم المستخدم</Label>
                    <p className="font-medium">#{authState.user?.id || '---'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">دور الحساب</Label>
                    <p className="font-medium">{getRoleDisplay(authState.user?.role)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="flex-1" onClick={() => setIsProfileModalOpen(true)}>
                إدارة بيانات الدخول
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/40 px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold">تذكرني</p>
                <p className="text-xs text-muted-foreground">حافظ على تسجيل دخولي في هذا الجهاز</p>
              </div>
              <IOSSwitch
                checked={rememberMeEnabled}
                onCheckedChange={handleRememberToggle}
                disabled={!authState.user || !authState.token}
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-yellow-500" />
              المظهر
            </CardTitle>
            <CardDescription>تخصيص مظهر التطبيق</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Theme Toggle */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">اختر المظهر</Label>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={() => handleThemeChange('light')}
                  variant={theme === 'light' ? 'default' : 'outline'}
                  className="flex items-center gap-2"
                >
                  <Sun className="h-4 w-4" />
                  النهار
                </Button>
                <Button
                  onClick={() => handleThemeChange('dark')}
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  className="flex items-center gap-2"
                >
                  <Moon className="h-4 w-4" />
                  الليل
                </Button>
                <Button
                  onClick={() => handleThemeChange('system')}
                  variant={theme === 'system' ? 'default' : 'outline'}
                  className="flex items-center gap-2"
                >
                  <Monitor className="h-4 w-4" />
                  تلقائي
                </Button>
              </div>
            </div>

            {/* Zoom Level */}
            <div className="space-y-3 border-t pt-6">
              <Label className="text-base font-semibold">حجم الواجهة</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">اختر من الخيارات</Label>
                  <Select value={zoom.toString()} onValueChange={(val) => handleZoomChange(parseInt(val))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {zoomPresets.map((preset) => (
                        <SelectItem key={preset} value={preset.toString()}>
                          {preset}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">أو أدخل قيمة (80%-150%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="80"
                      max="150"
                      value={zoom}
                      onChange={(e) => handleZoomInputChange(e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                الحجم الحالي: <span className="font-semibold">{zoom}%</span>
              </p>
            </div>

            {/* Font Size */}
            <div className="space-y-3 border-t pt-6">
              <Label className="text-base font-semibold">حجم الخط</Label>
              <div className="grid grid-cols-4 gap-2">
                {fontSizePresets.map((size) => (
                  <Button
                    key={size}
                    onClick={() => handleFontSizeChange(size)}
                    variant={fontSize === size ? 'default' : 'outline'}
                    className="h-12 flex items-center justify-center"
                  >
                    <span style={{ fontSize: `${size}px` }}>A</span>
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                الحجم الحالي: <span className="font-semibold">{fontSize}px</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* File Access Section */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-yellow-500" />
              الملفات والمجلدات
            </CardTitle>
            <CardDescription>الوصول السريع إلى مجلدات التطبيق</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleOpenAppDirectory}
              variant="outline"
              className="w-full justify-start h-11"
            >
              <FolderOpen className="h-4 w-4 ml-2" />
              فتح مجلد التطبيق
            </Button>

            {isDirector && (
              <Button
                onClick={handleOpenDirectorNotesFolder}
                variant="outline"
                className="w-full justify-start h-11"
              >
                <FolderOpen className="h-4 w-4 ml-2" />
                فتح مجلد ملاحظات المدير
              </Button>
            )}
          </CardContent>
        </Card>

        {/* System Section */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-yellow-500" />
              النظام
            </CardTitle>
            <CardDescription>خيارات النظام والتحديثات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleCheckForUpdates}
              variant="outline"
              className="w-full justify-start h-11"
              disabled={checkingUpdates}
            >
              {checkingUpdates ? (
                <>
                  <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                  جاري التحقق...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 ml-2" />
                  البحث عن تحديثات
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              التحقق من توفر نسخة جديدة من التطبيق
            </p>
          </CardContent>
        </Card>

        {/* Update Dialog */}
        <UpdateDialog
          open={updateChecker.showDialog}
          onOpenChange={updateChecker.setShowDialog}
          updateInfo={updateChecker.updateInfo}
          downloading={updateChecker.downloading}
          downloadProgress={updateChecker.downloadProgress}
          onDownloadAndInstall={updateChecker.downloadAndInstall}
        />

        {/* Meta info */}
        <div className="pt-2 pb-4 text-center text-xs text-muted-foreground flex flex-col items-center gap-1" dir="rtl">
          <div className="flex items-center gap-1">
            <span>الإصدار</span>
            <span dir="ltr">v1.0</span>
          </div>
          <div className="flex items-center gap-1">
            <span>©</span>
            <span dir="ltr">Rizonway</span>
          </div>
        </div>
      </div>

      <UserProfileModal open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen} />
    </div>
  );
};

export default SettingsPage;
