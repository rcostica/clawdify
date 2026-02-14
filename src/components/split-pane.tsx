'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number; // percentage, e.g. 50
  minLeftPx?: number;
  minRightPx?: number;
}

export function SplitPane({
  left,
  right,
  defaultLeftWidth = 50,
  minLeftPx = 300,
  minRightPx = 300,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const x = e.clientX - rect.left;
      // Enforce min widths
      const clampedX = Math.max(minLeftPx, Math.min(x, totalWidth - minRightPx));
      setLeftWidth((clampedX / totalWidth) * 100);
    };
    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    // Touch support
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const x = e.touches[0].clientX - rect.left;
      const clampedX = Math.max(minLeftPx, Math.min(x, totalWidth - minRightPx));
      setLeftWidth((clampedX / totalWidth) * 100);
    };
    const onTouchEnd = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [minLeftPx, minRightPx]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      {/* Left pane */}
      <div style={{ width: `${leftWidth}%`, maxWidth: `${leftWidth}%` }} className="h-full overflow-auto flex-shrink-0">
        {left}
      </div>

      {/* Divider */}
      <div
        className="relative flex-shrink-0 w-[3px] bg-border dark:bg-zinc-700 cursor-col-resize hover:bg-primary/50 transition-colors group"
        onMouseDown={onMouseDown}
        onTouchStart={(e) => {
          e.preventDefault();
          dragging.current = true;
        }}
      >
        {/* Drag handle dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-8 rounded-full bg-border dark:bg-zinc-600 group-hover:bg-primary/60 transition-colors flex items-center justify-center">
          <div className="w-0.5 h-4 rounded-full bg-muted-foreground/40" />
        </div>
      </div>

      {/* Right pane */}
      <div className="h-full overflow-hidden flex-1 min-w-0">
        {right}
      </div>
    </div>
  );
}
