import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useResolvedColorMode } from '../../hooks/useResolvedColorMode';

const createMediaQuery = (initialMatches: boolean) => {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.add(listener as (event: MediaQueryListEvent) => void);
    }),
    removeEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.delete(listener as (event: MediaQueryListEvent) => void);
    }),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  return {
    media,
    setMatches(next: boolean) {
      matches = next;
      const event = { matches: next, media: media.media } as MediaQueryListEvent;
      listeners.forEach(listener => listener(event));
    },
  };
};

describe('useResolvedColorMode', () => {
  it('uses the device color preference for automatic mode and reacts to changes', () => {
    const query = createMediaQuery(false);
    vi.mocked(window.matchMedia).mockReturnValue(query.media);

    const { result } = renderHook(() => useResolvedColorMode('auto'));
    expect(result.current).toBe('light');

    act(() => query.setMatches(true));
    expect(result.current).toBe('dark');
  });

  it('keeps explicit light and dark choices independent of the device preference', () => {
    const query = createMediaQuery(true);
    vi.mocked(window.matchMedia).mockReturnValue(query.media);

    const { result, rerender } = renderHook(
      ({ mode }: { mode: 'light' | 'dark' }) => useResolvedColorMode(mode),
      { initialProps: { mode: 'light' as 'light' | 'dark' } }
    );
    expect(result.current).toBe('light');

    rerender({ mode: 'dark' });
    expect(result.current).toBe('dark');
  });
});
