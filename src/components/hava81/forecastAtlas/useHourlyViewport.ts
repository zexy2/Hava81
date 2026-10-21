import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export interface HourlyScrollState {
  scrollable: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface VisibleHourWindow {
  from: number;
  to: number;
  start: number;
  size: number;
}

/**
 * Tracks the horizontally scrolling hour strip: whether it scrolls, which way
 * it can go, and which hour columns are currently in view.
 */
export function useHourlyViewport(
  viewportRef: RefObject<HTMLDivElement | null>,
  hoursRef: RefObject<HTMLOListElement | null>,
  count: number,
  displayIntervalHours: number
) {
  const [hourlyScroll, setHourlyScroll] = useState<HourlyScrollState>({
    scrollable: false,
    canGoBack: false,
    canGoForward: false,
  });
  const [visibleWindow, setVisibleWindow] = useState<VisibleHourWindow | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const next = {
        scrollable: maxScroll > 16,
        // Scroll snapping may place the first forecast tile a few pixels off zero.
        canGoBack: viewport.scrollLeft > 16,
        canGoForward: viewport.scrollLeft < maxScroll - 16,
      };
      setHourlyScroll(previous =>
        previous.scrollable === next.scrollable &&
        previous.canGoBack === next.canGoBack &&
        previous.canGoForward === next.canGoForward
          ? previous
          : next
      );
      const hours = hoursRef.current;
      if (count === 0 || !hours || hours.offsetWidth <= 0 || viewport.scrollWidth <= 0) return;
      const columnWidth = hours.offsetWidth / count;
      const gutter = hours.offsetLeft;
      // A column counts as visible once its centre (and chart point) clears
      // the sticky axis gutter on the left and the viewport edge on the right.
      const from = Math.min(
        count - 1,
        Math.max(0, Math.ceil(viewport.scrollLeft / columnWidth - 0.5))
      );
      const to = Math.min(
        count - 1,
        Math.max(
          from,
          Math.floor((viewport.scrollLeft + viewport.clientWidth - gutter) / columnWidth - 0.5)
        )
      );
      const start = Math.round((viewport.scrollLeft / viewport.scrollWidth) * 1000) / 10;
      const size = Math.round((viewport.clientWidth / viewport.scrollWidth) * 1000) / 10;
      setVisibleWindow(previous =>
        previous &&
        previous.from === from &&
        previous.to === to &&
        previous.start === start &&
        previous.size === size
          ? previous
          : { from, to, start, size }
      );
    };
    update();
    viewport.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(viewport);
    return () => {
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [viewportRef, hoursRef, count, displayIntervalHours]);

  return { hourlyScroll, visibleWindow };
}
