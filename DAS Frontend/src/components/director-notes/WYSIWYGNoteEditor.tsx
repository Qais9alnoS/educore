import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Code, Quote, Link as LinkIcon, Minus,
  Save, ArrowLeft, Clock, Table, Trash2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { directorApi } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';

interface ContextMenu {
  show: boolean;
  x: number;
  y: number;
}

const WYSIWYGNoteEditor: React.FC = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ show: false, x: 0, y: 0 });

  useEffect(() => {
    if (fileId) {
      loadFile();
    }
  }, [fileId]);

  useEffect(() => {
    // Hide context menu when clicking outside
    const handleClick = () => setContextMenu({ ...contextMenu, show: false });
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const loadFile = async () => {
    if (!fileId) return;

    try {
      setLoading(true);
      const response = await directorApi.getFile(parseInt(fileId));

      if (response.success && response.data) {
        setTitle(response.data.title || '');
        setContent(response.data.content || '');
        setNoteDate(response.data.note_date || new Date().toISOString().split('T')[0]);

        // Set editor content
        if (editorRef.current) {
          editorRef.current.innerHTML = response.data.content || '';
        }
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
  };

  const handleSave = async (isAutoSave: boolean = false) => {
    if (!fileId) return;

    try {
      if (!isAutoSave) setSaving(true);

      const contentToSave = editorRef.current?.innerHTML || '';

      await directorApi.updateFile(
        parseInt(fileId),
        title,
        contentToSave,
        noteDate
      );

      setContent(contentToSave);
      setLastSaved(new Date());

      if (!isAutoSave) {
        toast({
          title: 'نجاح',
          description: 'تم حفظ التغييرات',
        });
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
      if (!isAutoSave) setSaving(false);
    }
  };

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const insertElement = (html: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    document.execCommand('insertHTML', false, html);
  };

  const insertTable = () => {
    const tableHtml = `
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <tbody>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; background-color: #f5f5f5;">العنوان 1</td>
      <td style="border: 1px solid #ccc; padding: 8px; background-color: #f5f5f5;">العنوان 2</td>
      <td style="border: 1px solid #ccc; padding: 8px; background-color: #f5f5f5;">العنوان 3</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px;">خلية 1</td>
      <td style="border: 1px solid #ccc; padding: 8px;">خلية 2</td>
      <td style="border: 1px solid #ccc; padding: 8px;">خلية 3</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px;">خلية 4</td>
      <td style="border: 1px solid #ccc; padding: 8px;">خلية 5</td>
      <td style="border: 1px solid #ccc; padding: 8px;">خلية 6</td>
    </tr>
  </tbody>
</table>
<p><br></p>
    `;
    insertElement(tableHtml);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();

    // Check if text is selected
    const selection = window.getSelection();
    if (!selection || selection.toString().length === 0) {
      return;
    }

    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const deleteTable = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;

    // Find the table element
    while (node && (node as Element).tagName !== 'TABLE') {
      node = node.parentNode;
    }

    if (node && (node as Element).tagName === 'TABLE') {
      (node as Element).remove();
    }

    setContextMenu({ ...contextMenu, show: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">تحرير الملاحظة</h1>
            {lastSaved && (
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <Clock className="h-3 w-3" />
                آخر حفظ: {lastSaved.toLocaleTimeString('ar-SA')}
              </p>
            )}
          </div>
        </div>
        <Button onClick={() => handleSave(false)} disabled={saving} size="lg">
          <Save className="h-4 w-4 ml-2" />
          {saving ? 'جارٍ الحفظ...' : 'حفظ'}
        </Button>
      </div>

      {/* Title and Date */}
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">العنوان</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان الملاحظة..."
              className="text-lg"
            />
          </div>
          <div className="space-y-2">
            <DateInput
              label="التاريخ"
              value={noteDate}
              onChange={(date) => setNoteDate(date)}
              placeholder="اختر التاريخ"
            />
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      <Card className="shadow-lg">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="border-b p-4 bg-gray-50 flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormat('bold')}
                title="غامق (Ctrl+B)"
                className="h-9 w-9 p-0"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormat('italic')}
                title="مائل (Ctrl+I)"
                className="h-9 w-9 p-0"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormat('strikeThrough')}
                title="يتوسطه خط"
                className="h-9 w-9 p-0"
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
            </div>

            <div className="w-px h-6 bg-gray-300"></div>

            <div className="flex gap-1 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormat('formatBlock', '<h1>')}
                title="عنوان كبير"
                className="h-9 w-9 p-0"
              >
                <Heading1 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormat('formatBlock', '<h2>')}
                title="عنوان متوسط"
                className="h-9 w-9 p-0"
              >
                <Heading2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormat('formatBlock', '<h3>')}
                title="عنوان صغير"
                className="h-9 w-9 p-0"
              >
                <Heading3 className="h-4 w-4" />
              </Button>
            </div>

            <div className="w-px h-6 bg-gray-300"></div>

            <div className="flex gap-1 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormat('insertUnorderedList')}
                title="قائمة نقطية"
                className="h-9 w-9 p-0"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormat('insertOrderedList')}
                title="قائمة مرقمة"
                className="h-9 w-9 p-0"
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </div>

            <div className="w-px h-6 bg-gray-300"></div>

            <div className="flex gap-1 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormat('formatBlock', '<blockquote>')}
                title="اقتباس"
                className="h-9 w-9 p-0"
              >
                <Quote className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormat('formatBlock', '<pre>')}
                title="كود"
                className="h-9 w-9 p-0"
              >
                <Code className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={insertTable}
                title="إدراج جدول"
                className="h-9 w-9 p-0"
              >
                <Table className="h-4 w-4" />
              </Button>
            </div>

            <div className="w-px h-6 bg-gray-300"></div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => applyFormat('insertHorizontalRule')}
              title="خط أفقي"
              className="h-9 w-9 p-0"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>

          {/* Editor Content Area */}
          <div
            ref={editorRef}
            contentEditable
            onContextMenu={handleContextMenu}
            suppressContentEditableWarning
            className="min-h-[600px] p-6 focus:outline-none overflow-auto leading-relaxed prose prose-sm max-w-none"
            style={{
              fontSize: '16px',
              lineHeight: '1.6',
            }}
            onInput={() => {
              // Optional: Update content state for tracking
            }}
          >
            {/* Content loaded from database */}
          </div>

          {/* Context Menu */}
          {contextMenu.show && (
            <div
              ref={contextMenuRef}
              className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50"
              style={{
                top: `${contextMenu.y}px`,
                left: `${contextMenu.x}px`,
              }}
            >
              <button
                onClick={() => {
                  applyFormat('bold');
                  setContextMenu({ ...contextMenu, show: false });
                }}
                className="w-full px-4 py-2 text-right text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Bold className="h-4 w-4" />
                غامق
              </button>
              <button
                onClick={() => {
                  applyFormat('italic');
                  setContextMenu({ ...contextMenu, show: false });
                }}
                className="w-full px-4 py-2 text-right text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Italic className="h-4 w-4" />
                مائل
              </button>
              <button
                onClick={() => {
                  applyFormat('strikeThrough');
                  setContextMenu({ ...contextMenu, show: false });
                }}
                className="w-full px-4 py-2 text-right text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Strikethrough className="h-4 w-4" />
                يتوسطه خط
              </button>
              <div className="border-t my-1"></div>
              <button
                onClick={() => {
                  applyFormat('formatBlock', '<h1>');
                  setContextMenu({ ...contextMenu, show: false });
                }}
                className="w-full px-4 py-2 text-right text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Heading1 className="h-4 w-4" />
                عنوان كبير
              </button>
              <button
                onClick={() => {
                  applyFormat('formatBlock', '<h2>');
                  setContextMenu({ ...contextMenu, show: false });
                }}
                className="w-full px-4 py-2 text-right text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Heading2 className="h-4 w-4" />
                عنوان متوسط
              </button>
              <div className="border-t my-1"></div>
              <button
                onClick={deleteTable}
                className="w-full px-4 py-2 text-right text-sm hover:bg-red-100 text-red-600 flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                حذف الجدول
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Bar */}
      <div className="mt-4 text-sm text-muted-foreground text-center px-4 py-2 bg-gray-50 rounded-lg">
        <span>يمكنك النقر بزر الماوس الأيمن لخيارات التنسيق | </span>
        <span>عدد الكلمات: {editorRef.current?.innerText.split(/\s+/).filter(w => w.length > 0).length || 0}</span>
      </div>
    </div>
  );
};

export default WYSIWYGNoteEditor;
