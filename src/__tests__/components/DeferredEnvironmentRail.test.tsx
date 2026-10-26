import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredEnvironmentRail } from '../../components/app/DeferredEnvironmentRail';
import type { NormalizedWeatherData } from '../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../components/hava81/EnvironmentRail', () => ({
  EnvironmentRail: () => <section data-testid="loaded-environment-rail">Environment rail loaded</section>,
}));

const props = {
  weather: {} as NormalizedWeatherData,
  onOpenMap: vi.fn(),
  mapExpanded: false,
};

let observerCallback: IntersectionObserverCallback | undefined;
let observerObserve: ReturnType<typeof vi.fn> | undefined;
let observerDisconnect: ReturnType<typeof vi.fn> | undefined;
let observerOptions: IntersectionObserverInit | undefined;

class MockIntersectionObserver {
  root = null;
  rootMargin = '0px';
  thresholds = [0];
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    observerCallback = callback;
    observerObserve = this.observe;
    observerDisconnect = this.disconnect;
    observerOptions = options;
  }
}

beforeEach(() => {
  observerCallback = undefined;
  observerObserve = undefined;
  observerDisconnect = undefined;
  observerOptions = undefined;
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DeferredEnvironmentRail', () => {
  it('keeps optional environment cards out of the initial render until their slot enters view', async () => {
    render(<DeferredEnvironmentRail {...props} />);

    const region = screen.getByRole('region', {
      name: 'daylight.title, weather.wind, weather.airQuality, common.map',
    });
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('common.loading');
    expect(screen.queryByTestId('loaded-environment-rail')).not.toBeInTheDocument();
    expect(observerObserve).toHaveBeenCalledWith(region);
    expect(observerOptions?.rootMargin).toBe('0px');

    act(() => {
      observerCallback?.(
        [{ isIntersecting: true, target: region } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(await screen.findByTestId('loaded-environment-rail')).toBeInTheDocument();
    expect(observerDisconnect).toHaveBeenCalled();
    expect(screen.queryByRole('region', {
      name: 'daylight.title, weather.wind, weather.airQuality, common.map',
    })).not.toBeInTheDocument();
  });

  it('activates when keyboard focus reaches the placeholder', async () => {
    render(<DeferredEnvironmentRail {...props} />);

    fireEvent.focus(screen.getByRole('region', {
      name: 'daylight.title, weather.wind, weather.airQuality, common.map',
    }));

    expect(await screen.findByTestId('loaded-environment-rail')).toBeInTheDocument();
  });

  it('loads immediately when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<DeferredEnvironmentRail {...props} />);

    expect(await screen.findByTestId('loaded-environment-rail')).toBeInTheDocument();
  });
});
