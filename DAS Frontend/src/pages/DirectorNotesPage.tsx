import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, FolderOpen, Target, Briefcase, BookOpen,
  GraduationCap, Award, Heart, Search, Plus, ChevronRight, SlidersHorizontal, X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { directorApi } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';

interface CategoryInfo {
  category: string;
  display_name: string;
  total_files: number;
  total_folders: number;
}

const DirectorNotesPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // Filters - matching search results page
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Static categories - no backend API calls, just display
  const categories = [
    { category: 'goals', display_name: 'الأهداف', description: 'إدارة الأهداف والخطط' },
    { category: 'projects', display_name: 'المشاريع', description: 'تتبع المشاريع والمبادرات' },
    { category: 'blogs', display_name: 'مدونات', description: 'كتابة المدونات والمقالات' },
    { category: 'educational_admin', display_name: 'الأمور التعليمية والإدارية', description: 'الشؤون التعليمية والإدارية' },
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'goals':
        return <Target className="h-6 w-6 text-primary" />;
      case 'projects':
        return <Briefcase className="h-6 w-6 text-primary" />;
      case 'blogs':
        return <BookOpen className="h-6 w-6 text-accent" />;
      case 'educational_admin':
        return <GraduationCap className="h-6 w-6 text-secondary" />;
      default:
        return <FileText className="h-6 w-6 text-gray-500" />;
    }
  };

  const handleCategoryClick = (category: string) => {
    navigate(`/director/notes/browse/${category}`);
  };

  const handleRewardsClick = () => {
    navigate('/director/notes/rewards');
  };

  const handleAssistanceClick = () => {
    navigate('/director/notes/assistance');
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length >= 3) {
      const params = new URLSearchParams({ q: searchQuery });

      // Add type filter
      if (selectedType !== 'all') {
        params.append('type', selectedType);
      }

      // Add category filter
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }

      // Add date filters
      if (dateFrom) {
        params.append('dateFrom', dateFrom);
      }
      if (dateTo) {
        params.append('dateTo', dateTo);
      }

      navigate(`/director/notes/search?${params.toString()}`);
    } else {
      toast({
        title: 'تنبيه',
        description: 'يجب إدخال 3 أحرف على الأقل للبحث',
        variant: 'default',
      });
    }
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          ملاحظات المدير
        </h1>
        <p className="text-muted-foreground mt-1">إدارة الملاحظات والمشاريع والأهداف</p>
      </div>

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="بحث في الملاحظات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 ml-2" />
              بحث
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
              <SheetContent side="left" dir="rtl">
                <SheetHeader>
                  <SheetTitle>تصفية النتائج</SheetTitle>
                  <SheetDescription>
                    اختر الفلاتر لتضييق نطاق البحث
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  {/* Type Filter */}
                  <div className="space-y-2">
                    <Label>نوع السجل</Label>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر النوع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="note">ملاحظات</SelectItem>
                        <SelectItem value="reward">مكافآت</SelectItem>
                        <SelectItem value="assistance">مساعدات</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category Filter (only for notes) */}
                  {(selectedType === 'all' || selectedType === 'note') && (
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
                    <Button onClick={() => setFilterOpen(false)} className="flex-1">
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
        </CardContent>
      </Card>

      {/* Categories Grid - 2 Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {categories.map((cat) => (
          <Card
            key={cat.category}
            className="cursor-pointer hover:shadow-md transition-shadow duration-200"
            onClick={() => handleCategoryClick(cat.category)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getCategoryIcon(cat.category)}
                  <div>
                    <CardTitle className="text-xl">{cat.display_name}</CardTitle>
                    <CardDescription className="mt-1">
                      {cat.description}
                    </CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCategoryClick(cat.category);
                }}
                className="w-full"
              >
                <FolderOpen className="h-4 w-4 ml-2" />
                فتح المجلد
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rewards and Assistance Section - 2 Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rewards Card */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={handleRewardsClick}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="h-6 w-6 text-accent" />
                <div>
                  <CardTitle className="text-xl">المكافئات</CardTitle>
                  <CardDescription className="mt-1">
                    إدارة مكافئات الطلاب والمعلمين
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRewardsClick();
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4 ml-2" />
              عرض المكافئات
            </Button>
          </CardContent>
        </Card>

        {/* Assistance Card */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={handleAssistanceClick}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Heart className="h-6 w-6 text-destructive" />
                <div>
                  <CardTitle className="text-xl">المساعدات</CardTitle>
                  <CardDescription className="mt-1">
                    تسجيل المساعدات والدعم المقدم
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAssistanceClick();
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4 ml-2" />
              عرض المساعدات
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DirectorNotesPage;

