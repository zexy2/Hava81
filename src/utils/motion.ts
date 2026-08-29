export type MotionAwareScrollIntoViewOptions = ScrollIntoViewOptions;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function scrollIntoViewRespectingMotion(
  element: Element,
  options: MotionAwareScrollIntoViewOptions = {}
): void {
  element.scrollIntoView({
    ...options,
    behavior: prefersReducedMotion() ? 'auto' : (options.behavior ?? 'smooth'),
  });
}
