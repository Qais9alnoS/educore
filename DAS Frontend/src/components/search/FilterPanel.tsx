import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { SearchFilters, SearchScope } from '@/types/search';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

interface FilterPanelProps {
  filters: SearchFilters;
  onFilterChange: (filters: SearchFilters) => void;
  onClose: () => void;
}

// Role-based scope permissions
const ROLE_SCOPES: Record<string, SearchScope[]> = {
  director: ['students', 'teachers', 'classes', 'subjects', 'activities', 'finance', 'schedules', 'director_notes', 'pages'],
  morning_school: ['students', 'teachers', 'classes', 'subjects', 'activities', 'schedules', 'pages'],
  evening_school: ['students', 'teachers', 'classes', 'subjects', 'activities', 'schedules', 'pages'],
  finance: ['students', 'finance', 'pages'],
  morning_supervisor: ['students', 'activities', 'pages'],
  evening_supervisor: ['students', 'activities', 'pages'],
};

// All available search scopes with labels
const ALL_SEARCH_SCOPES: { value: SearchScope; label: string }[] = [
  { value: 'students', label: 'الطلاب' },
  { value: 'teachers', label: 'المعلمون' },
  { value: 'classes', label: 'الصفوف' },
  { value: 'subjects', label: 'المواد' },
  { value: 'activities', label: 'النشاطات' },
  { value: 'finance', label: 'المالية' },
  { value: 'schedules', label: 'الجداول' },
  { value: 'director_notes', label: 'ملاحظات المدير' },
  { value: 'pages', label: 'الصفحات' }
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  onClose
}) => {
  const { state: authState } = useAuth();
  const userRole = authState.user?.role || 'director';
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);
  const [isClosing, setIsClosing] = useState(false);

  // Get allowed scopes for current user role
  const allowedScopes = useMemo(() => {
    const roleScopes = ROLE_SCOPES[userRole] || ROLE_SCOPES.director;
    return ALL_SEARCH_SCOPES.filter(scope => roleScopes.includes(scope.value));
  }, [userRole]);

  // Check if user can change session type (director and admin can see both)
  const canChangeSessionType = userRole === 'director' || userRole === 'admin';

  // Smooth close handler
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200); // Match animation duration
  }, [onClose]);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleSessionTypeChange = (value: string) => {
    const newFilters = {
      ...localFilters,
      session_type: value === 'all' ? undefined : (value as 'morning' | 'evening')
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDateChange = (key: 'date_from' | 'date_to', date: Date | undefined) => {
    const newFilters = {
      ...localFilters,
      [key]: date ? format(date, 'yyyy-MM-dd') : undefined
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleIncludeInactiveChange = (checked: boolean) => {
    const newFilters = {
      ...localFilters,
      include_inactive: checked
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleScopeToggle = (scope: SearchScope) => {
    const currentScopes = localFilters.scopes || [];
    const newScopes = currentScopes.includes(scope)
      ? currentScopes.filter(s => s !== scope)
      : [...currentScopes, scope];

    const newFilters = {
      ...localFilters,
      scopes: newScopes.length > 0 ? newScopes : undefined
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClearFilters = () => {
    const emptyFilters: SearchFilters = {};
    setLocalFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const activeFilterCount = Object.keys(localFilters).filter(key => {
    const value = localFilters[key as keyof SearchFilters];
    return value !== undefined && value !== null &&
           (Array.isArray(value) ? value.length > 0 : true);
  }).length;

  return (
    <>
      {/* Backdrop - starts below titlebar */}
      <div
        className={`fixed inset-0 top-12 bg-black/30 dark:bg-black/50 z-[60] transition-opacity duration-200 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
      />

      {/* Filter Panel - positioned below titlebar */}
      <div
        className={`fixed left-0 top-12 bottom-0 w-80 bg-[hsl(var(--background))] border-r border-[hsl(var(--border))] shadow-[var(--shadow-elevation-3)] z-[70] transition-transform duration-200 ease-out ${
          isClosing ? '-translate-x-full' : 'translate-x-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          {/* Filters Content - no header */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Session Type Filter - Only for Director */}
            {canChangeSessionType && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[hsl(var(--foreground))]">
                  نوع الفترة
                </Label>
                <Select
                  value={localFilters.session_type || 'all'}
                  onValueChange={handleSessionTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="morning">صباحي</SelectItem>
                    <SelectItem value="evening">مسائي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Range Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-[hsl(var(--foreground))] flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                نطاق التاريخ
              </Label>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="date-from" className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">
                    من
                  </Label>
                  <DatePicker
                    value={localFilters.date_from ? new Date(localFilters.date_from) : undefined}
                    onChange={(date) => handleDateChange('date_from', date)}
                    placeholder="dd/mm/yyyy"
                  />
                </div>

                <div>
                  <Label htmlFor="date-to" className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">
                    إلى
                  </Label>
                  <DatePicker
                    value={localFilters.date_to ? new Date(localFilters.date_to) : undefined}
                    onChange={(date) => handleDateChange('date_to', date)}
                    placeholder="dd/mm/yyyy"
                  />
                </div>
              </div>
            </div>

            {/* Include Inactive Toggle */}
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <Checkbox
                id="include-inactive"
                checked={localFilters.include_inactive || false}
                onCheckedChange={handleIncludeInactiveChange}
              />
              <Label
                htmlFor="include-inactive"
                className="text-sm font-medium text-[hsl(var(--foreground))] cursor-pointer"
              >
                تضمين العناصر غير النشطة
              </Label>
            </div>

            {/* Search Scopes - Role-specific */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-[hsl(var(--foreground))]">
                البحث في
              </Label>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {localFilters.scopes?.length ? `محدد: ${localFilters.scopes.length}` : 'الكل (بدون تحديد)'}
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allowedScopes.map((scope) => (
                  <div key={scope.value} className="flex items-center space-x-2 rtl:space-x-reverse">
                    <Checkbox
                      id={`scope-${scope.value}`}
                      checked={localFilters.scopes?.includes(scope.value) || false}
                      onCheckedChange={() => handleScopeToggle(scope.value)}
                    />
                    <Label
                      htmlFor={`scope-${scope.value}`}
                      className="text-sm text-[hsl(var(--foreground))] cursor-pointer flex-1"
                    >
                      {scope.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-[hsl(var(--border))] flex gap-2">
            <Button
              onClick={() => { onClose(); }}
              className="flex-1"
            >
              تطبيق
            </Button>
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="flex-1"
              disabled={activeFilterCount === 0}
            >
              مسح
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
