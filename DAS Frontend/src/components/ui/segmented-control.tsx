import * as React from "react";
import { cn } from "@/lib/utils";

interface SegmentedControlProps {
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

const SegmentedControl = React.forwardRef<HTMLDivElement, SegmentedControlProps>(
  ({ options, value, onValueChange, className }, ref) => {
    const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({});
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [isInitialized, setIsInitialized] = React.useState(false);

    React.useEffect(() => {
      const updateIndicator = () => {
        if (!containerRef.current) return;

        const activeButton = containerRef.current.querySelector(`[data-value="${value}"]`) as HTMLElement;
        if (activeButton) {
          const containerRect = containerRef.current.getBoundingClientRect();
          const activeRect = activeButton.getBoundingClientRect();

          setIndicatorStyle({
            left: `${activeRect.left - containerRect.left}px`,
            width: `${activeRect.width}px`,
            opacity: 1,
          });

          if (!isInitialized) {
            setIsInitialized(true);
          }
        }
      };

      // Initial update
      updateIndicator();

      // Update on window resize
      window.addEventListener('resize', updateIndicator);

      return () => {
        window.removeEventListener('resize', updateIndicator);
      };
    }, [value, isInitialized]);

    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={cn(
          "relative inline-flex h-11 items-center rounded-2xl bg-muted p-1",
          className
        )}
      >
        {/* Animated indicator blob */}
        <div
          className="absolute h-[calc(100%-8px)] top-1 rounded-xl bg-primary shadow-ios transition-all duration-300 ease-out pointer-events-none z-0"
          style={{
            ...indicatorStyle,
            opacity: isInitialized ? indicatorStyle.opacity : 0,
          }}
        />
        {options.map((option) => (
          <button
            key={option.value}
            data-value={option.value}
            type="button"
            className={cn(
              "relative z-10 flex-1 px-4 py-2 text-sm font-medium rounded-xl transition-colors duration-200",
              value === option.value
                ? "text-primary-foreground"
                : "text-muted-foreground"
            )}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }
);
SegmentedControl.displayName = "SegmentedControl";

export { SegmentedControl };