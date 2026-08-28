import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, scrollIntoViewRespectingMotion } from '../../utils/motion';

describe('motion utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses smooth scrolling when reduced motion is not requested', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    const scrollIntoView = vi.fn();
    const element = { scrollIntoView } as unknown as Element;

    scrollIntoViewRespectingMotion(element, { block: 'start' });

    expect(prefersReducedMotion()).toBe(false);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
  });

  it('forces instant scrolling when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const scrollIntoView = vi.fn();
    const element = { scrollIntoView } as unknown as Element;

    scrollIntoViewRespectingMotion(element, { block: 'nearest', behavior: 'smooth' });

    expect(prefersReducedMotion()).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
  });
});
