import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Folder, FileText, Plus, MoreVertical, Home, ChevronRight,
  ArrowLeft, Trash2, Edit2, Search
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { directorApi } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';

interface FolderItem {
  id: number;
  title: string;
  is_folder: boolean;
  note_date: string;
  file_path: string | null;
  parent_folder_id: number | null;
  created_at: string;
  updated_at: string;
}

interface BreadcrumbItem {
  id: number | null;
  name: string;
}

const NoteFolderBrowser: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [items, setItems] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize folder context from navigation state (Universal Search, Recent Folders, etc.)
  const locationState = location.state as { folderId?: number; openFolderId?: number; folderData?: any } | null;
  const initialFolderId = locationState?.folderId ?? locationState?.openFolderId ?? null;

  // Build initial breadcrumbs from navigation state if available.
  // Supports both single-level (folder only) and two-level (parent > folder) chains.
  const initialBreadcrumbs: BreadcrumbItem[] = (() => {
    if (!initialFolderId || !locationState?.folderData?.title) {
      return [];
    }

    const parentFolderId = locationState.folderData.parentFolderId as number | null | undefined;
    const parentFolderTitle = locationState.folderData.parentFolderTitle as string | null | undefined;

    if (parentFolderId && parentFolderTitle) {
      return [
        { id: parentFolderId, name: parentFolderTitle },
        { id: initialFolderId, name: locationState.folderData.title },
      ];
    }

    return [{ id: initialFolderId, name: locationState.folderData.title }];
  })();

  const [currentFolderId, setCurrentFolderId] = useState<number | null>(initialFolderId);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>(initialBreadcrumbs);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameItemId, setRenameItemId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number; isFolder: boolean } | null>(null);

  const academicYearId = parseInt(localStorage.getItem('selected_academic_year_id') || '0');

  const categoryNames: Record<string, string> = {
    'goals': 'الأهداف',
    'projects': 'المشاريع',
    'blogs': 'مدونات',
    'educational_admin': 'الأمور التعليمية والإدارية'
  };

  useEffect(() => {
    const state = location.state as { folderId?: number; openFolderId?: number; folderData?: any } | null;
    const targetFolderId = state?.folderId || state?.openFolderId;
    const folderData = state?.folderData;

    if (targetFolderId) {
      setCurrentFolderId(targetFolderId);

      // Build breadcrumb trail if we have folder data
      if (folderData?.title) {
        const parentFolderId = folderData.parentFolderId as number | null | undefined;
        const parentFolderTitle = folderData.parentFolderTitle as string | null | undefined;

        if (parentFolderId && parentFolderTitle) {
          setBreadcrumbs([
            { id: parentFolderId, name: parentFolderTitle },
            { id: targetFolderId, name: folderData.title },
          ]);
        } else {
          setBreadcrumbs([{ id: targetFolderId, name: folderData.title }]);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (category && academicYearId) {
      loadFolderContents();
    }
  }, [category, currentFolderId, academicYearId]);

  const loadFolderContents = async () => {
    if (!category) return;

    try {
      setLoading(true);
      const response = await directorApi.listFolderContents(
        academicYearId,
        category,
        currentFolderId
      );

      // Backend returns items directly in response.data, not nested
      if (response.success && response.data) {
        const responseData = response.data as any;
        setItems(responseData.items || []);
      }
    } catch (error) {

      toast({
        title: 'خطأ',
        description: 'فشل في تحميل المحتويات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !category) return;

    // Check if folder already exists
    const folderExists = items.some(
      item => item.is_folder && item.title.toLowerCase() === newFolderName.trim().toLowerCase()
    );

    if (folderExists) {
      toast({
        title: 'خطأ',
        description: 'يوجد مجلد بهذا الاسم بالفعل',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await directorApi.createFolder(
        academicYearId,
        category,
        newFolderName.trim(),
        currentFolderId
      );

      if (response.success) {
        toast({
          title: 'نجاح',
          description: 'تم إنشاء المجلد بنجاح',
        });
        setShowNewFolderDialog(false);
        setNewFolderName('');
        loadFolderContents();
      }
    } catch (error: any) {

      const errorMessage = error?.message?.includes('already exists')
        ? 'يوجد مجلد بهذا الاسم بالفعل'
        : 'فشل في إنشاء المجلد';
      toast({
        title: 'خطأ',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim() || !category) return;

    // Check if file already exists
    const fileName = newFileName.trim().endsWith('.md') ? newFileName.trim() : newFileName.trim() + '.md';
    const fileExists = items.some(
      item => !item.is_folder && (item.title.toLowerCase() === newFileName.trim().toLowerCase() ||
                                  item.title.toLowerCase() === fileName.toLowerCase())
    );

    if (fileExists) {
      toast({
        title: 'خطأ',
        description: 'يوجد ملف بهذا الاسم بالفعل',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await directorApi.createFile(
        academicYearId,
        category,
        newFileName.trim(),
        '', // Empty content initially
        new Date().toISOString().split('T')[0],
        currentFolderId
      );

      if (response.success && response.data) {
        toast({
          title: 'نجاح',
          description: 'تم إنشاء الملف بنجاح',
        });
        setShowNewFileDialog(false);
        setNewFileName('');
        // Navigate to the editor for the new file
        navigate(`/director/notes/edit/${response.data.file_id}`);
      }
    } catch (error: any) {

      const errorMessage = error?.message?.includes('already exists')
        ? 'يوجد ملف بهذا الاسم بالفعل'
        : 'فشل في إنشاء الملف';
      toast({
        title: 'خطأ',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteItem = (itemId: number, isFolder: boolean) => {
    setItemToDelete({ id: itemId, isFolder });
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.isFolder) {
        await directorApi.deleteFolder(itemToDelete.id);
      } else {
        await directorApi.deleteFile(itemToDelete.id);
      }

      toast({
        title: 'نجاح',
        description: `تم حذف ${itemToDelete.isFolder ? 'المجلد' : 'الملف'} بنجاح`,
      });
      loadFolderContents();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: `فشل حذف ${itemToDelete.isFolder ? 'المجلد' : 'الملف'}`,
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };
    } catch (error) {

      toast({
        title: 'خطأ',
        description: 'فشل في الحذف',
        variant: 'destructive',
      });
    }
  };

  const handleRenameClick = (item: FolderItem) => {
    setRenameItemId(item.id);
    setRenameValue(item.title);
    setShowRenameDialog(true);
  };

  const handleRenameSubmit = async () => {
    if (!renameItemId || !renameValue.trim()) return;

    try {
      await directorApi.renameFolder(renameItemId, renameValue.trim());

      toast({
        title: 'نجاح',
        description: 'تم تغيير الاسم بنجاح',
      });

      setShowRenameDialog(false);
      setRenameItemId(null);
      setRenameValue('');
      loadFolderContents();
    } catch (error) {

      toast({
        title: 'خطأ',
        description: 'فشل في تغيير الاسم',
        variant: 'destructive',
      });
    }
  };

  const handleItemClick = (item: FolderItem) => {
    if (item.is_folder) {
      setCurrentFolderId(item.id);
      setBreadcrumbs([...breadcrumbs, { id: item.id, name: item.title }]);
    } else {
      navigate(`/director/notes/edit/${item.id}`);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Root
      setCurrentFolderId(null);
      setBreadcrumbs([]);
    } else {
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(newBreadcrumbs);
      setCurrentFolderId(newBreadcrumbs[index].id);
    }
  };

  const handleBack = () => {
    if (breadcrumbs.length === 0) {
      navigate('/director/notes');
    } else if (breadcrumbs.length === 1) {
      setCurrentFolderId(null);
      setBreadcrumbs([]);
    } else {
      const newBreadcrumbs = breadcrumbs.slice(0, -1);
      setBreadcrumbs(newBreadcrumbs);
      setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir="rtl">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{categoryNames[category || ''] || category}</h1>
          <p className="text-muted-foreground">إدارة المجلدات والملفات</p>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleBreadcrumbClick(-1)}
          className="px-2"
        >
          <Home className="h-4 w-4 ml-1" />
          {categoryNames[category || '']}
        </Button>
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.id}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBreadcrumbClick(index)}
              className="px-2"
            >
              {crumb.name}
            </Button>
          </React.Fragment>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6">
        <Button onClick={() => setShowNewFolderDialog(true)}>
          <Plus className="h-4 w-4 ml-2" />
          مجلد جديد
        </Button>
        <Button variant="outline" onClick={() => setShowNewFileDialog(true)}>
          <Plus className="h-4 w-4 ml-2" />
          ملف جديد
        </Button>
      </div>

      {/* Items Grid */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>لا توجد ملفات أو مجلدات</p>
            <p className="text-sm mt-2">ابدأ بإنشاء مجلد أو ملف جديد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
              onClick={() => handleItemClick(item)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {item.is_folder ? (
                      <Folder className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    ) : (
                      <FileText className="h-6 w-6 text-muted-foreground flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{item.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.updated_at).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleRenameClick(item);
                      }}>
                        <Edit2 className="h-4 w-4 ml-2" />
                        إعادة تسمية
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item.id, item.is_folder);
                      }}>
                        <Trash2 className="h-4 w-4 ml-2" />
                        حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إنشاء مجلد جديد</DialogTitle>
            <DialogDescription>
              أدخل اسم المجلد الجديد
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">اسم المجلد</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="اسم المجلد..."
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreateFolder}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New File Dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إنشاء ملف جديد</DialogTitle>
            <DialogDescription>
              أدخل اسم الملف الجديد
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file-name">اسم الملف</Label>
              <Input
                id="file-name"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="اسم الملف..."
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFile()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFileDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreateFile}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إعادة تسمية</DialogTitle>
            <DialogDescription>
              أدخل الاسم الجديد
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-value">الاسم الجديد</Label>
              <Input
                id="rename-value"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="الاسم الجديد..."
                onKeyPress={(e) => e.key === 'Enter' && handleRenameSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleRenameSubmit}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`حذف ${itemToDelete?.isFolder ? 'المجلد' : 'الملف'}`}
        description={`هل أنت متأكد من حذف هذا ${itemToDelete?.isFolder ? 'المجلد' : 'الملف'}؟`}
        confirmText="حذف"
        cancelText="إلغاء"
        variant="destructive"
        onConfirm={confirmDeleteItem}
      />
    </div>
  );
};

export default NoteFolderBrowser;

