import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TableEditorProps {
  rows: number;
  cols: number;
  data: string[][];
  onDataChange: (data: string[][]) => void;
  onDelete: () => void;
  isDarkMode?: boolean;
}

export const TableEditor: React.FC<TableEditorProps> = ({
  rows: initialRows,
  cols: initialCols,
  data: initialData,
  onDataChange,
  onDelete,
  isDarkMode = false
}) => {
  const [data, setData] = useState<string[][]>(initialData);
  const [rows, setRows] = useState(initialRows);
  const [cols, setCols] = useState(initialCols);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const updateCell = (row: number, col: number, value: string) => {
    const newData = [...data];
    if (!newData[row]) newData[row] = [];
    newData[row][col] = value;
    setData(newData);
    onDataChange(newData);
  };

  const addRow = () => {
    const newData = [...data];
    newData.push(new Array(cols).fill(''));
    setData(newData);
    setRows(rows + 1);
    onDataChange(newData);
  };

  const addColumn = () => {
    const newData = data.map(row => [...row, '']);
    setData(newData);
    setCols(cols + 1);
    onDataChange(newData);
  };

  const deleteRow = (rowIndex: number) => {
    const newData = data.filter((_, idx) => idx !== rowIndex);
    setData(newData);
    setRows(Math.max(1, rows - 1));
    onDataChange(newData);
  };

  const deleteColumn = (colIndex: number) => {
    const newData = data.map(row => row.filter((_, idx) => idx !== colIndex));
    setData(newData);
    setCols(Math.max(1, cols - 1));
    onDataChange(newData);
  };

  const bgColor = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const headerBgColor = isDarkMode ? 'bg-gray-700' : 'bg-gray-100';
  const borderColor = isDarkMode ? 'border-gray-600' : 'border-gray-300';
  const textColor = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const inputBgColor = isDarkMode ? 'bg-gray-700' : 'bg-white';
  const inputBorderColor = isDarkMode ? 'border-gray-500' : 'border-gray-300';

  return (
    <div ref={containerRef} className={`relative inline-block ${bgColor} rounded-lg overflow-hidden`}>
      <div className={`overflow-x-auto border ${borderColor}`}>
        <table className={`border-collapse w-full`}>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex === 0 ? headerBgColor : ''}>
                {row.map((cell, colIndex) => (
                  <td
                    key={`${rowIndex}-${colIndex}`}
                    className={`border ${borderColor} p-0 relative group`}
                  >
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                      className={`w-24 px-2 py-2 border-0 outline-none ${inputBgColor} ${textColor} text-sm`}
                      placeholder={rowIndex === 0 ? `العمود ${colIndex + 1}` : ''}
                    />
                    {/* Delete column button on header */}
                    {rowIndex === 0 && (
                      <button
                        onClick={() => deleteColumn(colIndex)}
                        className={`absolute -top-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-500 hover:text-red-700`}
                        title="حذف العمود"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                ))}
                {/* Delete row button */}
                <td className={`border ${borderColor} p-1 bg-red-50 dark:bg-red-900/20`}>
                  <button
                    onClick={() => deleteRow(rowIndex)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="حذف الصف"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row button */}
      <div className={`flex items-center gap-1 p-2 border-t ${borderColor} bg-gray-50 dark:bg-gray-700`}>
        <Button
          size="sm"
          variant="outline"
          onClick={addRow}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3 w-3 ml-1" />
          إضافة صف
        </Button>

        {/* Add column button */}
        <Button
          size="sm"
          variant="outline"
          onClick={addColumn}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3 w-3 ml-1" />
          إضافة عمود
        </Button>

        {/* Delete table button */}
        <Button
          size="sm"
          variant="destructive"
          onClick={onDelete}
          className="h-7 px-2 text-xs mr-auto"
        >
          <Trash2 className="h-3 w-3 ml-1" />
          حذف الجدول
        </Button>
      </div>

      {/* Markdown preview */}
      <div className={`text-xs p-2 border-t ${borderColor} max-h-20 overflow-auto font-mono ${textColor}`}>
        <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">معاينة Markdown:</div>
        <code className="text-gray-700 dark:text-gray-300">
          {data.map((row, i) => i === 0 ? '| ' + row.join(' | ') + ' |\n' : '').join('')}
          {data.length > 0 && `| ${new Array(cols).fill('---').join(' | ')} |\n`}
          {data.slice(1).map((row, i) => '| ' + row.join(' | ') + ' |\n').join('')}
        </code>
      </div>
    </div>
  );
};

export default TableEditor;
