import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

export interface RangeIndicator {
  x: number;
  y: number;
  width: number;
  height: number;
  animate: boolean;
}

/**
 * The interval control's selection slides between options. Measuring the
 * pressed button keeps it correct when the control wraps on tiny phones or
 * when text is enlarged; without layout (tests, no CSS) nothing is drawn.
 */
export function useRangeIndicator(
  rangeRef: RefObject<HTMLDivElement | null>,
  optionCount: number,
  displayIntervalHours: number
) {
  const [rangeIndicator, setRangeIndicator] = useState<RangeIndicator | null>(null);

  useLayoutEffect(() => {
    const range = rangeRef.current;
    if (!range) return;
    let measured = false;
    const measure = () => {
      const pressed = range.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (!pressed || pressed.offsetWidth === 0) {
        setRangeIndicator(null);
        return;
      }
      const next = {
        x: pressed.offsetLeft,
        y: pressed.offsetTop,
        width: pressed.offsetWidth,
        height: pressed.offsetHeight,
      };
      const animate = measured;
      measured = true;
      setRangeIndicator(previous =>
        previous &&
        previous.x === next.x &&
        previous.y === next.y &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : { ...next, animate }
      );
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(range);
    return () => observer?.disconnect();
  }, [rangeRef, optionCount]);

  useLayoutEffect(() => {
    const range = rangeRef.current;
    if (!range) return;
    const pressed = range.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (!pressed || pressed.offsetWidth === 0) return;
    setRangeIndicator({
      x: pressed.offsetLeft,
      y: pressed.offsetTop,
      width: pressed.offsetWidth,
      height: pressed.offsetHeight,
      animate: true,
    });
  }, [rangeRef, displayIntervalHours]);

  return rangeIndicator;
}
