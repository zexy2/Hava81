/**
 * Jest Setup File
 */

import '@testing-library/jest-dom';
import { afterAll, beforeAll, vi } from 'vitest';

// The product's primary locale is Turkish; jsdom defaults to en-US.
Object.defineProperty(window.navigator, 'languages', {
  configurable: true,
  value: ['tr-TR', 'tr'],
});
Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'tr-TR' });

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Most component tests render the target in the visible test viewport. Dedicated
// deferred-mount tests replace this with a controllable observer to verify the
// before/after-intersection behavior explicitly.
class TestIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe = vi.fn((target: Element) => {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  });
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
}

Object.defineProperty(window, 'IntersectionObserver', {
  configurable: true,
  writable: true,
  value: TestIntersectionObserver,
});

// Mock ResizeObserver
class ResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserver,
});

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
