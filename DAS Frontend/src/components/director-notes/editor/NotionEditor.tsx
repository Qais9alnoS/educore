import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table as TableExtension } from '@tiptap/extension-table';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import Typography from '@tiptap/extension-typography';
import { Markdown } from 'tiptap-markdown';
import { EditorToolbar } from './EditorToolbar';
import { EditorContextMenu } from './EditorContextMenu';
import { TableControls } from './TableControls';
import { MarkdownTokensExtension } from './MarkdownTokensExtension';
import { cn } from '@/lib/utils';

interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
}

interface TableControlsPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface NotionEditorProps {
  initialContent?: string;
  placeholder?: string;
  isReadingMode?: boolean;
  onChange?: (markdown: string) => void;
  onWordCountChange?: (count: number) => void;
  className?: string;
  minHeight?: string;
}

export const NotionEditor: React.FC<NotionEditorProps> = ({
  initialContent = '',
  placeholder = 'ابدأ كتابة الملاحظة...',
  isReadingMode = false,
  onChange,
  onWordCountChange,
  className,
  minHeight = '500px',
}) => {
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const showTokensRef = useRef(!isReadingMode);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ open: false, x: 0, y: 0 });
  const [tableControls, setTableControls] = useState<TableControlsPosition | null>(null);
  const [isRTL, setIsRTL] = useState(true);

  // Detect text direction based on content
  const detectTextDirection = useCallback((text: string): boolean => {
    const arabicChars = text.match(/[\u0600-\u06FF]/g) || [];
    const latinChars = text.match(/[a-zA-Z]/g) || [];
    return arabicChars.length >= latinChars.length;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
          HTMLAttributes: { class: 'notion-bullet-list' },
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
          HTMLAttributes: { class: 'notion-ordered-list' },
        },
        listItem: {
          HTMLAttributes: { dir: 'auto' },
        },
        codeBlock: {
          HTMLAttributes: { class: 'notion-code-block' },
        },
        blockquote: {
          HTMLAttributes: { class: 'notion-blockquote' },
        },
        horizontalRule: {
          HTMLAttributes: { class: 'notion-hr' },
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      TableExtension.configure({
        resizable: true,
        HTMLAttributes: { class: 'notion-table' },
      }),
      TableRow.configure({
        HTMLAttributes: { class: 'notion-table-row' },
      }),
      TableHeader.configure({
        HTMLAttributes: { class: 'notion-table-header' },
      }),
      TableCell.configure({
        HTMLAttributes: { class: 'notion-table-cell' },
      }),
      Typography,
      Markdown.configure({
        html: false,
        breaks: true,
        transformCopiedText: true,
        transformPastedText: true,
      }),
      MarkdownTokensExtension.configure({
        getShowTokens: () => showTokensRef.current,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'notion-editor-content',
        spellcheck: 'true',
      },
    },
    content: initialContent,
    editable: !isReadingMode,
  });

  // Update tokens visibility and editability when reading mode changes
  useEffect(() => {
    showTokensRef.current = !isReadingMode;
    if (editor) {
      editor.setEditable(!isReadingMode);
      // Force re-render to update decorations
      editor.view.dispatch(editor.state.tr);
    }
  }, [editor, isReadingMode]);

  // Handle content changes
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      // Update text direction
      const text = editor.getText();
      const shouldBeRTL = detectTextDirection(text);
      setIsRTL(shouldBeRTL);

      // Update editor direction
      const editorElement = editor.view.dom;
      if (editorElement) {
        editorElement.dir = shouldBeRTL ? 'rtl' : 'ltr';
      }

      // Notify parent of content change
      if (onChange) {
        const markdown = (editor.storage as any).markdown?.getMarkdown() || '';
        onChange(markdown);
      }

      // Update word count
      if (onWordCountChange) {
        const words = text.split(/\s+/).filter((word) => word.length > 0).length;
        onWordCountChange(words);
      }

      // Update table controls position
      updateTableControls();
    };

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', updateTableControls);

    // Initial direction check
    handleUpdate();

    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', updateTableControls);
    };
  }, [editor, onChange, onWordCountChange, detectTextDirection]);

  // Update table controls position
  const updateTableControls = useCallback(() => {
    if (!editor || isReadingMode) {
      setTableControls(null);
      return;
    }

    const { from } = editor.state.selection;
    const domNode = editor.view.domAtPos(from).node as HTMLElement | null;
    const table = domNode?.closest?.('table') || domNode?.parentElement?.closest('table');
    const wrapper = editorWrapperRef.current;

    if (!table || !wrapper) {
      setTableControls(null);
      return;
    }

    const tableRect = table.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    setTableControls({
      top: tableRect.top - wrapperRect.top + wrapper.scrollTop,
      left: tableRect.left - wrapperRect.left + wrapper.scrollLeft,
      width: tableRect.width,
      height: tableRect.height,
    });
  }, [editor, isReadingMode]);

  // Handle scroll to update table controls
  useEffect(() => {
    const wrapper = editorWrapperRef.current;
    if (!wrapper) return;

    wrapper.addEventListener('scroll', updateTableControls);
    return () => wrapper.removeEventListener('scroll', updateTableControls);
  }, [updateTableControls]);

  // Context menu handlers
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setContextMenu({ open: true, x: event.clientX, y: event.clientY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, open: false }));
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      editor?.chain().focus().insertContent(text).run();
    } catch (error) {
      console.error('Failed to paste from clipboard:', error);
    }
  }, [editor]);

  // Set initial content when it changes externally
  useEffect(() => {
    if (editor && initialContent) {
      // Only set content if it's different from current content
      const currentMarkdown = (editor.storage as any).markdown?.getMarkdown() || '';
      if (currentMarkdown !== initialContent) {
        editor.commands.setContent(initialContent);
      }
    }
  }, [editor, initialContent]);

  // Expose editor methods
  const getMarkdown = useCallback((): string => {
    if (!editor) return '';
    return (editor.storage as any).markdown?.getMarkdown() || '';
  }, [editor]);

  const setContent = useCallback((content: string) => {
    editor?.commands.setContent(content);
  }, [editor]);

  // Word count
  const wordCount = useMemo(() => {
    if (!editor) return 0;
    const text = editor.getText();
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }, [editor?.getText()]);

  return (
    <div
      className={cn(
        'notion-editor-wrapper rounded-[var(--radius)] border border-border bg-card overflow-hidden',
        className
      )}
    >
      {/* Toolbar */}
      <EditorToolbar editor={editor} disabled={isReadingMode} />

      {/* Editor Content */}
      <div
        ref={editorWrapperRef}
        className="relative overflow-auto"
        style={{ minHeight }}
        onContextMenu={handleContextMenu}
      >
        <EditorContent
          editor={editor}
          className={cn(
            'notion-editor px-6 py-5',
            isReadingMode && 'notion-editor-reading',
            isRTL ? 'text-right' : 'text-left'
          )}
          dir={isRTL ? 'rtl' : 'ltr'}
        />

        {/* Table Controls */}
        <TableControls
          editor={editor}
          position={tableControls}
          disabled={isReadingMode}
        />
      </div>

      {/* Context Menu */}
      <EditorContextMenu
        editor={editor}
        contextMenu={contextMenu}
        onClose={handleCloseContextMenu}
        onPaste={handlePaste}
      />

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <span>Ctrl+B غامق | Ctrl+I مائل | Ctrl+Z تراجع</span>
        <span>عدد الكلمات: {wordCount}</span>
      </div>
    </div>
  );
};

// Export a hook to access editor instance
export const useNotionEditor = () => {
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  return editorRef;
};

export default NotionEditor;
