import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/services/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { User, Key, Eye, EyeOff, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ open, onOpenChange }) => {
  const { state: authState, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('info');
  const [usernameFormData, setUsernameFormData] = useState({ newUsername: '' });
  const [passwordFormData, setPasswordFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isLoading, setIsLoading] = useState(false);

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      director: 'مدير المدرسة',
      finance: 'المسؤول المالي',
      morning_school: 'إدارة الفترة الصباحية',
      evening_school: 'إدارة الفترة المسائية',
    };
    return roleLabels[role] || role;
  };

  const getRoleBadgeClass = (role: string) => {
    const roleClasses: Record<string, string> = {
      director: 'bg-primary text-primary-foreground',
      finance: 'bg-secondary text-secondary-foreground',
      morning_school: 'bg-accent text-accent-foreground',
      evening_school: 'bg-purple-500 text-white',
    };
    return roleClasses[role] || 'bg-gray-500 text-white';
  };

  const handleChangeUsername = async () => {
    if (!usernameFormData.newUsername.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال اسم المستخدم الجديد',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await authApi.updateUsername(usernameFormData.newUsername);

      if (response.success) {
        toast({
          title: 'نجح',
          description: 'تم تغيير اسم المستخدم بنجاح. سيتم تسجيل الخروج الآن.'
        });

        // Log out user after username change
        setTimeout(async () => {
          await logout();
          navigate('/login');
          onOpenChange(false);
        }, 1500);
      }
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل تغيير اسم المستخدم',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordFormData.currentPassword || !passwordFormData.newPassword || !passwordFormData.confirmPassword) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول',
        variant: 'destructive'
      });
      return;
    }

    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      toast({
        title: 'خطأ',
        description: 'كلمة المرور الجديدة وتأكيدها غير متطابقين',
        variant: 'destructive'
      });
      return;
    }

    if (passwordFormData.newPassword.length < 8) {
      toast({
        title: 'خطأ',
        description: 'يجب أن تكون كلمة المرور 8 أحرف على الأقل',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await authApi.changePassword({
        current_password: passwordFormData.currentPassword,
        new_password: passwordFormData.newPassword
      });

      if (response.success) {
        toast({
          title: 'نجح',
          description: 'تم تغيير كلمة المرور بنجاح. سيتم تسجيل الخروج الآن.'
        });

        // Clear form
        setPasswordFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });

        // Log out user after password change
        setTimeout(async () => {
          await logout();
          navigate('/login');
          onOpenChange(false);
        }, 1500);
      }
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل تغيير كلمة المرور',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>الملف الشخصي</DialogTitle>
          <DialogDescription>
            عرض وتعديل معلومات حسابك
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">المعلومات</TabsTrigger>
            <TabsTrigger value="username">تغيير اسم المستخدم</TabsTrigger>
            <TabsTrigger value="password">تغيير كلمة المرور</TabsTrigger>
          </TabsList>

          {/* User Info Tab */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
                <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
                  <span className="text-primary-foreground text-2xl font-semibold">
                    {authState.user?.username?.[0]?.toUpperCase() || 'م'}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{authState.user?.username}</h3>
                  <Badge className={getRoleBadgeClass(authState.user?.role || '')}>
                    {getRoleLabel(authState.user?.role || '')}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">رقم المستخدم</Label>
                    <p className="text-sm font-medium">#{authState.user?.id}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">الحالة</Label>
                    <Badge variant={authState.user?.is_active ? 'default' : 'secondary'}>
                      {authState.user?.is_active ? 'نشط' : 'معطل'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Change Username Tab */}
          <TabsContent value="username" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>اسم المستخدم الحالي</Label>
                <Input
                  value={authState.user?.username || ''}
                  disabled
                  className="rounded-xl bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-username">اسم المستخدم الجديد</Label>
                <Input
                  id="new-username"
                  type="text"
                  placeholder="أدخل اسم المستخدم الجديد"
                  value={usernameFormData.newUsername}
                  onChange={(e) => setUsernameFormData({ newUsername: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>ملاحظة:</strong> سيتم تسجيل خروجك تلقائياً بعد تغيير اسم المستخدم
                </p>
              </div>

              <Button
                onClick={handleChangeUsername}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>جاري التغيير...</span>
                  </div>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    تغيير اسم المستخدم
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Change Password Tab */}
          <TabsContent value="password" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="current-password">كلمة المرور الحالية</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showPasswords.current ? 'text' : 'password'}
                    placeholder="أدخل كلمة المرور الحالية"
                    value={passwordFormData.currentPassword}
                    onChange={(e) => setPasswordFormData(prev => ({
                      ...prev,
                      currentPassword: e.target.value
                    }))}
                    className="rounded-xl pl-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPasswords(prev => ({
                      ...prev,
                      current: !prev.current
                    }))}
                  >
                    {showPasswords.current ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPasswords.new ? 'text' : 'password'}
                    placeholder="أدخل كلمة المرور الجديدة"
                    value={passwordFormData.newPassword}
                    onChange={(e) => setPasswordFormData(prev => ({
                      ...prev,
                      newPassword: e.target.value
                    }))}
                    className="rounded-xl pl-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPasswords(prev => ({
                      ...prev,
                      new: !prev.new
                    }))}
                  >
                    {showPasswords.new ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل
                </p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">تأكيد كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showPasswords.confirm ? 'text' : 'password'}
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                    value={passwordFormData.confirmPassword}
                    onChange={(e) => setPasswordFormData(prev => ({
                      ...prev,
                      confirmPassword: e.target.value
                    }))}
                    className="rounded-xl pl-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPasswords(prev => ({
                      ...prev,
                      confirm: !prev.confirm
                    }))}
                  >
                    {showPasswords.confirm ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>ملاحظة:</strong> سيتم تسجيل خروجك تلقائياً بعد تغيير كلمة المرور
                </p>
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>جاري التغيير...</span>
                  </div>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    تغيير كلمة المرور
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
