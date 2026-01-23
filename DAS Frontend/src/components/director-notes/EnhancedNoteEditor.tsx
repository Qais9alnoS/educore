import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit3, Eye, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { directorApi } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { NotionEditor } from './editor';

const EnhancedNoteEditor: React.FC = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<string>('');

  const [title, setTitle] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [initialContent, setInitialContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  // Load file content
  const loadFile = useCallback(async () => {
    if (!fileId) return;

    try {
      setLoading(true);
      const response = await directorApi.getFile(parseInt(fileId, 10));

      if (response.success && response.data) {
        const content = response.data.content || '';
        setTitle(response.data.title || '');
        setNoteDate(response.data.note_date || new Date().toISOString().split('T')[0]);
        setInitialContent(content);
        contentRef.current = content;
        setHasChanges(false);
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في تحميل الملف',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [fileId, toast]);

  // Save file
  const handleSave = useCallback(
    async (isAutoSave: boolean = false) => {
      if (!fileId) return;

      try {
        if (!isAutoSave) {
          setSaving(true);
        }

        const response = await directorApi.updateFile(
          parseInt(fileId, 10),
          title,
          contentRef.current,
          noteDate
        );

        if (response.success) {
          setLastSaved(new Date());
          setHasChanges(false);
          if (!isAutoSave) {
            toast({
              title: 'نجاح',
              description: 'تم حفظ التغييرات بنجاح',
            });
          }
        }
      } catch (error) {
        if (!isAutoSave) {
          toast({
            title: 'خطأ',
            description: 'فشل في حفظ التغييرات',
            variant: 'destructive',
          });
        }
      } finally {
        if (!isAutoSave) {
          setSaving(false);
        }
      }
    },
    [fileId, noteDate, title, toast]
  );

  // Schedule auto-save
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
    }

    autoSaveRef.current = setTimeout(() => {
      handleSave(true);
    }, 30000); // Auto-save after 30 seconds of inactivity
  }, [handleSave]);

  // Handle content change from editor
  const handleContentChange = useCallback(
    (markdown: string) => {
      contentRef.current = markdown;
      setHasChanges(true);
      scheduleAutoSave();
    },
    [scheduleAutoSave]
  );

  // Handle word count change
  const handleWordCountChange = useCallback((count: number) => {
    setWordCount(count);
  }, []);

  // Load file on mount
  useEffect(() => {
    if (fileId) {
      loadFile();
    }
  }, [fileId, loadFile]);

  // Save before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasChanges) {
        handleSave(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleSave, hasChanges]);

  // Cleanup auto-save timer
  useEffect(() => {
    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto p-4 md:p-6 max-w-5xl">
          {/* Top Row - Navigation and Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="rounded-xl"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                  محرر الملاحظات
                  {hasChanges && (
                    <span className="text-sm text-destructive font-normal">
                      (غير محفوظ)
                    </span>
                  )}
                </h1>
                {lastSaved && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    آخر حفظ: {lastSaved.toLocaleTimeString('ar-SA')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReadingMode((prev) => !prev)}
                className="gap-2 rounded-xl"
              >
                {isReadingMode ? (
                  <>
                    <Edit3 className="h-4 w-4" />
                    وضع الكتابة
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    وضع القراءة
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleSave(false)}
                disabled={saving || !hasChanges}
                size="sm"
                className="gap-2 rounded-xl"
              >
                <Save className="h-4 w-4" />
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </Button>
            </div>
          </div>

          {/* Metadata Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/40 p-4 rounded-[var(--radius)] border border-border">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="title">العنوان</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setHasChanges(true);
                  scheduleAutoSave();
                }}
                placeholder="عنوان الملاحظة..."
                className="text-lg"
                disabled={isReadingMode}
              />
            </div>
            <div className="space-y-2">
              <DateInput
                label="التاريخ"
                value={noteDate}
                onChange={(date) => {
                  setNoteDate(date);
                  setHasChanges(true);
                  scheduleAutoSave();
                }}
                placeholder="اختر التاريخ"
                disabled={isReadingMode}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="container mx-auto p-4 md:p-6 max-w-5xl">
        <NotionEditor
          initialContent={initialContent}
          placeholder="ابدأ كتابة الملاحظة..."
          isReadingMode={isReadingMode}
          onChange={handleContentChange}
          onWordCountChange={handleWordCountChange}
          minHeight="560px"
        />
      </div>
    </div>
  );
};

export default EnhancedNoteEditor;
