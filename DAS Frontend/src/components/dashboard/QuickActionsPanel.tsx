import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Users,
  GraduationCap,
  Trophy,
  Calendar,
  DollarSign,
  FileText,
  UserCog,
  ClipboardList,
  Folder,
  Plus,
  School,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { directorApi } from "@/services/api";

interface QuickActionsPanelProps {
  loading?: boolean;
  academicYearId?: number;
  sessionFilter?: 'morning' | 'evening' | 'both';
  userRole?: string;
}

interface QuickAction {
  label: string;
  icon: React.ElementType;
  path: string;
  color: string;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  loading = false,
  academicYearId,
  sessionFilter = 'both',
  userRole,
}) => {
  const navigate = useNavigate();
  const [recentFolders, setRecentFolders] = useState<
    Array<{ id: number; name: string; count: number; category: string }>
  >([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  const isDirector = userRole === 'director';
  const isMorningSchool = userRole === 'morning_school';
  const isEveningSchool = userRole === 'evening_school';
  const isFinance = userRole === 'finance';

  // Using app's main colors: primary (blue), accent (amber), secondary (orange)
  const allQuickActions: (QuickAction & { roles?: string[] })[] = [
    {
      label: "إدارة الطلاب",
      icon: Users,
      path: "/students/personal-info",
      color: "text-primary bg-primary/10",
      roles: ['director', 'morning_school', 'evening_school'],
    },
    {
      label: "إدارة المعلمين",
      icon: GraduationCap,
      path: "/teachers",
      color: "text-primary bg-primary/10",
      roles: ['director', 'morning_school', 'evening_school'],
    },
    {
      label: "نشاط جديد",
      icon: Trophy,
      path: "/activities",
      color: "text-accent bg-accent/10",
      roles: ['director'], // Director only
    },
    {
      label: "جدول جديد",
      icon: Calendar,
      path: "/schedules",
      color: "text-accent bg-accent/10",
      roles: ['director', 'morning_school', 'evening_school'],
    },
    {
      label: "قيد مالي جديد",
      icon: DollarSign,
      path: "/finance",
      color: "text-secondary bg-secondary/10",
      roles: ['director'], // Director only
    },
    {
      label: "ملاحظات المدير",
      icon: FileText,
      path: "/director/notes",
      color: "text-secondary bg-secondary/10",
      roles: ['director'], // Director only
    },
    {
      label: "إدارة المستخدمين",
      icon: UserCog,
      path: "/user-management",
      color: "text-primary bg-primary/10",
      roles: ['director'], // Director only
    },
    {
      label: "الصفحة اليومية",
      icon: ClipboardList,
      path: "/daily",
      color: "text-accent bg-accent/10",
      roles: ['director', 'morning_school', 'evening_school'],
    },
    {
      label: "معلومات المدرسة",
      icon: School,
      path: "/school-info",
      color: "text-secondary bg-secondary/10",
      roles: ['director', 'morning_school', 'evening_school'],
    },
    // Finance-specific actions
    {
      label: "الصندوق",
      icon: DollarSign,
      path: "/finance?tab=treasury",
      color: "text-primary bg-primary/10",
      roles: ['finance'],
    },
    {
      label: "الطلاب المالية",
      icon: Users,
      path: "/finance?tab=students",
      color: "text-accent bg-accent/10",
      roles: ['finance'],
    },
    {
      label: "السنوات الدراسية",
      icon: Calendar,
      path: "/academic-years",
      color: "text-secondary bg-secondary/10",
      roles: ['finance'],
    },
  ];

  // Filter actions based on user role
  const quickActions = allQuickActions.filter(action =>
    !action.roles || action.roles.includes(userRole || 'director')
  );

  // Fetch real folders from director notes API (only for directors)
  useEffect(() => {
    const fetchRecentFolders = async () => {
      if (!academicYearId || !isDirector) return;

      setLoadingFolders(true);
      try {
        const categories = ["goals", "projects", "blogs", "educational_admin"];
        const allFolders: Array<{
          id: number;
          name: string;
          count: number;
          category: string;
        }> = [];

        // Fetch folders from all categories
        for (const category of categories) {
          try {
            const response = await directorApi.listFolderContents(
              academicYearId,
              category
            );
            if (response.success && response.data?.items) {
              // Filter only folders (is_folder === true)
              const folders = response.data.items
                .filter((item: any) => item.is_folder === true)
                .map((folder: any) => ({
                  id: folder.id,
                  name: folder.title,
                  count: 0, // We'll count files if needed
                  category: category,
                }));
              allFolders.push(...folders);
            }
          } catch (error) {

          }
        }

        // Take first 3 folders (since we don't have file counts)
        const topFolders = allFolders.slice(0, 3);

        setRecentFolders(topFolders);
      } catch (error) {

        setRecentFolders([]);
      } finally {
        setLoadingFolders(false);
      }
    };

    fetchRecentFolders();
  }, [academicYearId]);

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>اختصارات سريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-3 gap-2">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">اختصارات سريعة</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 overflow-auto">
        {/* Quick Actions Grid */}
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              className={`h-auto flex-col gap-1.5 p-2.5 ${action.color} border border-border/20 hover:border-border/40 transition-colors`}
              onClick={() => navigate(action.path)}
            >
              <action.icon className="h-4 w-4" />
              <span className="text-xs font-medium text-center leading-tight">
                {action.label}
              </span>
            </Button>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-border my-2"></div>

        {/* Recent Notes Folders - Director only */}
        {isDirector && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Folder className="h-4 w-4" />
                  مجلدات حديثة
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-auto py-0.5 px-2"
                  onClick={() => navigate("/director/notes")}
                >
                  عرض الكل ←
                </Button>
              </div>
              <div className="space-y-1">
                {loadingFolders ? (
                  <div className="flex items-center justify-center py-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  </div>
                ) : recentFolders.length > 0 ? (
                  recentFolders.map((folder) => (
                    <button
                      key={folder.id}
                      className="w-full flex items-center justify-between p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-right"
                      onClick={() =>
                        navigate(`/director/notes/browse/${folder.category}`, {
                          state: {
                            folderId: folder.id,
                            folderData: {
                              title: folder.name,
                            },
                          },
                        })
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        <Folder className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">{folder.name}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-center text-muted-foreground py-1.5">
                    لا توجد مجلدات
                  </p>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border my-2"></div>
          </>
        )}

        {/* Quick Create Grid - Filtered based on role */}
        <div className="space-y-1.5">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            إنشاء سريع
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {/* نشاط - Opens activity page with add popup (Director only) */}
            {isDirector && (
              <Button
                variant="outline"
                size="lg"
                className="h-16 flex-col gap-1.5 border-dashed border-2 hover:bg-accent/10 hover:border-accent transition-all"
                onClick={() =>
                  navigate("/activities", {
                    state: { openAddDialog: true },
                  })
                }
              >
                <Plus className="h-5 w-5 text-accent" />
                <span className="text-xs font-medium text-accent">
                  نشاط
                </span>
              </Button>
            )}

            {/* جدول - Opens schedules page in "اختيار الصف" section (Not for finance) */}
            {!isFinance && (
              <Button
                variant="outline"
                size="lg"
                className="h-16 flex-col gap-1.5 border-dashed border-2 hover:bg-primary/10 hover:border-primary transition-all"
                onClick={() =>
                  navigate("/schedules", {
                    state: { scrollToClassSelection: true },
                  })
                }
              >
                <Plus className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-primary">
                  جدول
                </span>
              </Button>
            )}

            {/* طالب جديد - Opens students page with add dialog (Morning/Evening only) */}
            {(isMorningSchool || isEveningSchool) && (
              <Button
                variant="outline"
                size="lg"
                className="h-16 flex-col gap-1.5 border-dashed border-2 hover:bg-accent/10 hover:border-accent transition-all"
                onClick={() =>
                  navigate("/students/personal-info", {
                    state: { openAddDialog: true },
                  })
                }
              >
                <Plus className="h-5 w-5 text-accent" />
                <span className="text-xs font-medium text-accent">
                  طالب
                </span>
              </Button>
            )}

            {/* كارد مالي - Opens finance page with add card popup (Director and Finance) */}
            {(isDirector || isFinance) && (
              <Button
                variant="outline"
                size="lg"
                className="h-16 flex-col gap-1.5 border-dashed border-2 hover:bg-secondary/10 hover:border-secondary transition-all"
                onClick={() =>
                  navigate("/finance", {
                    state: { openAddCardDialog: true },
                  })
                }
              >
                <Plus className="h-5 w-5 text-secondary" />
                <span className="text-xs font-medium text-secondary">
                  كارد مالي
                </span>
              </Button>
            )}

            {/* ملاحظة - Same as before (Director only) */}
            {isDirector && (
              <Button
                variant="outline"
                size="lg"
                className="h-16 flex-col gap-1.5 border-dashed border-2 hover:bg-primary/10 hover:border-primary transition-all"
                onClick={() =>
                  navigate("/director/notes", {
                    state: { openAddDialog: true },
                  })
                }
              >
                <Plus className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-primary">
                  ملاحظة
                </span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
