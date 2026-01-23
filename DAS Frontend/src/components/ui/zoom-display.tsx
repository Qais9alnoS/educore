import React from 'react';
import { useZoom } from '@/contexts/ZoomContext';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoomDisplayProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * ZoomDisplay - Custom UI component for displaying and controlling zoom level
 * Matches the app's iOS-inspired design language with glass-morphism effect
 */
export const ZoomDisplay: React.FC<ZoomDisplayProps> = ({ className, showLabel = false }) => {
  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom();

  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-2xl',
        'border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/60 shadow-sm',
        'text-xs font-medium text-[hsl(var(--foreground))]',
        className
      )}
      title="التحكم في حجم الواجهة (Ctrl+Plus / Ctrl+Minus)"
    >
      {/* Zoom Out Button */}
      <button
        onClick={zoomOut}
        disabled={zoom <= 80}
        className={cn(
          'h-9 w-10 flex items-center justify-center',
          'transition-all duration-200 hover:bg-[hsl(var(--muted))]/80',
          'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
        )}
        aria-label="تصغير الواجهة"
      >
        <ZoomOut className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>

      {/* Zoom Level Display */}
      <div
        className={cn(
          'h-9 px-3 flex items-center justify-center select-none'
        )}
      >
        {showLabel ? (
          <span className="text-xs">{zoom}%</span>
        ) : (
          <span className="font-normal">{zoom}%</span>
        )}
      </div>

      {/* Zoom In Button */}
      <button
        onClick={zoomIn}
        disabled={zoom >= 150}
        className={cn(
          'h-9 w-10 flex items-center justify-center',
          'transition-all duration-200 hover:bg-[hsl(var(--muted))]/80',
          'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
        )}
        aria-label="تكبير الواجهة"
      >
        <ZoomIn className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>

      {/* Reset Button - Only show if zoom is not at default */}
      {zoom !== 100 && (
        <button
          onClick={resetZoom}
          className={cn(
            'h-9 w-10 flex items-center justify-center',
            'transition-all duration-200 hover:bg-[hsl(var(--muted))]/80',
            'active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            'text-muted-foreground'
          )}
          title="إعادة تعيين الحجم الافتراضي"
          aria-label="إعادة تعيين حجم الواجهة"
        >
          <RotateCcw className="w-3 h-3" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};

export default ZoomDisplay;
