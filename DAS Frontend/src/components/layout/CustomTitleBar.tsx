import React, { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Monitor, Settings } from 'lucide-react';
import { UniversalSearchBar } from '@/components/search/UniversalSearchBar';
import { ZoomDisplay } from '@/components/ui/zoom-display';
import { useZoom } from '@/contexts/ZoomContext';

interface CustomTitleBarProps {
  /** 'splash' = only nav buttons, 'login' = nav + theme toggle, 'full' = everything */
  mode?: 'splash' | 'login' | 'full';
}

/**
 * Custom Title Bar - Merges with app UI
 * Matches native Windows window controls exactly
 */
const CustomTitleBar: React.FC<CustomTitleBarProps> = ({ mode = 'full' }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [academicYearName, setAcademicYearName] = useState<string>('2025-2026');
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { zoomIn, zoomOut } = useZoom();
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check and listen for maximize state
  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const win = getCurrentWindow();
        const maximized = await win.isMaximized();
        setIsMaximized(maximized);
      } catch (e) {
        console.error('Failed to check maximized state:', e);
      }
    };
    checkMaximized();

    // Listen for window resize to update maximize state
    const handleResize = async () => {
      try {
        const win = getCurrentWindow();
        const maximized = await win.isMaximized();
        setIsMaximized(maximized);
      } catch (e) {}
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load academic year name from localStorage
  useEffect(() => {
    if (mode !== 'full') return;
    
    const storedYearName = localStorage.getItem('selected_academic_year_name');
    if (storedYearName) {
      setAcademicYearName(storedYearName);
    }

    const handleStorageChange = () => {
      const name = localStorage.getItem('selected_academic_year_name');
      if (name) setAcademicYearName(name);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('academicYearChanged', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('academicYearChanged', handleStorageChange);
    };
  }, [mode]);

  // Global keyboard shortcut for search (Ctrl+K)
  useEffect(() => {
    if (mode !== 'full') return;
    
    const handleKeyPress = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="بحث"]');
        if (searchInput) {
          (searchInput as HTMLInputElement).focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [mode]);

  // Global keyboard shortcuts for zoom (Ctrl++ and Ctrl+-)
  useEffect(() => {
    const handleZoomKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          zoomIn();
        } else if (event.key === '-' || event.key === '_') {
          event.preventDefault();
          zoomOut();
        }
      }
    };
    document.addEventListener('keydown', handleZoomKeyPress);
    return () => document.removeEventListener('keydown', handleZoomKeyPress);
  }, [zoomIn, zoomOut]);

  const handleMinimize = async () => {
    try {
      const win = getCurrentWindow();
      await win.minimize();
    } catch (e) {
      console.error('Failed to minimize:', e);
    }
  };

  const handleMaximize = async () => {
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
      const maximized = await win.isMaximized();
      setIsMaximized(maximized);
    } catch (e) {
      console.error('Failed to toggle maximize:', e);
    }
  };

  const handleClose = async () => {
    try {
      const win = getCurrentWindow();
      await win.close();
    } catch (e) {
      console.error('Failed to close:', e);
    }
  };

  // Theme cycling (light -> dark -> system)
  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light': return 'وضع النهار';
      case 'dark': return 'وضع الليل';
      default: return 'تلقائي';
    }
  };

  const getThemeIcon = () => {
    if (!mounted) return null;
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" style={{ color: 'hsl(38, 92%, 58%)' }} strokeWidth={2} />;
      case 'dark':
        return <Moon className="h-4 w-4" style={{ color: 'hsl(211, 86%, 56%)' }} strokeWidth={2} />;
      default:
        return <Monitor className="h-4 w-4 dark:text-white text-black" strokeWidth={2} />;
    }
  };

  // Native Windows-style icons (matching the exact pixel design)
  const MinimizeIcon = () => (
    <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
      <rect width="10" height="1" fill="currentColor" />
    </svg>
  );

  const MaximizeIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <rect x="0.5" y="0.5" width="9" height="9" rx="1" ry="1" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );

  const RestoreIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      {/* Back window */}
      <rect x="2.5" y="0.5" width="7" height="7" rx="1" ry="1" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Front window */}
      <rect x="0.5" y="2.5" width="7" height="7" rx="1" ry="1" stroke="currentColor" strokeWidth="1" fill="hsl(var(--background))" />
    </svg>
  );

  const CloseIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M0 0L10 10M10 0L0 10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );

  // Theme Switcher Button (exact copy from ThemeSwitcher component)
  const ThemeSwitcherButton = () => (
    <div className="group relative flex items-center">
      <button
        onClick={cycleTheme}
        className="h-9 w-10 flex items-center justify-center rounded-xl bg-[hsl(var(--muted))]/60 border border-[hsl(var(--border))]/40 transition-all duration-200 hover:bg-[hsl(var(--muted))]/80"
        aria-label={getThemeLabel()}
      >
        {getThemeIcon()}
      </button>
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-popover border border-border rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
        <span className="text-xs text-popover-foreground">{getThemeLabel()}</span>
      </div>
    </div>
  );

  const windowButtonBaseClass = "h-[30px] w-[46px] flex items-center justify-center text-[hsl(var(--foreground))] transition-colors";

  return (
    <div
      className="custom-titlebar fixed top-0 left-0 right-0 h-12 bg-background flex items-center z-[9999] select-none relative"
      dir="rtl"
      data-tauri-drag-region
    >
      {/* Right side (RTL) - Year label */}
      {mode === 'full' && (
        <div className="flex items-center px-4 h-full" data-tauri-drag-region>
          <span className="text-[hsl(var(--foreground))] font-semibold text-base">
            {academicYearName}
          </span>
        </div>
      )}

      {/* Center - Search bar (only in full mode) */}
      {mode === 'full' && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 h-full flex items-center"
          data-tauri-drag-region
        >
          <div className="w-[min(32rem,calc(100vw-18rem))]">
            <UniversalSearchBar placeholder="بحث... (Ctrl+K)" />
          </div>
        </div>
      )}

      {/* Spacer for layout */}
      <div className="flex-1" data-tauri-drag-region />

      {/* Left side (RTL) - Theme switcher, Settings, and Zoom display (login & full modes) */}
      {mode !== 'splash' && (
        <div className="flex items-center px-4 h-full gap-3">
          <ThemeSwitcherButton />
          {mode === 'full' && (
            <div className="group relative flex items-center">
              <button
                onClick={() => navigate('/settings')}
                className="h-9 w-10 flex items-center justify-center rounded-xl bg-[hsl(var(--muted))]/60 border border-[hsl(var(--border))]/40 transition-all duration-200 hover:bg-[hsl(var(--muted))]/80"
                aria-label="الإعدادات"
              >
                <Settings className="h-4 w-4" />
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-popover border border-border rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                <span className="text-xs text-popover-foreground">الإعدادات</span>
              </div>
            </div>
          )}
          {mode === 'full' && <ZoomDisplay showLabel={false} />}
        </div>
      )}

      {/* Window Controls - Far left in RTL */}
      <div className="flex h-full" style={{ direction: 'ltr' }}>
        {/* Close - red hover */}
        <button
          onClick={handleClose}
          className={`${windowButtonBaseClass} hover:bg-[#c42b1c] hover:text-white`}
          title="إغلاق"
        >
          <CloseIcon />
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={handleMaximize}
          className={`${windowButtonBaseClass} hover:bg-[hsl(var(--muted))]`}
          title={isMaximized ? "استعادة" : "تكبير"}
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>

        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className={`${windowButtonBaseClass} hover:bg-[hsl(var(--muted))]`}
          title="تصغير"
        >
          <MinimizeIcon />
        </button>
      </div>
    </div>
  );
};

export default CustomTitleBar;