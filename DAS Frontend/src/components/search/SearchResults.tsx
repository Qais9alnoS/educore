import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap, Users, BookOpen, Clipboard,
  Sparkles, DollarSign, Calendar, FileText,
  File, ChevronRight, CreditCard, Folder
} from 'lucide-react';
import { UniversalSearchResult, GroupedSearchResults, CATEGORY_NAMES } from '@/types/search';

interface SearchResultsProps {
  groupedResults: GroupedSearchResults;
  onResultClick: (result: UniversalSearchResult) => void;
  query: string;
}

// Icon mapping for result types
const TYPE_ICONS: Record<string, React.ReactNode> = {
  'student': <GraduationCap className="h-5 w-5 text-blue-500" />,
  'teacher': <Users className="h-5 w-5 text-green-500" />,
  'class': <BookOpen className="h-5 w-5 text-purple-500" />,
  'subject': <Clipboard className="h-5 w-5 text-orange-500" />,
  'activity': <Sparkles className="h-5 w-5 text-pink-500" />,
  'finance': <DollarSign className="h-5 w-5 text-yellow-600" />,
  'finance_card': <CreditCard className="h-5 w-5 text-emerald-600" />,
  'schedule': <Calendar className="h-5 w-5 text-indigo-500" />,
  'director_note': <FileText className="h-5 w-5 text-red-500" />,
  'academic_year': <Calendar className="h-5 w-5 text-cyan-500" />,
  'page': <File className="h-5 w-5 text-gray-500" />
};

// Highlight matching text in result
const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;

  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export const SearchResults: React.FC<SearchResultsProps> = ({
  groupedResults,
  onResultClick,
  query
}) => {
  // Track how many items to display per category (for infinite scroll)
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const INITIAL_DISPLAY = 10;
  const LOAD_MORE_INCREMENT = 10;

  // Sort categories to show pages first, then others
  const sortedCategories = Object.keys(groupedResults).sort((a, b) => {
    if (a === 'Pages') return -1;
    if (b === 'Pages') return 1;
    return a.localeCompare(b, 'ar');
  });

  // Initialize visible counts when grouped results change
  useEffect(() => {
    const initialCounts: Record<string, number> = {};
    sortedCategories.forEach(category => {
      initialCounts[category] = INITIAL_DISPLAY;
    });
    setVisibleCounts(initialCounts);
  }, [JSON.stringify(sortedCategories)]);

  // Infinite scroll: Load more when scrolling near bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Load more items for all categories
          setVisibleCounts(prev => {
            const updated = { ...prev };
            sortedCategories.forEach(category => {
              const currentCount = prev[category] || INITIAL_DISPLAY;
              const totalItems = groupedResults[category]?.length || 0;
              if (currentCount < totalItems) {
                updated[category] = Math.min(currentCount + LOAD_MORE_INCREMENT, totalItems);
              }
            });
            return updated;
          });
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [sortedCategories, groupedResults]);

  if (sortedCategories.length === 0) {
    return null;
  }

  return (
    <div className="divide-y divide-[hsl(var(--border))]">
      {sortedCategories.map(category => {
        const categoryResults = groupedResults[category];
        const arabicName = CATEGORY_NAMES[category] || category;

        return (
          <div key={category} className="py-2">
            {/* Category Header */}
            <div className="px-4 py-2 bg-[hsl(var(--muted))]/50 sticky top-0 z-10">
              <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                {arabicName}
                <span className="mr-2 text-[hsl(var(--muted-foreground))]/70 font-normal">
                  ({categoryResults.length})
                </span>
              </h3>
            </div>

            {/* Category Results */}
            <div className="divide-y divide-[hsl(var(--border))]">
              {categoryResults.slice(0, visibleCounts[category] || INITIAL_DISPLAY).map((result) => {
                const isClickable = (result as any).is_clickable !== false;
                
                return (
                <div
                  key={`${result.type}-${result.id}`}
                  onClick={() => isClickable && onResultClick(result)}
                  className={`px-4 py-3 transition-colors ${
                    isClickable 
                      ? 'hover:bg-[hsl(var(--muted))]/40 cursor-pointer group' 
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {result.type === 'director_note' && (result as any).data?.is_folder ? (
                        <Folder className="h-5 w-5 text-red-500" />
                      ) : (
                        TYPE_ICONS[result.type] || TYPE_ICONS['page']
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                          {highlightText(result.title, query)}
                        </p>
                        {result.relevance_score > 0.9 && (
                          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                            تطابق عالي
                          </span>
                        )}
                      </div>

                      {/* Subtitle */}
                      {result.subtitle && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                          {highlightText(result.subtitle, query)}
                        </p>
                      )}

                      {/* Description */}
                      {result.description && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))]/70 mt-1 line-clamp-1">
                          {result.description}
                        </p>
                      )}

                      {/* Tags */}
                      {result.tags && result.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {result.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Arrow Icon */}
                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Invisible element to trigger infinite scroll */}
      <div ref={loadMoreRef} className="h-1" />
    </div>
  );
};
