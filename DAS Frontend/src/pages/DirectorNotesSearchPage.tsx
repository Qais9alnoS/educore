import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Search, Filter, FileText, Award, Heart, Target,
  Briefcase, BookOpen, GraduationCap, Calendar, X, SlidersHorizontal, Folder
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { directorApi } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';

interface SearchResult {
  id: number;
  title: string;
  type: 'note' | 'reward' | 'assistance' | 'folder';
  category?: string;
  date: string;
  snippet?: string;
  amount?: number;
  recipient_name?: string;
  organization?: string;
  parent_folder_id?: number | null;
}

const DirectorNotesSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Filters
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const academicYearId = parseInt(localStorage.getItem('selected_academic_year_id') || '0');

  useEffect(() => {
    const query = searchParams.get('q');
    const typeParam = searchParams.get('type');

    if (typeParam) {
      setSelectedType(typeParam);
    }

    if (query && query.length >= 3) {
      setSearchQuery(query);
      performSearch(query);
    }
  }, [searchParams]);

  const performSearch = async (query: string) => {
    if (query.trim().length < 3) {
      toast({
        title: 'تنبيه',
        description: 'يجب إدخال 3 أحرف على الأقل للبحث',
        variant: 'default',
      });
      return;
    }

    setLoading(true);
    try {
      const allResults: SearchResult[] = [];

      // Search folders if type is 'all' or 'folder'
      if (selectedType === 'all' || selectedType === 'folder') {
        const categories = selectedCategory !== 'all' ? [selectedCategory] : ['goals', 'projects', 'blogs', 'educational_admin'];
        
        for (const category of categories) {
          try {
            const foldersResponse = await directorApi.listFolderContents(academicYearId, category);
            if (foldersResponse.success && foldersResponse.data) {
              const foldersList = foldersResponse.data as any[];
              const matchingFolders = foldersList
                .filter((folder: any) => folder.is_folder && folder.name?.toLowerCase().includes(query.toLowerCase()))
                .map((folder: any) => ({
                  id: folder.id,
                  title: folder.name,
                  type: 'folder' as const,
                  category: category,
                  date: folder.created_at || new Date().toISOString(),
                  parent_folder_id: folder.parent_folder_id,
                }));
              allResults.push(...matchingFolders);
            }
          } catch (e) {
            // Continue if folder search fails for a category
          }
        }
      }

      // Search markdown notes if type is 'all' or 'note'
      if (selectedType === 'all' || selectedType === 'note') {
        const notesResponse = await directorApi.searchNotes(
          query,
          academicYearId,
          selectedCategory !== 'all' ? selectedCategory : undefined
        );

        if (notesResponse.success && notesResponse.data) {
          const notesData = notesResponse.data as any;
          const notesList = notesData.results || notesData.data?.results || [];
          // Filter out folders from notes (only include actual notes)
          const notes = notesList
            .filter((note: any) => !note.is_folder)
            .map((note: any) => ({
              id: note.id,
              title: note.title,
              type: 'note' as const,
              category: note.category,
              date: note.note_date || note.updated_at,
              snippet: note.snippet,
            }));
          allResults.push(...notes);
        }
      }

      // Search rewards if type is 'all' or 'reward' (not academic year specific)
      if (selectedType === 'all' || selectedType === 'reward') {
        const rewardsResponse = await directorApi.getRewards(undefined, 0, 500);

        if (rewardsResponse.success && rewardsResponse.data) {
          const rewards = (rewardsResponse.data as any[])
            .filter((reward: any) =>
              reward.title?.toLowerCase().includes(query.toLowerCase()) ||
              reward.recipient_name?.toLowerCase().includes(query.toLowerCase()) ||
              reward.description?.toLowerCase().includes(query.toLowerCase())
            )
            .map((reward: any) => ({
              id: reward.id,
              title: reward.title,
              type: 'reward' as const,
              date: reward.reward_date,
              snippet: reward.description,
              amount: reward.amount,
              recipient_name: reward.recipient_name,
            }));
          allResults.push(...rewards);
        }
      }

      // Search assistance if type is 'all' or 'assistance' (not academic year specific)
      if (selectedType === 'all' || selectedType === 'assistance') {
        const assistanceResponse = await directorApi.getAssistanceRecords(undefined, 0, 500);

        if (assistanceResponse.success && assistanceResponse.data) {
          const assistance = (assistanceResponse.data as any[])
            .filter((record: any) =>
              record.title?.toLowerCase().includes(query.toLowerCase()) ||
              record.organization?.toLowerCase().includes(query.toLowerCase()) ||
              record.description?.toLowerCase().includes(query.toLowerCase())
            )
            .map((record: any) => ({
              id: record.id,
              title: record.title,
              type: 'assistance' as const,
              date: record.assistance_date,
              snippet: record.description,
              amount: record.amount,
              organization: record.organization,
            }));
          allResults.push(...assistance);
        }
      }

      // Apply date filters
      let filteredResults = allResults;
      if (dateFrom) {
        filteredResults = filteredResults.filter(r => r.date >= dateFrom);
      }
      if (dateTo) {
        filteredResults = filteredResults.filter(r => r.date <= dateTo);
      }

      // Sort by date (most recent first)
      filteredResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setResults(filteredResults);
    } catch (error) {

      toast({
        title: 'خطأ',
        description: 'فشل في البحث',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim().length >= 3) {
      setSearchParams({ q: searchQuery });
      performSearch(searchQuery);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'folder') {
      // Navigate to the folder browser with the folder's category and folder ID
      navigate(`/director/notes/browse/${result.category}?folder=${result.id}`);
    } else if (result.type === 'note') {
      navigate(`/director/notes/edit/${result.id}`);
    } else if (result.type === 'reward') {
      navigate('/director/notes/rewards');
    } else if (result.type === 'assistance') {
      navigate('/director/notes/assistance');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'folder':
        return <Folder className="h-5 w-5 text-amber-500" />;
      case 'note':
        return <FileText className="h-5 w-5 text-primary" />;
      case 'reward':
        return <Award className="h-5 w-5 text-accent" />;
      case 'assistance':
        return <Heart className="h-5 w-5 text-destructive" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'goals':
        return <Target className="h-4 w-4" />;
      case 'projects':
        return <Briefcase className="h-4 w-4" />;
      case 'blogs':
        return <BookOpen className="h-4 w-4" />;
      case 'educational_admin':
        return <GraduationCap className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      goals: 'الأهداف',
      projects: 'المشاريع',
      blogs: 'مدونات',
      educational_admin: 'الأمور التعليمية والإدارية',
    };
    return labels[category] || category;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      folder: 'مجلد',
      note: 'ملاحظة',
      reward: 'مكافأة',
      assistance: 'مساعدة',
    };
    return labels[type] || type;
  };

  const clearFilters = () => {
    setSelectedType('all');
    setSelectedCategory('all');
    setDateFrom('');
    setDateTo('');
  };

  const activeFiltersCount = [
    selectedType !== 'all',
    selectedCategory !== 'all',
    dateFrom,
    dateTo
  ].filter(Boolean).length;

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/director/notes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Search className="h-8 w-8 text-primary" />
            نتائج البحث
          </h1>
          <p className="text-muted-foreground mt-1">
            البحث عن: "{searchQuery}"
          </p>
        </div>
      </div>

      {/* Search Bar with Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="بحث في الملاحظات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 ml-2" />
              {loading ? 'جارٍ البحث...' : 'بحث'}
            </Button>
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative">
                  <SlidersHorizontal className="h-4 w-4 ml-2" />
                  تصفية
                  {activeFiltersCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" dir="rtl" className="[&>button]:hidden">
                <div className="space-y-6 mt-2">
                  {/* Type Filter */}
                  <div className="space-y-2">
                    <Label>نوع السجل</Label>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر النوع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="folder">مجلدات</SelectItem>
                        <SelectItem value="note">ملاحظات</SelectItem>
                        <SelectItem value="reward">مكافآت</SelectItem>
                        <SelectItem value="assistance">مساعدات</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category Filter (for notes and folders) */}
                  {(selectedType === 'all' || selectedType === 'note' || selectedType === 'folder') && (
                    <div className="space-y-2">
                      <Label>الفئة</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الفئة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          <SelectItem value="goals">الأهداف</SelectItem>
                          <SelectItem value="projects">المشاريع</SelectItem>
                          <SelectItem value="blogs">مدونات</SelectItem>
                          <SelectItem value="educational_admin">الأمور التعليمية والإدارية</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Date Range Filter */}
                  <DateInput
                    label="من تاريخ"
                    value={dateFrom}
                    onChange={(date) => setDateFrom(date)}
                    placeholder="اختر تاريخ البداية"
                  />

                  <DateInput
                    label="إلى تاريخ"
                    value={dateTo}
                    onChange={(date) => setDateTo(date)}
                    placeholder="اختر تاريخ النهاية"
                  />

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button onClick={() => { handleSearch(); setFilterOpen(false); }} className="flex-1">
                      تطبيق
                    </Button>
                    <Button variant="outline" onClick={clearFilters} className="flex-1">
                      <X className="h-4 w-4 ml-2" />
                      مسح
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Active Filters Display */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedType !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {getTypeLabel(selectedType)}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedType('all')}
                  />
                </Badge>
              )}
              {selectedCategory !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {getCategoryLabel(selectedCategory)}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedCategory('all')}
                  />
                </Badge>
              )}
              {dateFrom && (
                <Badge variant="secondary" className="gap-1">
                  من: {dateFrom}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setDateFrom('')}
                  />
                </Badge>
              )}
              {dateTo && (
                <Badge variant="secondary" className="gap-1">
                  إلى: {dateTo}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setDateTo('')}
                  />
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <div className="mb-4 text-muted-foreground">
            تم العثور على {results.length} نتيجة
          </div>

          {results.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-xl font-semibold mb-2">لا توجد نتائج</p>
                <p className="text-muted-foreground">حاول البحث بكلمات مختلفة أو تغيير الفلاتر</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {results.map((result) => (
                <Card
                  key={`${result.type}-${result.id}`}
                  className="cursor-pointer hover:shadow-lg transition-all duration-200"
                  onClick={() => handleResultClick(result)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getTypeIcon(result.type)}
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2">{result.title}</CardTitle>
                          {result.snippet && (
                            <CardDescription className="line-clamp-2">
                              {result.snippet}
                            </CardDescription>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <Badge variant="outline">
                              {getTypeLabel(result.type)}
                            </Badge>
                            {result.category && (
                              <Badge variant="secondary" className="gap-1">
                                {getCategoryIcon(result.category)}
                                {getCategoryLabel(result.category)}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(result.date).toLocaleDateString('ar-SA')}
                            </div>
                            {result.amount && (
                              <Badge variant="outline" className="text-green-500">
                                {result.amount.toLocaleString()} ل.س
                              </Badge>
                            )}
                            {result.recipient_name && (
                              <Badge variant="secondary">
                                {result.recipient_name}
                              </Badge>
                            )}
                            {result.organization && (
                              <Badge variant="secondary">
                                {result.organization}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DirectorNotesSearchPage;

