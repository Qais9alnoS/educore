/**
 * Universal Search Types - TypeScript interfaces for the universal search system
 */

export type SearchResultType =
  | 'student'
  | 'teacher'
  | 'class'
  | 'subject'
  | 'activity'
  | 'finance'
  | 'finance_card'
  | 'schedule'
  | 'director_note'
  | 'academic_year'
  | 'page';

export type SessionType = 'morning' | 'evening' | 'both';

export type SearchScope =
  | 'all'
  | 'students'
  | 'teachers'
  | 'classes'
  | 'subjects'
  | 'activities'
  | 'finance'
  | 'schedules'
  | 'director_notes'
  | 'pages';

export interface UniversalSearchResult {
  id: number;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  description?: string;
  relevance_score: number;
  url: string;
  category: string;
  tags: string[];
  data?: Record<string, any>;
  academic_year_id?: number;
  session_type?: SessionType;
  is_active?: boolean;
  is_clickable?: boolean; // Whether the result is clickable (e.g., current year is not clickable)
  created_at?: string;
  updated_at?: string;
}

export interface SearchFilters {
  academic_year_id?: number;
  session_type?: SessionType;
  date_from?: string;
  date_to?: string;
  scopes?: SearchScope[];
  include_inactive?: boolean;
  min_relevance_score?: number;
}

export interface UniversalSearchRequest {
  query: string;
  scope?: SearchScope;
  mode?: 'exact' | 'fuzzy' | 'partial';
  filters?: SearchFilters;
  skip?: number;
  limit?: number;
}

export interface UniversalSearchResponse {
  query: string;
  scope: SearchScope;
  mode: string;
  total_results: number;
  results: UniversalSearchResult[];
  search_time_ms: number;
  total_scanned: number;
  results_by_type: Record<string, number>;
  suggestions: string[];
  has_more: boolean;
  next_skip?: number;
  from_cache?: boolean;
}

export interface GroupedSearchResults {
  [category: string]: UniversalSearchResult[];
}

export interface SearchSuggestion {
  text: string;
  type: 'recent' | 'popular' | 'auto';
}

// Category mappings for organized display
export const CATEGORY_NAMES: Record<string, string> = {
  'Students': 'الطلاب',
  'Teachers': 'المعلمون',
  'Classes': 'الصفوف',
  'Subjects': 'المواد',
  'Activities': 'النشاطات',
  'Finance': 'المالية',
  'Finance Cards': 'البطاقات المالية',
  'Schedules': 'الجداول',
  'Director Notes': 'ملاحظات المدير',
  'Academic Years': 'السنوات الدراسية',
  'Pages': 'الصفحات'
};

// Type icons for visual representation
export const TYPE_ICONS: Record<SearchResultType, string> = {
  'student': '🎓',
  'teacher': '👨‍🏫',
  'class': '📚',
  'subject': '📖',
  'activity': '🎯',
  'finance': '💰',
  'finance_card': '💳',
  'schedule': '📅',
  'director_note': '📝',
  'academic_year': '📅',
  'page': '📄'
};

// Color schemes for categories
export const CATEGORY_COLORS: Record<string, string> = {
  'Students': 'blue',
  'Teachers': 'green',
  'Classes': 'purple',
  'Subjects': 'orange',
  'Activities': 'pink',
  'Finance': 'yellow',
  'Finance Cards': 'emerald',
  'Schedules': 'indigo',
  'Director Notes': 'red',
  'Academic Years': 'cyan',
  'Pages': 'gray'
};
