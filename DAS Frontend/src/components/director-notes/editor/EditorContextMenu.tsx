import React, { useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Table,
  Copy,
  Scissors,
  Clipboard,
  Code2,
  Trash2,
  Plus,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
}

interface EditorContextMenuProps {
  editor: Editor | null;
  contextMenu: ContextMenuState;
  onClose: () => void;
  onPaste: () => void;
}

interface MenuItemProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  onClick,
  icon,
  label,
  shortcut,
  disabled,
  destructive,
}) => (
  <button
    type="button"
    disabled={disabled}
    className={cn(
      'flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors',
      'hover:bg-muted focus:bg-muted focus:outline-none',
      disabled && 'opacity-50 cursor-not-allowed',
      destructive ? 'text-destructive hover:text-destructive' : 'text-foreground'
    )}
    onClick={onClick}
  >
    <span className="flex-shrink-0">{icon}</span>
    <span className="flex-1 text-right">{label}</span>
    {shortcut && (
      <span className="text-xs text-muted-foreground">{shortcut}</span>
    )}
  </button>
);

const MenuDivider: React.FC = () => (
  <div className="h-px bg-border my-1" />
);

const MenuSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div>
    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
      {title}
    </div>
    {children}
  </div>
);

export const EditorContextMenu: React.FC<EditorContextMenuProps> = ({
  editor,
  contextMenu,
  onClose,
  onPaste,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (contextMenu.open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu.open, onClose]);

  if (!contextMenu.open || !editor) return null;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const isInTable = editor.isActive('table');

  // Calculate position to keep menu in viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: contextMenu.y,
    left: contextMenu.x,
    zIndex: 50,
  };

  return (
    <div
      ref={menuRef}
      className="min-w-[220px] rounded-[var(--radius)] border border-border bg-card shadow-lg overflow-hidden"
      style={menuStyle}
    >
      {/* Clipboard Actions */}
      <div className="py-1">
        <MenuItem
          onClick={() => handleAction(() => document.execCommand('copy'))}
          icon={<Copy className="h-4 w-4" />}
          label="نسخ"
          shortcut="Ctrl+C"
        />
        <MenuItem
          onClick={() => handleAction(() => document.execCommand('cut'))}
          icon={<Scissors className="h-4 w-4" />}
          label="قص"
          shortcut="Ctrl+X"
        />
        <MenuItem
          onClick={() => handleAction(onPaste)}
          icon={<Clipboard className="h-4 w-4" />}
          label="لصق"
          shortcut="Ctrl+V"
        />
      </div>

      <MenuDivider />

      {/* Text Formatting */}
      <MenuSection title="التنسيق">
        <MenuItem
          onClick={() => handleAction(() => editor.chain().focus().toggleBold().run())}
          icon={<Bold className="h-4 w-4" />}
          label="غامق"
          shortcut="Ctrl+B"
        />
        <MenuItem
          onClick={() => handleAction(() => editor.chain().focus().toggleItalic().run())}
          icon={<Italic className="h-4 w-4" />}
          label="مائل"
          shortcut="Ctrl+I"
        />
        <MenuItem
          onClick={() => handleAction(() => editor.chain().focus().toggleCode().run())}
          icon={<Code className="h-4 w-4" />}
          label="كود مضمن"
        />
      </MenuSection>

      <MenuDivider />

      {/* Headings */}
      <MenuSection title="العناوين">
        <MenuItem
          onClick={() => handleAction(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
          icon={<Heading1 className="h-4 w-4" />}
          label="عنوان 1"
        />
        <MenuItem
          onClick={() => handleAction(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          icon={<Heading2 className="h-4 w-4" />}
          label="عنوان 2"
        />
        <MenuItem
          onClick={() => handleAction(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
          icon={<Heading3 className="h-4 w-4" />}
          label="عنوان 3"
        />
      </MenuSection>

      <MenuDivider />

      {/* Block Elements */}
      <MenuSection title="العناصر">
        <MenuItem
          onClick={() => handleAction(() => editor.chain().focus().toggleBlockquote().run())}
          icon={<Quote className="h-4 w-4" />}
          label="اقتباس"
        />
        <MenuItem
          onClick={() => handleAction(() => editor.chain().focus().toggleBulletList().run())}
          icon={<List className="h-4 w-4" />}
          label="قائمة نقطية"
        />
        <MenuItem
          onClick={() => handleAction(() => editor.chain().focus().toggleOrderedList().run())}
          icon={<ListOrdered className="h-4 w-4" />}
          label="قائمة مرقمة"
        />
        <MenuItem
          onClick={() => handleAction(() => editor.chain().focus().toggleCodeBlock().run())}
          icon={<Code2 className="h-4 w-4" />}
          label="كتلة كود"
        />
        <MenuItem
          onClick={() => handleAction(() => editor.chain().focus().setHorizontalRule().run())}
          icon={<Minus className="h-4 w-4" />}
          label="خط فاصل"
        />
      </MenuSection>

      <MenuDivider />

      {/* Table Actions */}
      <MenuSection title="الجدول">
        {!isInTable ? (
          <MenuItem
            onClick={() =>
              handleAction(() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              )
            }
            icon={<Table className="h-4 w-4" />}
            label="إدراج جدول"
          />
        ) : (
          <>
            <MenuItem
              onClick={() => handleAction(() => editor.chain().focus().addColumnAfter().run())}
              icon={<Plus className="h-4 w-4" />}
              label="إضافة عمود"
            />
            <MenuItem
              onClick={() => handleAction(() => editor.chain().focus().addRowAfter().run())}
              icon={<Plus className="h-4 w-4" />}
              label="إضافة صف"
            />
            <MenuItem
              onClick={() => handleAction(() => editor.chain().focus().deleteColumn().run())}
              icon={<Trash2 className="h-4 w-4" />}
              label="حذف عمود"
              destructive
            />
            <MenuItem
              onClick={() => handleAction(() => editor.chain().focus().deleteRow().run())}
              icon={<Trash2 className="h-4 w-4" />}
              label="حذف صف"
              destructive
            />
            <MenuItem
              onClick={() => handleAction(() => editor.chain().focus().deleteTable().run())}
              icon={<Trash2 className="h-4 w-4" />}
              label="حذف الجدول"
              destructive
            />
          </>
        )}
      </MenuSection>
    </div>
  );
};

export default EditorContextMenu;
