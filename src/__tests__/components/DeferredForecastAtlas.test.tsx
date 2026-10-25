import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { DeferredForecastAtlas } from '../../components/app/DeferredForecastAtlas';
import type { ForecastAtlasProps } from '../../components/hava81/ForecastAtlas';

vi.mock('../../components/hava81/ForecastAtlas', () => ({
  ForecastAtlas: () => <section data-testid="forecast-atlas-loaded">Forecast loaded</section>,
}));

const originalIntersectionObserver = window.IntersectionObserver;
const observers: ControlledIntersectionObserver[] = [];

class ControlledIntersectionObserver {
  readonly callback: IntersectionObserverCallback;
  readonly options?: IntersectionObserverInit;
  target?: Element;
  disconnected = false;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    observers.push(this);
  }

  observe = (target: Element) => {
    this.target = target;
  };
  disconnect = () => {
    this.disconnected = true;
  };
  unobserve = vi.fn();
  takeRecords = () => [];

  trigger(isIntersecting: boolean) {
    if (!this.target) throw new Error('observer has no target');
    this.callback(
      [{ isIntersecting, target: this.target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

const props: ForecastAtlasProps = {
  daily: [],
  hourly: [],
  meta: {
    provider: 'Open-Meteo',
    fetchedAt: new Date('2026-10-25T09:00:00.000Z'),
    timezoneOffsetSeconds: 10_800,
    intervalHours: 1,
  },
};

describe('DeferredForecastAtlas', () => {
  afterEach(() => {
    cleanup();
    observers.length = 0;
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: originalIntersectionObserver,
    });
  });

  it('keeps the heavy chart unmounted until its accessible placeholder nears the viewport', async () => {
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: ControlledIntersectionObserver,
    });

    render(<DeferredForecastAtlas {...props} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Saatlik tahmin, bu bölüm ekrana yaklaştığında yüklenir.'
    );
    expect(screen.queryByTestId('forecast-atlas-loaded')).not.toBeInTheDocument();
    expect(observers).toHaveLength(1);
    expect(observers[0].options?.rootMargin).toBe('120px 0px');

    act(() => observers[0].trigger(true));

    expect(await screen.findByTestId('forecast-atlas-loaded')).toBeInTheDocument();
    expect(observers[0].disconnected).toBe(true);
  });

  it('loads immediately when the placeholder is interacted with', async () => {
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: ControlledIntersectionObserver,
    });

    render(<DeferredForecastAtlas {...props} />);
    fireEvent.pointerDown(screen.getByRole('status'));

    expect(await screen.findByTestId('forecast-atlas-loaded')).toBeInTheDocument();
  });

  it('fails open to the forecast when IntersectionObserver is unavailable', async () => {
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    render(<DeferredForecastAtlas {...props} />);

    expect(await screen.findByTestId('forecast-atlas-loaded')).toBeInTheDocument();
  });
});
