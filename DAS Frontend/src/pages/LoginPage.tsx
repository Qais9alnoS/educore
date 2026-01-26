import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IOSSwitch } from '@/components/ui/ios-switch';
import { UserRole } from '@/types/school';
import { Eye, EyeOff, School, User, DollarSign, Sun, Moon, LogIn } from 'lucide-react';

const LoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { state, login, clearError } = useAuth();
    const [activeTab, setActiveTab] = useState("login");

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: '' as UserRole | ''
    });
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const from = location.state?.from?.pathname || '/';

    // Redirect if already authenticated
    useEffect(() => {
        if (state.isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [state.isAuthenticated, navigate, from]);

    // Clear error when component mounts - run only once
    useEffect(() => {
        clearError();
    }, []);

    const roleOptions = [
        {
            value: 'director' as UserRole,
            label: 'مدير المدرسة',
            description: 'صلاحيات كاملة لإدارة النظام',
            icon: School,
            color: 'text-primary',
            bgColor: 'bg-primary/10'
        },
        {
            value: 'finance' as UserRole,
            label: 'المسؤول المالي',
            description: 'إدارة الشؤون المالية والمحاسبة',
            icon: DollarSign,
            color: 'text-secondary',
            bgColor: 'bg-secondary/10'
        },
        {
            value: 'morning_school' as UserRole,
            label: 'إدارة الفترة الصباحية',
            description: 'إدارة الطلاب والمعلمين في الفترة الصباحية',
            icon: Sun,
            color: 'text-accent',
            bgColor: 'bg-accent/10'
        },
        {
            value: 'evening_school' as UserRole,
            label: 'إدارة الفترة المسائية',
            description: 'إدارة الطلاب والمعلمين في الفترة المسائية',
            icon: Moon,
            color: 'text-primary',
            bgColor: 'bg-primary/10'
        }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.username || !formData.password || !formData.role) {
            return;
        }

        await login(
            {
                username: formData.username,
                password: formData.password,
                role: formData.role
            },
            { remember: rememberMe }
        );
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const selectedRole = roleOptions.find(role => role.value === formData.role);

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-50/50 via-slate-50 to-slate-100/60 dark:from-background dark:via-background dark:to-muted/30 flex items-center justify-center p-4 overflow-hidden">
            <div className="w-full max-w-md h-full max-h-[100vh] flex flex-col justify-center py-8 overflow-y-auto scrollbar-hide">
                {/* App Logo and Title */}
                <div className="text-center mb-8 flex-shrink-0">
                    <img src="/icon.png" alt="DAS Logo" className="w-20 h-20 mx-auto mb-3" />
                    <h1 className="text-2xl font-bold text-foreground mb-1">
                        Educore
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        مرحباً بك، قم بتسجيل الدخول للمتابعة
                    </p>
                </div>

                <Card className="rounded-3xl shadow-2xl backdrop-blur-sm bg-white/95 dark:bg-card/95 border-slate-200/60 dark:border-border flex-shrink-0">
                <CardHeader className="space-y-1 p-5 pb-3">
                    <CardTitle className="text-xl text-center font-bold">تسجيل الدخول</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 p-5 pt-2">
                    {state.error && (
                        <Alert variant="destructive" className="rounded-2xl">
                            <AlertDescription>{state.error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Role Selection */}
                        <div className="space-y-1.5">
                            <Label htmlFor="role" className="text-sm font-semibold">الصلاحية</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(value) => handleInputChange('role', value)}
                            >
                                <SelectTrigger className="w-full h-11 rounded-2xl border-2 transition-all focus:ring-2 focus:ring-primary/20">
                                    <SelectValue placeholder="اختر صلاحيتك" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    {roleOptions.map((role) => (
                                        <SelectItem key={role.value} value={role.value} className="rounded-xl my-1">
                                            <div className="flex items-center space-x-3 space-x-reverse py-1">
                                                <div className={`p-2 rounded-lg ${role.bgColor}`}>
                                                    <role.icon className={`h-4 w-4 ${role.color}`} />
                                                </div>
                                                <div className="font-medium text-sm">{role.label}</div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Username */}
                        <div className="space-y-1.5">
                            <Label htmlFor="username" className="text-sm font-semibold">اسم المستخدم</Label>
                            <div className="relative">
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="أدخل اسم المستخدم"
                                    value={formData.username}
                                    onChange={(e) => handleInputChange('username', e.target.value)}
                                    className="pl-10 h-11 rounded-2xl border-2 transition-all focus:ring-2 focus:ring-primary/20"
                                    required
                                />
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-sm font-semibold">كلمة المرور</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="أدخل كلمة المرور"
                                    value={formData.password}
                                    onChange={(e) => handleInputChange('password', e.target.value)}
                                    className="pl-10 h-11 rounded-2xl border-2 transition-all focus:ring-2 focus:ring-primary/20"
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute left-0 top-0 h-full px-3 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/40 px-3.5 py-2.5">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-semibold">تذكرني</Label>
                                <p className="text-xs text-muted-foreground">تسجيل الدخول تلقائياً في المرة القادمة</p>
                            </div>
                            <IOSSwitch checked={rememberMe} onCheckedChange={setRememberMe} />
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full h-11 rounded-full text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                            disabled={state.isLoading || !formData.username || !formData.password || !formData.role}
                        >
                            {state.isLoading ? (
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    <span>جاري تسجيل الدخول...</span>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <LogIn className="h-5 w-5" />
                                    <span>تسجيل الدخول</span>
                                </div>
                            )}
                        </Button>
                    </form>
                </CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center mt-6 text-xs text-muted-foreground flex-shrink-0">
                    <p dir="ltr">© Rizonway 2026</p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;