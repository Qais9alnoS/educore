import React, { useContext, useState, useEffect } from "react";
import { NavLink, useParams, useLocation, useNavigate } from "react-router-dom";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { UserProfileModal } from "@/components/UserProfileModal";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  School,
  Settings,
  Calendar,
  DollarSign,
  FileText,
  GraduationCap,
  ClipboardList,
  Trophy,
  HeartHandshake,
  UserCheck,
  CalendarDays,
  Database,
  HardDrive,
  Bell,
  FileArchive,
  BarChart3,
  Shield,
  Search,
  Building,
  MapPin,
  Phone,
  Mail,
  Clock,
  Cpu,
  MemoryStick,
  Zap,
  Wallet,
  Target,
  StickyNote,
  Book,
  Truck,
  Award,
  Folder,
  Key,
  TrendingUp,
  PieChart,
  Receipt,
  Calculator,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Eye,
  Filter,
  Layers,
  Ban,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  PanelRight,
  Menu,
  X,
  LogOut,
} from "lucide-react";

// Helper function to get role label in Arabic
const getRoleLabel = (role: string): string => {
  const roleLabels: Record<string, string> = {
    director: "مدير",
    finance: "مالية",
    morning_school: "مدرسة صباحية",
    evening_school: "مدرسة مسائية",
    morning_supervisor: "مشرف فترة صباحية",
    evening_supervisor: "مشرف فترة مسائية",
  };
  return roleLabels[role] || role;
};

const Sidebar = ({ isCollapsed, setIsCollapsed, sidebarWidth }) => {
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useProject();
  const { projects } = state;
  const { logout, state: authState, hasRole, hasAnyRole } = useAuth();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [isResizing, setIsResizing] = useState(false);
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Function to toggle sidebar
  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    setCustomWidth(null);
  };

  // Function to toggle sections
  const toggleSection = (name: string) => {
    setExpandedSections((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name],
    );
  };

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 90 && newWidth <= 400) {
        setCustomWidth(newWidth);
        setIsCollapsed(newWidth < 150);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // Determine if we should show text based on sidebar width
  const actualWidth = customWidth || (isCollapsed ? 90 : 288);
  const showText = actualWidth > 150;

  // Navigation items with role-based access control and grouping
  const allNavItems = [
    // Finance Manager specific sections (visible only for finance role)
    {
      name: "لوحة التحكم",
      href: "/dashboard",
      icon: LayoutDashboard,
      allowedRoles: ["finance"],
    },
    {
      name: "الصندوق",
      href: "/finance?tab=treasury",
      icon: Wallet,
      allowedRoles: ["finance"],
    },
    {
      name: "الطلاب",
      href: "/finance?tab=students",
      icon: Users,
      allowedRoles: ["finance"],
    },

    // المجموعة 1: لوحة التحكم والصفحة اليومية وملاحظات المدير
    {
      name: "لوحة التحكم",
      href: "/dashboard",
      icon: LayoutDashboard,
      allowedRoles: ["director", "morning_school", "evening_school"],
    },
    {
      name: "الصفحة اليومية",
      href: "/daily",
      icon: ClipboardList,
      allowedRoles: ["director", "morning_school", "evening_school"],
    },
    {
      name: "ملاحظات المدير",
      href: "/director/notes",
      icon: StickyNote,
      allowedRoles: ["director"],
      subItems: [
        {
          name: "الأهداف",
          href: "/director/notes/browse/goals",
          icon: Target,
        },
        {
          name: "المشاريع",
          href: "/director/notes/browse/projects",
          icon: Folder,
        },
        {
          name: "مدونات",
          href: "/director/notes/browse/blogs",
          icon: Book,
        },
        {
          name: "الأمور التعليمية والإدارية",
          href: "/director/notes/browse/educational_admin",
          icon: School,
        },
        {
          name: "المكافئات",
          href: "/director/notes/rewards",
          icon: Award,
        },
        {
          name: "المساعدات",
          href: "/director/notes/assistance",
          icon: HeartHandshake,
        },
      ],
    },
    { divider: true, allowedRoles: ["director"] },

    // المجموعة 2: معلومات المدرسة والطلاب والأساتذة
    {
      name: "معلومات المدرسة",
      href: "/school-info",
      icon: School,
      allowedRoles: ["director", "morning_school", "evening_school"],
    },
    {
      name: "الطلاب",
      icon: GraduationCap,
      allowedRoles: ["director", "morning_school", "evening_school"],
      subItems: [
        {
          name: "معلومات شخصية",
          href: "/students/personal-info",
          icon: UserCheck,
        },
        {
          name: "معلومات دراسية",
          href: "/students/academic-info",
          icon: BookOpen,
        },
        {
          name: "تحليلات الطلاب",
          href: "/students/analytics",
          icon: BarChart3,
        },
        {
          name: "معلومات مالية",
          href: "/finance?tab=students",
          icon: DollarSign,
          allowedRoles: ["director"],
        },
      ],
    },
    {
      name: "الأساتذة",
      href: "/teachers",
      icon: Users,
      allowedRoles: ["director", "morning_school", "evening_school"],
    },
    { divider: true, allowedRoles: ["director"] },

    // المجموعة 3: الصندوق وإدارة الجداول والنشاطات
    {
      name: "الصندوق",
      href: "/finance?tab=treasury",
      icon: Wallet,
      allowedRoles: ["director"],
    },
    {
      name: "إدارة الجداول",
      href: "/schedules",
      icon: CalendarDays,
      allowedRoles: [
        "director",
        "morning_school",
        "evening_school",
        "morning_supervisor",
        "evening_supervisor",
      ],
    },
    {
      name: "النشاطات",
      href: "/activities",
      icon: Trophy,
      allowedRoles: ["director"],
    },
    { divider: true, allowedRoles: ["director"] },

    // المجموعة 4: السنوات الدراسية وإدارة تسجيل الدخول
    {
      name: "السنوات الدراسية",
      href: "/academic-years",
      icon: Calendar,
      allowedRoles: ["director", "morning_school", "evening_school", "finance"],
    },
    {
      name: "إدارة تسجيل الدخول",
      href: "/user-management",
      icon: Key,
      allowedRoles: ["director"],
    },
    // Settings (normal page link - last)
    {
      name: "الإعدادات",
      href: "/settings",
      icon: Settings,
    },
  ];

  // Filter navigation items based on user role
  const navItems = allNavItems
    .filter((item) => {
      if (!item.allowedRoles) return true; // If no roles specified, show to all
      return authState.user && item.allowedRoles.includes(authState.user.role);
    })
    .map((item) => {
      // Filter sub-items based on user role if they have allowedRoles
      if ("subItems" in item && item.subItems) {
        return {
          ...item,
          subItems: item.subItems.filter((subItem) => {
            if (!("allowedRoles" in subItem) || !subItem.allowedRoles)
              return true;
            return (
              authState.user &&
              Array.isArray((subItem as any).allowedRoles) &&
              (subItem as any).allowedRoles.includes(authState.user.role)
            );
          }),
        };
      }
      return item;
    });

  return (
    <div
      className={`h-full flex flex-col relative bg-card rounded-2xl shadow-lg overflow-hidden border border-border ${!isResizing ? "transition-all duration-300 ease-in-out" : ""}`}
      style={{ width: `${actualWidth}px` }}
      dir="rtl"
    >
      {/* Resize Handle */}
      <div
        className="absolute top-0 left-0 w-1 h-full cursor-ew-resize hover:bg-primary/20 transition-colors z-40"
        onMouseDown={handleMouseDown}
      />

      {/* Toggle Button - Inside Sidebar */}
      <div className="absolute top-3 left-3 z-50">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg bg-muted hover:bg-muted-foreground/10 border border-border transition-all duration-200"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <PanelLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Logo */}
      <div
        className={`flex items-center justify-center px-4 transition-all duration-300 ease-in-out ${isCollapsed ? "h-20 pt-12" : "h-24 pt-6 pb-4"}`}
      >
        {!showText ? (
          <img src="/icon.png" alt="DAS Logo" className="w-12 h-12" />
        ) : (
          <div className="flex flex-col items-center w-full space-y-2">
            <img src="/icon.png" alt="DAS Logo" className="w-12 h-12" />
            <div className="text-sm font-semibold text-foreground text-center">
              Educore
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
        {navItems.map((item, index) => {
          // Handle dividers
          if ("divider" in item && item.divider) {
            return (
              <div key={`divider-${index}`} className="py-2">
                <div className="border-t border-border/50"></div>
              </div>
            );
          }

          const Icon = item.icon;
          const hasSubItems =
            "subItems" in item && item.subItems && item.subItems.length > 0;
          const isExpanded = expandedSections.includes(item.name);
          const isActiveSection =
            hasSubItems &&
            item.subItems?.some(
              (subItem) =>
                location.pathname === subItem.href ||
                location.pathname.startsWith(subItem.href),
            );

          if (hasSubItems) {
            const isParentActive =
              "href" in item && location.pathname === item.href;
            return (
              <div key={item.name}>
                <div className="relative">
                  {"href" in item ? (
                    <NavLink
                      to={item.href}
                      className={({ isActive }) =>
                        `w-full flex items-center ${showText ? "justify-between" : "justify-center"} px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ease-in-out ${
                          isActive || isActiveSection
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted"
                        }`
                      }
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {showText && (
                          <span className="font-medium">{item.name}</span>
                        )}
                      </div>
                    </NavLink>
                  ) : (
                    <button
                      onClick={() => toggleSection(item.name)}
                      className={`w-full flex items-center ${showText ? "justify-between" : "justify-center"} px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ease-in-out ${
                        isActiveSection
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {showText && (
                          <span className="font-medium">{item.name}</span>
                        )}
                      </div>
                      {showText && (
                        <ChevronRight
                          className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      )}
                    </button>
                  )}
                </div>
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{
                    maxHeight: isExpanded && showText ? "500px" : "0px",
                  }}
                >
                  {showText && item.subItems && (
                    <div className="mt-1.5 space-y-1 pr-6 rtl:pr-0 rtl:pl-6">
                      {item.subItems.map((subItem) => {
                        const SubIcon = subItem.icon;
                        return (
                          <NavLink
                            key={subItem.name}
                            to={subItem.href}
                            className={({ isActive }) =>
                              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ease-in-out ${
                                isActive
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              }`
                            }
                          >
                            <SubIcon className="h-4 w-4 flex-shrink-0" />
                            <span>{subItem.name}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={() => {
                // For finance pages, check full URL including query params
                const currentPath = location.pathname + location.search;
                const isActive =
                  currentPath === item.href ||
                  (item.href.includes("?") &&
                    currentPath.startsWith(item.href));

                return `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ease-in-out ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                } ${!showText ? "justify-center" : ""}`;
              }}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {showText && <span className="font-medium">{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User Section & Logout */}
      <div className="border-t border-border mt-auto">
        <div className="p-4">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="w-full transition-all duration-200 hover:opacity-80"
          >
            {!showText ? (
              <div className="flex items-center justify-center">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground text-base font-semibold">
                    {authState.user?.username?.[0]?.toUpperCase() || "م"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted hover:bg-muted/80 cursor-pointer">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground text-base font-semibold">
                    {authState.user?.username?.[0]?.toUpperCase() || "م"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {authState.user?.username || "مستخدم"}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {getRoleLabel(authState.user?.role || "")}
                  </p>
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Logout Button */}
        <div className="px-4 pb-4">
          <button
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-destructive hover:bg-destructive/10 ${
              !showText ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {showText && <span className="font-medium">تسجيل الخروج</span>}
          </button>
        </div>
      </div>

      {/* User Profile Modal */}
      <UserProfileModal
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
      />
    </div>
  );
};

export { Sidebar };
