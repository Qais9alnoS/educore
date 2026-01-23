import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ZoomContextType {
  zoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fontSize: number;
  setFontSize: (size: number) => void;
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined);

export const ZoomProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [zoom, setZoomState] = useState<number>(100);
  const [fontSize, setFontSizeState] = useState<number>(16);
  const MIN_ZOOM = 80;
  const MAX_ZOOM = 150;
  const ZOOM_STEP = 10;

  const applyScale = (zoomLevel: number, baseFontSize: number) => {
    // Zoom and font size are both applied via the root font-size (Tailwind uses rem).
    // We combine them to avoid competing writes from different pages/components.
    document.documentElement.style.fontSize = `${(baseFontSize * zoomLevel) / 100}px`;
  };

  // Initialize zoom + font size from localStorage
  useEffect(() => {
    const savedZoom = localStorage.getItem('app_zoom_level');
    const savedFontSize = localStorage.getItem('app_font_size');

    const zoomValueRaw = savedZoom ? parseInt(savedZoom, 10) : 100;
    const zoomValue =
      !isNaN(zoomValueRaw) && zoomValueRaw >= MIN_ZOOM && zoomValueRaw <= MAX_ZOOM
        ? zoomValueRaw
        : 100;

    const fontSizeRaw = savedFontSize ? parseInt(savedFontSize, 10) : 16;
    const fontSizeValue = !isNaN(fontSizeRaw) ? fontSizeRaw : 16;

    setZoomState(zoomValue);
    setFontSizeState(fontSizeValue);
    applyScale(zoomValue, fontSizeValue);
  }, []);

  const setZoom = (newZoom: number) => {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    setZoomState(clampedZoom);
    localStorage.setItem('app_zoom_level', clampedZoom.toString());
    applyScale(clampedZoom, fontSize);
  };

  const setFontSize = (size: number) => {
    // Keep this intentionally simple: base font size in px; combined with zoom.
    const clamped = Math.max(12, Math.min(22, size));
    setFontSizeState(clamped);
    localStorage.setItem('app_font_size', clamped.toString());
    applyScale(zoom, clamped);
  };

  const zoomIn = () => {
    setZoom(zoom + ZOOM_STEP);
  };

  const zoomOut = () => {
    setZoom(zoom - ZOOM_STEP);
  };

  const resetZoom = () => {
    setZoom(100);
  };

  return (
    <ZoomContext.Provider value={{ zoom, setZoom, zoomIn, zoomOut, resetZoom, fontSize, setFontSize }}>
      {children}
    </ZoomContext.Provider>
  );
};

export const useZoom = (): ZoomContextType => {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoom must be used within a ZoomProvider');
  }
  return context;
};
