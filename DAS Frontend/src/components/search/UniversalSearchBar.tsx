import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X, Filter, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  UniversalSearchResult, 
  GroupedSearchResults, 
  SearchFilters,
  CATEGORY_NAMES 
} from '@/types/search';
import { searchApi, classesApi, schedulesApi, activitiesApi, directorApi, financeApi, financeManagerApi, academicYearsApi } from '@/services/api';
import { SearchResults } from './SearchResults';
import { FilterPanel } from './FilterPanel';
import { StudentNavigationPopup } from './StudentNavigationPopup';

interface UniversalSearchBarProps {
  className?: string;
  placeholder?: string;
  onNavigate?: () => void;
}

export const UniversalSearchBar: React.FC<UniversalSearchBarProps> = ({
  className = '',
  placeholder = 'بحث...',
  onNavigate
}) => {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showStudentPopup, setShowStudentPopup] = useState(false);
  const [selectedStudentData, setSelectedStudentData] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<UniversalSearchResult[]>([]);
  const [groupedResults, setGroupedResults] = useState<GroupedSearchResults>({});
  const [filters, setFilters] = useState<SearchFilters>({});
  const [totalResults, setTotalResults] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { state: authState } = useAuth();

  // Hardcoded pages with role filtering
  const getFilteredPages = useCallback(() => {
    const userRole = authState.user?.role || '';
    
    // This configuration is intentionally aligned with Sidebar navigation (Sidebar.tsx)
    // so that every visible page for each role is also searchable, and hidden pages
    // for that role do not appear in search results.
    const allPages = [
      // لوحة التحكم / Dashboard
      {
        name: 'لوحة التحكم',
        route: '/dashboard',
        roles: ['director', 'morning_school', 'evening_school', 'finance'],
        tags: [
          'لوحة التحكم', 'الصفحة الرئيسية', 'الرئيسية', 'داشبورد', 'dashboard',
          'إدارة المدرسة', 'نظام الإدارة', 'لوحة المدير', 'لوحة المراقبة'
        ]
      },

      // الصفحة اليومية
      {
        name: 'الصفحة اليومية',
        route: '/daily',
        roles: ['director', 'morning_school', 'evening_school'],
        tags: [
          'الصفحة اليومية', 'اليومي', 'التحضير اليومي', 'الحضور اليومي',
          'الدوام اليومي', 'سجل اليوم', 'يوميات المدرسة'
        ]
      },

      // ملاحظات المدير - الصفحة الرئيسية للملاحظات
      {
        name: 'ملاحظات المدير',
        route: '/director/notes',
        roles: ['director'],
        tags: [
          'ملاحظات المدير', 'مذكرات المدير', 'دفتر الملاحظات', 'المدير',
          'ملاحظات', 'إدارة الملاحظات', 'دفتر المدير'
        ]
      },

      // ملاحظات المدير - الأهداف
      {
        name: 'أهداف المدير',
        route: '/director/notes/browse/goals',
        roles: ['director'],
        tags: [
          'الأهداف', 'أهداف المدير', 'اهداف', 'هدف', 'خطة', 'خطط',
          'الخطة السنوية', 'خطة المدير', 'الخطط الإستراتيجية'
        ]
      },

      // ملاحظات المدير - المشاريع
      {
        name: 'مشاريع المدير',
        route: '/director/notes/browse/projects',
        roles: ['director'],
        tags: [
          'المشاريع', 'مشاريع', 'مشروع', 'مشاريع المدير', 'البرامج',
          'برامج المدرسة', 'خطط المشاريع'
        ]
      },

      // ملاحظات المدير - المدونات
      {
        name: 'مدونات المدير',
        route: '/director/notes/browse/blogs',
        roles: ['director'],
        tags: [
          'مدونات', 'مدونات المدير', 'مقالات', 'مقال', 'كتابات',
          'يوميات المدير', 'المدونة', 'blog'
        ]
      },

      // ملاحظات المدير - الأمور التعليمية والإدارية
      {
        name: 'الأمور التعليمية والإدارية',
        route: '/director/notes/browse/educational_admin',
        roles: ['director'],
        tags: [
          'الأمور التعليمية والإدارية', 'الأمور الإدارية', 'الادارية', 'التعليمية',
          'إدارة تعليمية', 'ملفات إدارية', 'ملفات تعليمية'
        ]
      },

      // ملاحظات المدير - المكافئات
      {
        name: 'المكافئات',
        route: '/director/notes/rewards',
        roles: ['director'],
        tags: [
          'المكافئات', 'المكافآت', 'مكافأة', 'مكافئات', 'مكافات',
          'جوائز', 'تحفيز', 'حوافز', 'مكافآت الطلاب', 'مكافآت المعلمين'
        ]
      },

      // ملاحظات المدير - المساعدات
      {
        name: 'المساعدات',
        route: '/director/notes/assistance',
        roles: ['director'],
        tags: [
          'المساعدات', 'مساعدات', 'دعم', 'مساعدة', 'اعانات', 'إعانات',
          'مساعدات الطلاب', 'مساعدات اجتماعية'
        ]
      },

      // معلومات المدرسة
      {
        name: 'معلومات المدرسة',
        route: '/school-info',
        roles: ['director', 'morning_school', 'evening_school'],
        tags: [
          'معلومات المدرسة', 'بيانات المدرسة', 'المدرسة', 'اعدادات المدرسة',
          'إدارة المدرسة', 'معلومات الصفوف', 'الصفوف', 'المدارس'
        ]
      },

      // الطلاب - معلومات شخصية
      {
        name: 'معلومات شخصية للطلاب',
        route: '/students/personal-info',
        roles: ['director', 'morning_school', 'evening_school'],
        tags: [
          'معلومات شخصية', 'معلومات الطلاب', 'الطلاب', 'الطالب', 'بيانات الطلاب',
          'معلومات فردية', 'الملف الشخصي للطالب', 'ادارة الطلاب', 'إدارة الطلاب'
        ]
      },

      // الطلاب - معلومات دراسية
      {
        name: 'معلومات دراسية للطلاب',
        route: '/students/academic-info',
        roles: ['director', 'morning_school', 'evening_school'],
        tags: [
          'معلومات دراسية', 'العلامات', 'الدرجات', 'السجل الدراسي',
          'نتائج الطلاب', 'التحصيل الدراسي', 'درجات الطلاب', 'السجل الاكاديمي'
        ]
      },

      // الطلاب - تحليلات
      {
        name: 'تحليلات الطلاب',
        route: '/students/analytics',
        roles: ['director', 'morning_school', 'evening_school'],
        tags: [
          'تحليلات الطلاب', 'تحليل الطلاب', 'إحصائيات الطلاب', 'تقارير الطلاب',
          'إحصائيات', 'تحليلات', 'تقارير دراسية', 'تحليل النتائج'
        ]
      },

      // الطلاب - معلومات مالية (من منظور المدير)
      {
        name: 'معلومات مالية للطلاب',
        route: '/finance?tab=students',
        roles: ['director'],
        tags: [
          'معلومات مالية للطلاب', 'مالية الطلاب', 'رسوم الطلاب', 'الأقساط',
          'الاقساط', 'الرسوم', 'المتأخرات', 'الديون', 'دفعات الطلاب'
        ]
      },

      // الأساتذة / المعلمين
      {
        name: 'الأساتذة',
        route: '/teachers',
        roles: ['director', 'morning_school', 'evening_school'],
        tags: [
          'الأساتذة', 'المعلمين', 'المعلمون', 'المدرسين', 'مدرسين',
          'إدارة المعلمين', 'ادارة المعلمين', 'إدارة الأساتذة', 'ادارة الاساتذة',
          'المعلم', 'الاستاذ', 'اساتذة', 'معلمين'
        ]
      },

      // الصندوق
      {
        name: 'الصندوق',
        route: '/finance?tab=treasury',
        roles: ['director', 'finance'],
        tags: [
          'الصندوق', 'المالية', 'الخزينة', 'الخزنة', 'النقدية',
          'صندوق المدرسة', 'إدارة الصندوق', 'treasury'
        ]
      },

      // إدارة الجداول
      {
        name: 'إدارة الجداول',
        route: '/schedules',
        roles: ['director', 'morning_school', 'evening_school', 'morning_supervisor', 'evening_supervisor'],
        tags: [
          'إدارة الجداول', 'الجداول الدراسية', 'جدول الدروس', 'جدول الحصص',
          'الجداول', 'الجدول', 'جدول الصف', 'جدول الحصص اليومية'
        ]
      },

      // النشاطات
      {
        name: 'النشاطات',
        route: '/activities',
        roles: ['director'],
        tags: [
          'النشاطات', 'الانشطة', 'الأنشطة', 'نشاطات', 'نشاط', 'نشاط طلابي',
          'أنشطة مدرسية', 'أنشطة الطلاب', 'أنشطة المدرسة'
        ]
      },

      // السنوات الدراسية
      {
        name: 'السنوات الدراسية',
        route: '/academic-years',
        roles: ['director', 'morning_school', 'evening_school', 'finance'],
        tags: [
          'السنوات الدراسية', 'السنة الدراسية', 'سنة دراسية', 'عام دراسي',
          'سنوات الدراسة', 'إدارة السنوات الدراسية', 'ادارة السنوات الدراسية'
        ]
      },

      // إدارة تسجيل الدخول / المستخدمين
      {
        name: 'إدارة تسجيل الدخول',
        route: '/user-management',
        roles: ['director'],
        tags: [
          'إدارة تسجيل الدخول', 'ادارة تسجيل الدخول', 'إدارة المستخدمين',
          'ادارة المستخدمين', 'المستخدمين', 'حسابات المستخدمين',
          'صلاحيات المستخدمين', 'مستخدمين النظام'
        ]
      },

      // الإدارة المالية العامة (واجهة المالية الرئيسية)
      {
        name: 'الإدارة المالية',
        route: '/finance',
        roles: ['director', 'finance'],
        tags: [
          'الإدارة المالية', 'المالية', 'ادارة المالية', 'حسابات',
          'حسابات المدرسة', 'إدارة المال', 'النظام المالي', 'مالية المدرسة'
        ]
      },

      // مدير المالية - تبويب الطلاب
      {
        name: 'مالية الطلاب',
        route: '/finance?tab=students',
        roles: ['finance'],
        tags: [
          'مالية الطلاب', 'طلاب المالية', 'رسوم الطلاب', 'أقساط الطلاب',
          'اقساط الطلاب', 'حساب الطلاب', 'ديون الطلاب', 'متأخرات الطلاب'
        ]
      },
    ];

    return allPages
      .filter(page => page.roles.includes(userRole))
      .map(page => ({
        id: page.route,
        type: 'page' as const,
        title: page.name,
        subtitle: 'صفحة',
        category: 'Pages',
        url: page.route,
        relevance_score: 1.0,
        tags: page.tags,
        data: { route: page.route }
      }));
  }, [authState.user?.role]);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
        setShowFilters(false);
        setQuery('');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Group results by category
  const groupResultsByCategory = useCallback((results: UniversalSearchResult[]) => {
    const grouped: GroupedSearchResults = {};
    results.forEach(result => {
      const category = result.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(result);
    });
    return grouped;
  }, []);

  // Perform search with debounce
  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setGroupedResults({});
      setIsExpanded(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setIsExpanded(true); // Show dropdown immediately
      try {
        console.log('🔍 Searching for:', query);
        const academicYearId = parseInt(localStorage.getItem('selected_academic_year_id') || '0');
        const userRole = authState.user?.role || '';
        // Derive session type from user role
        let userSessionType: 'morning' | 'evening' | undefined;
        if (userRole === 'morning_school') {
          userSessionType = 'morning';
        } else if (userRole === 'evening_school') {
          userSessionType = 'evening';
        } else if (authState.user?.session_type) {
          // Fallback to session_type field if available
          userSessionType = authState.user.session_type;
        }
        
        // Determine session filter: 
        // - If filter panel has session_type set, use that
        // - Otherwise, director/admin sees all, others see only their session
        const sessionFilter = filters.session_type || (['director', 'admin'].includes(userRole) ? undefined : userSessionType);
        
        console.log('🔒 Session filter:', sessionFilter, '(Role:', userRole, ', Derived session:', userSessionType, ')');
        
        // Helper to check if a scope should be searched
        // If no scopes selected, search all. If scopes selected, only search those.
        const shouldSearchScope = (scope: string): boolean => {
          if (!filters.scopes || filters.scopes.length === 0) {
            return true; // No filter = search all
          }
          return filters.scopes.includes(scope as any);
        };
        
        console.log('🎯 Active scopes filter:', filters.scopes || 'ALL');
        
        // Parallel search across all entity types
        const searchPromises: Promise<any>[] = [];
        
        // 1. Students & Teachers (API search)
        let response;
        const searchStudents = shouldSearchScope('students');
        const searchTeachers = shouldSearchScope('teachers');
        
        try {
          console.log('Trying universal search... (students:', searchStudents, ', teachers:', searchTeachers, ')');
          response = await searchApi.universalSearch(query, {
            scope: 'all',
            mode: 'partial',
            filters: { 
              ...filters, 
              academic_year_id: academicYearId,
              session_type: sessionFilter as any
            },
            limit: 50
          });
          console.log('✅ Universal search response:', response);
        } catch (universalError) {
          console.warn('❌ Universal search failed, falling back to quick search:', universalError);
          response = await searchApi.quick(query, 50);
          console.log('✅ Quick search response:', response);
        }

        console.log('📊 Full response data:', JSON.stringify(response.data, null, 2));

        if (response.success && response.data) {
          let searchResults = response.data.results || [];
          
          // Filter API results based on scope settings
          if (filters.scopes && filters.scopes.length > 0) {
            searchResults = searchResults.filter((r: any) => {
              if (r.type === 'student') return searchStudents;
              if (r.type === 'teacher') return searchTeachers;
              return true; // Keep other types (will be filtered by their own sections)
            });
            console.log(`🎯 Filtered API results by scope: ${searchResults.length} remaining`);
          }
          
          // Handle quick search format (has nested current/former structure)
          if (!searchResults.length && (response.data.students || response.data.teachers)) {
            console.log('🔄 Converting quick search format...');
            
            // Extract students from nested structure
            let students: any[] = [];
            if (response.data.students) {
              const studentData = response.data.students;
              students = [
                ...(Array.isArray(studentData.current) ? studentData.current : []),
                ...(Array.isArray(studentData.former) ? studentData.former : [])
              ];
            }
            
            // Extract teachers from nested structure
            let teachers: any[] = [];
            if (response.data.teachers) {
              const teacherData = response.data.teachers;
              teachers = [
                ...(Array.isArray(teacherData.current) ? teacherData.current : []),
                ...(Array.isArray(teacherData.former) ? teacherData.former : [])
              ];
            }
            
            console.log(`Found ${students.length} students and ${teachers.length} teachers`);
            
            searchResults = [
              // Only include students if scope allows
              ...(searchStudents ? students.map((s: any) => ({
                id: s.id,
                type: 'student' as const,
                title: s.name || s.full_name,
                subtitle: (() => {
                  // Arabic labels for grade level and number
                  const gradeNumberToArabic: Record<number, string> = {
                    1: 'الأول',
                    2: 'الثاني',
                    3: 'الثالث',
                    4: 'الرابع',
                    5: 'الخامس',
                    6: 'السادس',
                    7: 'السابع',
                    8: 'الثامن',
                    9: 'التاسع',
                    10: 'العاشر',
                    11: 'الحادي عشر',
                    12: 'الثاني عشر',
                  };

                  const gradeLevelToArabic: Record<string, string> = {
                    primary: 'ابتدائي',
                    intermediate: 'إعدادي',
                    secondary: 'ثانوي',
                  };

                  const sessionTypeToArabic: Record<string, string> = {
                    morning: 'صباحي',
                    evening: 'مسائي',
                  };

                  const gradeNumber = s.grade_number || s.grade || 1;
                  const gradeName = gradeNumberToArabic[Number(gradeNumber)] || `${gradeNumber}`;
                  const levelKey = (s.grade_level || '').toString().toLowerCase();
                  const levelName = gradeLevelToArabic[levelKey] || s.grade_level || '';
                  const sessionName = sessionTypeToArabic[(s.session_type || '').toString().toLowerCase()] || '';

                  // Format: "الصف الأول ابتدائي - صباحي" (without section for now)
                  const base = levelName
                    ? `الصف ${gradeName} ${levelName}`
                    : `${s.grade || s.grade_level || ''}`.trim();

                  if (sessionName) {
                    return `${base} - ${sessionName}`;
                  }

                  return base;
                })(),
                category: 'Students',
                url: `/students/personal-info`,
                relevance_score: 1.0,
                data: s
              })) : []),
              // Only include teachers if scope allows
              ...(searchTeachers ? teachers.map((t: any) => ({
                id: t.id,
                type: 'teacher' as const,
                title: t.name || t.full_name,
                subtitle: t.subjects?.join(', ') || '',
                category: 'Teachers',
                url: `/teachers`,
                relevance_score: 1.0,
                data: t
              })) : [])
            ];
            
            console.log('Transformed API results:', searchResults);
          }

          // 2. Search Academic Years
          try {
            const yearsResponse = await academicYearsApi.getAll();
            if (yearsResponse.success && yearsResponse.data) {
              const matchingYears = yearsResponse.data
                .filter((year: any) => 
                  year.year_name?.includes(query)
                )
                .map((year: any) => {
                  // Show a special label only for the currently selected academic year
                  const isCurrentYear = year.id === academicYearId;
                  // In this system, the "default" academic year is represented by is_active
                  const isDefaultYear = !!year.is_active;

                  let subtitle: string | undefined;
                  if (isCurrentYear && isDefaultYear) {
                    // The year is both default and the one the user is currently in
                    subtitle = 'إفتراضية - السنة الحالية';
                  } else if (isCurrentYear) {
                    // Current but not default
                    subtitle = 'السنة الحالية';
                  } else if (isDefaultYear) {
                    // Default but not the current year
                    subtitle = 'إفتراضية';
                  } else {
                    // Other years: no extra label
                    subtitle = undefined;
                  }

                  return {
                    id: year.id,
                    type: 'academic_year' as const,
                    title: year.year_name,
                    subtitle,
                    category: 'Academic Years',
                    url: '/academic-years',
                    relevance_score: 0.95,
                    data: { ...year, isCurrentYear, isDefaultYear },
                    is_clickable: !isCurrentYear // Current year is not clickable
                  };
                });
              searchResults.push(...matchingYears);
              console.log(`📅 Found ${matchingYears.length} academic years`);
            }
          } catch (error) {
            console.warn('Academic years search failed:', error);
          }

          // 3. Search Classes (restricted to school management roles)
          if (['director', 'morning_school', 'evening_school'].includes(userRole) && shouldSearchScope('classes')) {
            try {
            const classesResponse = await classesApi.getAll({ 
              academic_year_id: academicYearId,
              session_type: sessionFilter
            });
            if (classesResponse.success && classesResponse.data) {
              // Helper to convert grade number to Arabic ordinal
              const gradeNumberToArabic: Record<number, string> = {
                1: 'الأول',
                2: 'الثاني',
                3: 'الثالث',
                4: 'الرابع',
                5: 'الخامس',
                6: 'السادس',
                7: 'السابع',
                8: 'الثامن',
                9: 'التاسع',
                10: 'العاشر',
                11: 'الحادي عشر',
                12: 'الثاني عشر'
              };
              
              // Helper to get educational level name
              const gradeLevelToArabic: Record<string, string> = {
                'primary': 'الابتدائي',
                'intermediate': 'الإعدادي',
                'secondary': 'الثانوي'
              };
              
              // Helper to format class name
              const formatClassName = (cls: any) => {
                if (cls.class_name) return cls.class_name;
                
                // Format as "الصف الأول الابتدائي" + section
                const gradeNumber = cls.grade_number || 1;
                const gradeName = gradeNumberToArabic[gradeNumber] || `${gradeNumber}`;
                const levelName = gradeLevelToArabic[cls.grade_level] || cls.grade_level;
                return `الصف ${gradeName} ${levelName} ${cls.section || ''}`.trim();
              };
              
              const matchingClasses = classesResponse.data
                .filter((cls: any) => {
                  const className = formatClassName(cls);
                  return className.toLowerCase().includes(query.toLowerCase()) ||
                         cls.section?.toLowerCase().includes(query.toLowerCase());
                })
                .map((cls: any) => {
                  const className = formatClassName(cls);
                  const gradeNumber = cls.grade_number || 1;
                  const gradeName = gradeNumberToArabic[gradeNumber] || `${gradeNumber}`;
                  const levelName = gradeLevelToArabic[cls.grade_level] || cls.grade_level;
                  
                  return {
                    id: cls.id,
                    type: 'class' as const,
                    title: className,
                    subtitle: `${levelName} - الشعبة ${cls.section || ''}`,
                    category: 'Classes',
                    url: `/school-info/edit-grade/${cls.id}`,
                    relevance_score: 0.9,
                    data: cls
                  };
                });
              searchResults.push(...matchingClasses);
              console.log(`📚 Found ${matchingClasses.length} classes`);
            }
            } catch (error) {
              console.warn('Classes search failed:', error);
            }
          }

          // 4. Search Schedules (restricted to school management roles)
          if (['director', 'morning_school', 'evening_school'].includes(userRole) && shouldSearchScope('schedules')) {
            try {
            const schedulesResponse = await schedulesApi.getAll({
              academic_year_id: academicYearId,
              session_type: sessionFilter
            });
            if (schedulesResponse.success && schedulesResponse.data) {
              const queryLower = query.toLowerCase();
              
              // Group schedules by class to avoid duplicates
              const schedulesByClass = new Map<string, any>();
              
              schedulesResponse.data.forEach((schedule: any) => {
                const key = `${schedule.class_id}-${schedule.section}`;
                if (!schedulesByClass.has(key)) {
                  schedulesByClass.set(key, schedule);
                }
              });
              
              const matchingSchedules = Array.from(schedulesByClass.values())
                .filter((schedule: any) => {
                  // Match on multiple fields
                  const searchableText = [
                    schedule.name,
                    schedule.class_name,
                    schedule.section,
                    schedule.grade_level,
                    `الصف ${schedule.grade_number}`,
                    `شعبة ${schedule.section}`,
                    schedule.session_type === 'morning' ? 'صباحي' : 'مسائي',
                    'جدول'
                  ].filter(Boolean).join(' ').toLowerCase();
                  
                  return searchableText.includes(queryLower);
                })
                .map((schedule: any) => ({
                  id: schedule.id,
                  type: 'schedule' as const,
                  title: schedule.name || `جدول ${schedule.class_name || 'الصف'}`,
                  subtitle: `${schedule.class_name || ''} - شعبة ${schedule.section || ''} - ${schedule.session_type === 'morning' ? 'صباحي' : 'مسائي'}`,
                  category: 'Schedules',
                  url: '/schedules',
                  relevance_score: 0.85,
                  data: schedule
                }));
              searchResults.push(...matchingSchedules);
              console.log(`📅 Found ${matchingSchedules.length} schedules`);
            }
            } catch (error) {
              console.warn('Schedules search failed:', error);
            }
          }

          // 5. Search Activities (restricted to management and supervisors)
          if (['director', 'morning_school', 'evening_school', 'morning_supervisor', 'evening_supervisor'].includes(userRole) && shouldSearchScope('activities')) {
            try {
            const activitiesResponse = await activitiesApi.getAll({
              academic_year_id: academicYearId,
              session_type: sessionFilter
            });
            if (activitiesResponse.success && activitiesResponse.data) {
              // خريطة بسيطة لتحويل أنواع النشاطات من إنجليزي إلى عربي
              const activityTypeLabels: Record<string, string> = {
                academic: 'نشاط أكاديمي',
              };

              const matchingActivities = activitiesResponse.data
                .filter((activity: any) => 
                  activity.name?.toLowerCase().includes(query.toLowerCase()) ||
                  activity.description?.toLowerCase().includes(query.toLowerCase())
                )
                .map((activity: any) => {
                  const rawType = activity.activity_type as string | undefined;
                  const translatedType = rawType ? (activityTypeLabels[rawType] || rawType) : undefined;

                  return {
                    id: activity.id,
                    type: 'activity' as const,
                    title: activity.name,
                    subtitle: translatedType || activity.description?.substring(0, 50) || '',
                    category: 'Activities',
                    url: '/activities',
                    relevance_score: 0.8,
                    data: activity
                  };
                });
              searchResults.push(...matchingActivities);
              console.log(`🎯 Found ${matchingActivities.length} activities`);
            }
            } catch (error) {
              console.warn('Activities search failed:', error);
            }
          }

          // 6. Search Director Notes (only for director)
          if (userRole === 'director' && shouldSearchScope('director_notes')) {
            try {
              const notesResponse = await directorApi.searchNotes(query, academicYearId);
              if (notesResponse.success && notesResponse.data?.results) {
                // Category name mapping
                const categoryNames: Record<string, string> = {
                  'goals': 'الأهداف',
                  'projects': 'المشاريع',
                  'blogs': 'مدونات',
                  'educational_admin': 'الأمور التعليمية والإدارية'
                };
                
                const matchingNotes = notesResponse.data.results.map((note: any) => {
                  const categoryName = categoryNames[note.folder_type] || note.folder_type;
                  const itemType = note.is_folder ? 'مجلد' : 'ملف';

                  return {
                    id: note.id,
                    type: 'director_note' as const,
                    title: note.title,
                    subtitle: `${categoryName} - ${itemType}`,
                    category: 'Director Notes',
                    // For files we still navigate directly to edit; for folders we handle in click handler
                    url: note.is_folder
                      ? `/director/notes/browse/${note.folder_type}`
                      : `/director/notes/edit/${note.id}`,
                    relevance_score: 0.75,
                    data: note,
                  };
                });
                searchResults.push(...matchingNotes);
                console.log(`📝 Found ${matchingNotes.length} director notes`);
              }
            } catch (error) {
              console.warn('Director notes search failed:', error);
            }
          }

          // 7. Search Finance Categories (if user is director or finance)
          if ((userRole === 'director' || userRole === 'finance') && shouldSearchScope('finance')) {
            try {
              const categoriesResponse = await financeApi.getCategories(true);
              if (categoriesResponse.success && categoriesResponse.data) {
                const matchingCategories = categoriesResponse.data
                  .filter((category: any) => 
                    category.name?.toLowerCase().includes(query.toLowerCase()) ||
                    category.category_type?.toLowerCase().includes(query.toLowerCase())
                  )
                  .map((category: any) => ({
                    id: category.id,
                    type: 'finance' as const,
                    title: category.name,
                    subtitle: category.category_type === 'income' ? 'دخل' : 'مصروف',
                    category: 'Finance',
                    url: '/finance',
                    relevance_score: 0.7,
                    data: category
                  }));
                searchResults.push(...matchingCategories);
                console.log(`💰 Found ${matchingCategories.length} finance categories`);
              }
            } catch (error) {
              console.warn('Finance categories search failed:', error);
            }
          }

          // 8. Search Finance Cards (if user is director or finance)
          if ((userRole === 'director' || userRole === 'finance') && shouldSearchScope('finance')) {
            try {
              const cardsResponse = await financeManagerApi.getFinanceCards({
                academic_year_id: academicYearId
              });
              if (cardsResponse.success && cardsResponse.data) {
                const matchingCards = cardsResponse.data
                  .filter((card: any) => 
                    card.card_name?.toLowerCase().includes(query.toLowerCase()) ||
                    card.category?.toLowerCase().includes(query.toLowerCase())
                  )
                  .map((card: any) => ({
                    id: card.id,
                    type: 'finance_card' as const,
                    title: card.card_name,
                    subtitle: card.card_type === 'income' ? 'كارد دخل' : 'كارد مصروف',
                    category: 'Finance Cards',
                    url: '/finance',
                    relevance_score: 0.75,
                    data: card
                  }));
                searchResults.push(...matchingCards);
                console.log(`💳 Found ${matchingCards.length} finance cards`);
              }
            } catch (error) {
              console.warn('Finance cards search failed:', error);
            }
          }

          // 9. Add filtered pages to results (if scope allows)
          if (shouldSearchScope('pages')) {
            const filteredPages = getFilteredPages();
            const queryLower = query.toLowerCase();
            const pageResults = filteredPages.filter(page => {
              const titleMatch = page.title.toLowerCase().includes(queryLower);
              const tags = Array.isArray(page.tags) ? page.tags : [];
              const tagsMatch = tags.some((tag: string) =>
                tag.toLowerCase().includes(queryLower)
              );
              return titleMatch || tagsMatch;
            });
            
            console.log(`📄 Found ${pageResults.length} matching pages`);
            searchResults = [...searchResults, ...pageResults];
          }

          // Filter out teachers for finance role
          if (userRole === 'finance') {
            searchResults = searchResults.filter(r => r.type !== 'teacher');
            console.log(`🔒 Finance role: Filtered out teachers. Remaining results: ${searchResults.length}`);
          }
          
          console.log(`✨ Final processed results (${searchResults.length}):`, searchResults);
          setResults(searchResults);
          setGroupedResults(groupResultsByCategory(searchResults));
          setTotalResults(response.data.total_results || searchResults.length);
          setSearchTime(response.data.search_time_ms || 0);
        } else {
          console.log('No results or unsuccessful response');
          setResults([]);
          setGroupedResults({});
          setTotalResults(0);
        }
      } catch (error: any) {
        console.error('Search error:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          query: query
        });
        
        // Don't show toast for every search error, just log it
        // Only show for network errors
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          toast({
            title: "خطأ في الاتصال",
            description: "تحقق من الاتصال بالخادم",
            variant: "destructive"
          });
        }
        
        setResults([]);
        setGroupedResults({});
        setTotalResults(0);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, filters, groupResultsByCategory, toast, getFilteredPages]);

  const handleResultClick = (result: UniversalSearchResult) => {
    // Check if result is clickable (for current academic year)
    if ((result as any).is_clickable === false) {
      return; // Don't handle click for non-clickable results
    }

    const userRole = authState.user?.role || '';
    const academicYearId = parseInt(localStorage.getItem('selected_academic_year_id') || '0');
    
    // Smart navigation based on result type and user role
    if (result.type === 'page') {
      // Special handling for school info page - pass academic year context
      if (result.url === '/school-info') {
        navigate('/school-info', {
          state: {
            academicYearId: academicYearId
          }
        });
      } else {
        // Navigate directly to other pages
        navigate(result.url);
      }
      
    } else if (result.type === 'student') {
      const studentData = result.data;
      
      console.log('=== Student Search Result Clicked ===');
      console.log('Result:', result);
      console.log('Student Data:', studentData);
      console.log('Grade Level:', studentData?.grade_level);
      console.log('Grade Number:', studentData?.grade_number);
      console.log('Section:', studentData?.section);
      
      // Finance role: Direct navigation to finance page (no popup)
      if (userRole === 'finance') {
        // Navigate directly with available data (finance users don't have permission to fetch full student data)
        navigate('/finance?tab=students', {
          state: {
            preselectedStudentId: result.id,
            openFinancePopup: true,
            studentData: studentData || { id: result.id, full_name: result.title }
          }
        });
        return;
      }
      
      // For other roles: Show navigation popup
      // If student data is incomplete, fetch it first
      if (!studentData?.grade_level || !studentData?.grade_number || !studentData?.section) {
        console.warn('⚠️ Student data incomplete, fetching full record...');
        toast({
          title: 'جاري تحميل بيانات الطالب...',
          description: 'يرجى الانتظار',
        });
        
        import('@/services/api').then(({ api }) => {
          api.students.getById(result.id).then((response: any) => {
            const fullStudent = response.data || response;
            console.log('✅ Fetched full student data:', fullStudent);
            
            // Store student data and show popup
            setSelectedStudentData({
              id: result.id,
              name: result.title,
              gradeLevel: fullStudent.grade_level,
              gradeNumber: fullStudent.grade_number,
              section: fullStudent.section,
              sessionType: fullStudent.session_type,
            });
            setShowStudentPopup(true);
          }).catch((error: any) => {
            console.error('❌ Failed to fetch student data:', error);
            toast({
              title: 'خطأ',
              description: 'فشل في تحميل بيانات الطالب',
              variant: 'destructive',
            });
          });
        });
      } else {
        // Data is complete, show popup
        setSelectedStudentData({
          id: result.id,
          name: result.title,
          gradeLevel: studentData.grade_level,
          gradeNumber: studentData.grade_number,
          section: studentData.section,
          sessionType: studentData.session_type,
        });
        setShowStudentPopup(true);
      }
      
    } else if (result.type === 'teacher') {
      // Navigate to teachers page with pre-selected teacher
      navigate('/teachers', {
        state: {
          preselectedTeacherId: result.id,
          teacherData: result.data
        }
      });
      
    } else if (result.type === 'class') {
      // Navigate directly to class edit page
      navigate(`/school-info/edit-grade/${result.id}`, {
        state: {
          classData: result.data,
          academicYearId: academicYearId
        }
      });
      
    } else if (result.type === 'academic_year') {
      // Select the academic year (same pattern as AcademicYearManagementPage)
      localStorage.setItem('selected_academic_year_id', result.id.toString());
      localStorage.setItem('selected_academic_year_name', result.title);
      
      // If this year is set as active/default
      if (result.data?.is_active) {
        localStorage.setItem('auto_open_academic_year', 'true');
      } else {
        localStorage.setItem('auto_open_academic_year', 'false');
      }
      
      // Dispatch event to notify other components (DesktopLayout, etc.)
      window.dispatchEvent(new Event('academicYearChanged'));
      
      // Show success toast
      toast({
        title: "تم تغيير السنة الدراسية",
        description: `تم التبديل إلى ${result.title}`,
      });
      
      // Close search
      setIsExpanded(false);
      setQuery('');
      
      // Navigate to dashboard (React Router will handle the navigation without hard reload)
      navigate('/dashboard');
      
    } else if (result.type === 'schedule') {
      // Navigate to schedules page with class selected and popup open
      const scheduleData = result.data;
      navigate('/schedules', {
        state: {
          preselectedClassId: scheduleData?.class_id,
          viewSchedule: true,
          scheduleData: scheduleData
        }
      });
      
    } else if (result.type === 'activity') {
      // Open activity popup
      navigate('/activities', {
        state: {
          preselectedActivityId: result.id,
          openActivityPopup: true,
          activityData: result.data
        }
      });
      
    } else if (result.type === 'director_note') {
      // Check if it's a folder or a file
      const isFolder = result.data?.is_folder;
      const folderType = result.data?.folder_type;
      
      console.log('📂 Director note clicked:', {
        result,
        isFolder,
        folderType,
        id: result.id,
        title: result.title,
        data: result.data
      });
      
      if (isFolder) {
        // Navigate to the category browse page with folder opened
        // Include optional parent folder metadata so breadcrumbs can show parent > child
        const parentFolderId = result.data?.parent_folder_id ?? null;
        const parentFolderTitle = result.data?.parent_folder_title ?? result.data?.parent_title ?? null;

        console.log('📂 Navigating to folder:', {
          path: `/director/notes/browse/${folderType}`,
          folderId: result.id,
          title: result.data?.title || result.title,
          parentFolderId,
          parentFolderTitle,
        });

        navigate(`/director/notes/browse/${folderType}`, {
          state: {
            folderId: result.id,
            folderData: {
              title: result.data?.title || result.title,
              parentFolderId,
              parentFolderTitle,
            },
          },
        });
      } else {
        // Navigate directly to the note/file edit page
        navigate(`/director/notes/edit/${result.id}`);
      }
      
    } else if (result.type === 'finance_card') {
      // Open finance page with card popup
      navigate('/finance', {
        state: {
          preselectedCardId: result.id,
          openCardPopup: true,
          cardData: result.data
        }
      });
      
    } else if (result.type === 'finance') {
      // Open finance page with category selected
      navigate('/finance', {
        state: {
          preselectedCategoryId: result.id,
          categoryData: result.data
        }
      });
      
    } else {
      // Default navigation
      navigate(result.url);
    }

    // Clear and close
    setQuery('');
    setIsExpanded(false);
    setShowFilters(false);
    onNavigate?.();
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setGroupedResults({});
    setIsExpanded(false);
    inputRef.current?.focus();
  };

  const handleFilterToggle = () => {
    setShowFilters(!showFilters);
  };

  const handleFilterChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };

  const handleInputClick = () => {
    if (query.length >= 1 && results.length > 0) {
      setIsExpanded(true);
    }
  };

  const handleStudentNavigation = (destination: 'personal' | 'academic' | 'finance' | 'analytics') => {
    if (!selectedStudentData) return;

    const { id, gradeLevel, gradeNumber, section, sessionType } = selectedStudentData;

    if (destination === 'personal') {
      navigate('/students/personal-info', {
        state: {
          preselected: {
            gradeLevel,
            gradeNumber,
            section,
            sessionType,
            studentId: id,
            openPopup: true
          }
        }
      });
    } else if (destination === 'academic') {
      navigate('/students/academic-info', {
        state: {
          preselected: {
            gradeLevel,
            gradeNumber,
            section,
            sessionType,
            studentId: id,
            scrollToStudent: true,
            highlightStudent: true
          }
        }
      });
    } else if (destination === 'analytics') {
      navigate('/students/analytics', {
        state: {
          preselected: {
            gradeLevel,
            gradeNumber,
            section,
            sessionType,
            studentId: id
          }
        }
      });
    } else if (destination === 'finance') {
      navigate('/finance?tab=students', {
        state: {
          preselectedStudentId: id,
          openFinancePopup: true,
          studentData: selectedStudentData
        }
      });
    }

    // Close search and reset
    setIsExpanded(false);
    setQuery('');
    setResults([]);
    if (onNavigate) onNavigate();
  };

  return (
    <>
      <div ref={searchRef} className={`relative w-full ${className}`}>
      {/* Search Bar - Single Expanding Container */}
      <div className={`relative transition-all duration-300 ease-in-out ${
        isExpanded 
          ? 'bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-[var(--shadow-elevation-2)] rounded-t-xl' 
          : 'bg-[hsl(var(--muted))]/60 border border-[hsl(var(--border))]/40 rounded-xl'
      }`}>
        {/* Search Input Field */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))] pointer-events-none z-10" />
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClick={handleInputClick}
            className={`pl-10 pr-20 h-9 text-sm border-0 transition-all ${
              isExpanded
                ? 'bg-transparent text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]'
                : 'bg-transparent text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/70'
            } focus-visible:ring-0 focus-visible:ring-offset-0`}
          />
          
          {/* Action Buttons */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 z-10">
            {isSearching && (
              <Loader2 className="h-4 w-4 text-[hsl(var(--muted-foreground))] animate-spin" />
            )}
            {query && !isSearching && (
              <button
                onClick={handleClear}
                className="p-1 rounded transition-colors text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                aria-label="مسح"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleFilterToggle}
              className={`p-1 rounded transition-colors ${
                showFilters || Object.keys(filters).length > 0
                  ? 'text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]/80'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
              aria-label="تصفية"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Expanded Results - Connected to Search Bar (Looks Like One Box) */}
      {isExpanded && (
        <div className="absolute top-[calc(100%-0.5rem)] left-0 right-0 pt-2 pb-0 bg-[hsl(var(--card))] border border-t-0 border-[hsl(var(--border))] rounded-b-xl shadow-[var(--shadow-elevation-3)] z-[90] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          {results.length > 0 ? (
            <>
              {/* Results Content */}
              <div className="overflow-y-auto max-h-[60vh]">
                <SearchResults
                  groupedResults={groupedResults}
                  onResultClick={handleResultClick}
                  query={query}
                />
              </div>
            </>
          ) : query.length > 0 && !isSearching ? (
            /* No Results Message */
            <div className="p-8 text-center">
              <div className="text-[hsl(var(--muted-foreground))] mb-2">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">لم يتم العثور على نتائج</p>
                <p className="text-xs mt-1">جرب كلمات بحث مختلفة أو قم بتعديل الفلاتر</p>
              </div>
            </div>
          ) : isSearching ? (
            /* Loading State */
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-[hsl(var(--muted-foreground))]" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">جاري البحث...</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Filter Panel Overlay */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onClose={() => setShowFilters(false)}
        />
      )}
    </div>

      {/* Student Navigation Popup */}
      <StudentNavigationPopup
        open={showStudentPopup}
        onClose={() => setShowStudentPopup(false)}
        studentName={selectedStudentData?.name || ''}
        userRole={authState.user?.role || ''}
        onNavigate={handleStudentNavigation}
      />
    </>
  );
};
