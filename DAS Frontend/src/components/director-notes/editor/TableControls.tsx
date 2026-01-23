import React from 'react';
import { Editor } from '@tiptap/react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TableControlsPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TableControlsProps {
  editor: Editor | null;
  position: TableControlsPosition | null;
  disabled?: boolean;
}

export const TableControls: React.FC<TableControlsProps> = ({
  editor,
  position,
  disabled,
}) => {
  if (!editor || !position || disabled) return null;

  return (
    <>
      {/* Add Column Button - Right side of table */}
      <div
        className="absolute flex flex-col gap-1"
        style={{
          top: position.top + 8,
          left: position.left + position.width + 8,
        }}
      >
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7 rounded-lg bg-card hover:bg-primary hover:text-primary-foreground transition-colors shadow-sm"
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          title="إضافة عمود"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Add Row Button - Bottom of table */}
      <div
        className="absolute flex gap-1"
        style={{
          top: position.top + position.height + 8,
          left: position.left,
        }}
      >
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7 rounded-lg bg-card hover:bg-primary hover:text-primary-foreground transition-colors shadow-sm"
          onClick={() => editor.chain().focus().addRowAfter().run()}
          title="إضافة صف"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </>
  );
};

export default TableControls;
