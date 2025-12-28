/**
 * HistoryCard Component - Comprehensive history tracking display
 * Features: Infinite scroll, statistics, filters, details modal, real-time updates
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { historyApi } from "@/services/api";
import {
  HistoryLog,
  HistoryStatistics,
  HistoryFilters,
  ACTION_TYPE_LABELS,
  ACTION_CATEGORY_LABELS,
  ENTITY_TYPE_LABELS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  USER_ROLE_LABELS,
  FIELD_NAME_LABELS,
  formatClassName,
} from "@/types/history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/ui/date-input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  History,
  Filter,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Sun,
  Moon,
  DollarSign,
  Shield,
  Settings,
  Target,
  Calendar,
  User,
  Clock,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

// Icon mapping
const actionIcons: Record<string, React.ReactNode> = {
  create: <PlusCircle className="w-4 h-4" />,
  update: <Edit className="w-4 h-4" />,
  delete: <Trash2 className="w-4 h-4" />,
  activate: <CheckCircle className="w-4 h-4" />,
  deactivate: <XCircle className="w-4 h-4" />,
};

const categoryIcons: Record<string, React.ReactNode> = {
  morning: <Sun className="w-4 h-4" />,
  evening: <Moon className="w-4 h-4" />,
  finance: <DollarSign className="w-4 h-4" />,
  director: <Shield className="w-4 h-4" />,
  system: <Settings className="w-4 h-4" />,
  activity: <Target className="w-4 h-4" />,
};

const statsBadgeClasses =
  "gap-1 bg-secondary/10 text-secondary border border-secondary/30 dark:bg-secondary/20 dark:text-secondary-foreground dark:border-secondary/40";

export const HistoryCard: React.FC = () => {
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [statistics, setStatistics] = useState<HistoryStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<HistoryLog | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filters
  const [filters, setFilters] = useState<HistoryFilters>({
    skip: 0,
    limit: 20,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const observerTarget = useRef<HTMLDivElement>(null);

  // Fetch history
  const fetchHistory = useCallback(
    async (reset: boolean = false) => {
      if (loading || (!hasMore && !reset)) return;

      setLoading(true);
      try {
        const skip = reset ? 0 : filters.skip || 0;
        const response = await historyApi.getHistory({
          ...filters,
          skip,
          search_query: searchQuery || undefined,
        });

        if (response.data) {
          if (reset) {
            setHistory(response.data.items);
            setPage(0);
          } else {
            setHistory((prev) => [...prev, ...response.data!.items]);
          }
          setHasMore(response.data.has_more);
          setFilters((prev) => ({
            ...prev,
            skip: skip + response.data!.items.length,
          }));
        }
      } catch (error) {

      } finally {
        setLoading(false);
      }
    },
    [filters, searchQuery, loading, hasMore]
  );

  // Fetch statistics
  const fetchStatistics = useCallback(async () => {
    try {
      const response = await historyApi.getStatistics();
      if (response.data) {
        setStatistics(response.data);
      }
    } catch (error) {

    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchHistory(true);
    fetchStatistics();
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchHistory(false);
        }
      },
      { threshold: 0.5 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, fetchHistory]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchHistory(true);
      fetchStatistics();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchHistory, fetchStatistics]);

  // Apply filters
  const applyFilters = () => {
    setFilters((prev) => ({ ...prev, skip: 0 }));
    fetchHistory(true);
    setFiltersOpen(false);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({ skip: 0, limit: 20 });
    setSearchQuery("");
    fetchHistory(true);
  };

  // Format date in Arabic
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy HH:mm", { locale: ar });
    } catch {
      return dateString;
    }
  };

  // Get severity badge class
  const getSeverityClass = (severity: string) => {
    return SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
  };

  // Render changes in metadata
  const renderChanges = (metadata: any) => {
    if (!metadata?.changes) return null;

    return (
      <div className="mt-2 space-y-1">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          التغييرات:
        </p>
        {Object.entries(metadata.changes).map(
          ([field, change]: [string, any]) => (
            <div
              key={field}
              className="text-sm text-gray-600 dark:text-gray-400 mr-4"
            >
              <span className="font-medium">
                {FIELD_NAME_LABELS[field] || field}
              </span>:{" "}
              <span className="text-red-600 dark:text-red-400">
                {String(change.old)}
              </span>
              {" ← "}
              <span className="text-green-600 dark:text-green-400">
                {String(change.new)}
              </span>
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            سجل النشاطات
          </CardTitle>

          <div className="flex gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <Input
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchHistory(true)}
                className="pr-9 w-48"
              />
            </div>

            {/* Filters */}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Filter className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>تصفية السجل</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  {/* Date range */}
                  <DateInput
                    label="من تاريخ"
                    value={filters.start_date}
                    onChange={(date) =>
                      setFilters((prev) => ({
                        ...prev,
                        start_date: date,
                      }))
                    }
                    placeholder="اختر تاريخ البداية"
                  />
                  <DateInput
                    label="إلى تاريخ"
                    value={filters.end_date}
                    onChange={(date) =>
                      setFilters((prev) => ({
                        ...prev,
                        end_date: date,
                      }))
                    }
                    placeholder="اختر تاريخ النهاية"
                  />

                  {/* Severity */}
                  <div>
                    <label className="text-sm font-medium">الأهمية</label>
                    <select
                      value={filters.severity || ""}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          severity: e.target.value || undefined,
                        }))
                      }
                      className="w-full border rounded-md p-2"
                    >
                      <option value="">الكل</option>
                      <option value="info">معلومات</option>
                      <option value="warning">تحذير</option>
                      <option value="critical">حرج</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={applyFilters} className="flex-1">
                      تطبيق
                    </Button>
                    <Button
                      onClick={clearFilters}
                      variant="outline"
                      className="flex-1"
                    >
                      مسح
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="flex gap-3 mt-3 flex-wrap">
            <Badge variant="outline" className={statsBadgeClasses}>
              <Calendar className="w-3 h-3" />
              اليوم: {statistics.actions_today}
            </Badge>
            <Badge variant="outline" className={statsBadgeClasses}>
              <Calendar className="w-3 h-3" />
              هذا الأسبوع: {statistics.actions_week}
            </Badge>
            <Badge variant="outline" className={statsBadgeClasses}>
              <Calendar className="w-3 h-3" />
              هذا الشهر: {statistics.actions_month}
            </Badge>
            {statistics.most_active_user && (
              <Badge variant="outline" className={statsBadgeClasses}>
                <User className="w-3 h-3" />
                الأكثر نشاطاً: {statistics.most_active_user}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto pr-2 space-y-2">
          {history.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <History className="w-12 h-12 mb-2 opacity-20" />
              <p>لا توجد نشاطات</p>
            </div>
          ) : (
            <>
              {history.map((log) => (
                <div
                  key={log.id}
                  onClick={() => {
                    setSelectedLog(log);
                    setDetailsOpen(true);
                  }}
                  className={`
                    border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md
                    ${getSeverityClass(log.severity)}
                  `}
                >
                  <div className="flex items-start gap-2">
                    {/* Icon */}
                    <div className="mt-0.5">
                      {categoryIcons[log.action_category] || (
                        <AlertCircle className="w-4 h-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {log.entity_type === 'class' ? formatClassName(log.description) : log.description}
                        </span>
                        {actionIcons[log.action_type]}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.user_name} ({USER_ROLE_LABELS[log.user_role || ''] || log.user_role})
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(log.timestamp)}
                        </span>
                      </div>

                      {/* Quick preview of changes */}
                      {log.meta_data?.changes &&
                        Object.keys(log.meta_data.changes).length > 0 && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            تم تغيير {Object.keys(log.meta_data.changes).length}{" "}
                            حقل
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator & intersection observer target */}
              <div ref={observerTarget} className="flex justify-center py-4">
                {loading && (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                )}
                {!hasMore && history.length > 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    لا توجد نشاطات إضافية
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>

      {/* Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل النشاط</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              {/* Main info */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  {categoryIcons[selectedLog.action_category]}
                  <h3 className="font-semibold text-lg dark:text-gray-100">
                    {selectedLog.entity_type === 'class' ? formatClassName(selectedLog.description) : selectedLog.description}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      النوع:
                    </span>{" "}
                    <Badge>
                      {ACTION_TYPE_LABELS[selectedLog.action_type] ||
                        selectedLog.action_type}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      الفئة:
                    </span>{" "}
                    <Badge>
                      {ACTION_CATEGORY_LABELS[selectedLog.action_category] ||
                        selectedLog.action_category}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      الكيان:
                    </span>{" "}
                    <span className="dark:text-gray-300">
                      {ENTITY_TYPE_LABELS[selectedLog.entity_type] ||
                        selectedLog.entity_type}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      الأهمية:
                    </span>{" "}
                    <Badge className={getSeverityClass(selectedLog.severity)}>
                      {SEVERITY_LABELS[selectedLog.severity] || selectedLog.severity}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">
                      المستخدم:
                    </span>{" "}
                    <span className="dark:text-gray-300">
                      {selectedLog.user_name} ({USER_ROLE_LABELS[selectedLog.user_role || ''] || selectedLog.user_role})
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">
                      التاريخ:
                    </span>{" "}
                    <span className="dark:text-gray-300">
                      {formatDate(selectedLog.timestamp)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Changes */}
              {selectedLog.meta_data && renderChanges(selectedLog.meta_data)}

              {/* Additional metadata */}
              {selectedLog.meta_data &&
                Object.keys(selectedLog.meta_data).length > 0 && (
                  <details className="border rounded-lg p-3 dark:border-gray-700">
                    <summary className="cursor-pointer font-medium dark:text-gray-300">
                      بيانات إضافية
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-800 dark:text-gray-300 p-2 rounded overflow-x-auto">
                      {JSON.stringify(selectedLog.meta_data, null, 2)}
                    </pre>
                  </details>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
