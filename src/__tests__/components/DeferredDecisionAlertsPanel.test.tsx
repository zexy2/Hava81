import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredDecisionAlertsPanel } from '../../components/app/DeferredDecisionAlertsPanel';
import type { ForecastMeta, NormalizedWeatherData } from '../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../components/hava81/DecisionAlertsPanel', () => ({
  DecisionAlertsPanel: () => <div data-testid="loaded-alerts">alerts loaded</div>,
}));

const props = {
  weather: {} as NormalizedWeatherData,
  hourly: [],
  forecastMeta: null as ForecastMeta | null,
};

let observerCallback: IntersectionObserverCallback | undefined;
let observe: ReturnType<typeof vi.fn>;
let disconnect: ReturnType<typeof vi.fn>;

class MockIntersectionObserver {
  root = null;
  rootMargin = '320px 0px';
  thresholds = [0];
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);

  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }

  observe = vi.fn((target: Element) => {
    observe(target);
  });

  disconnect = vi.fn(() => {
    disconnect();
  });
}

beforeEach(() => {
  observerCallback = undefined;
  observe = vi.fn();
  disconnect = vi.fn();
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DeferredDecisionAlertsPanel', () => {
  it('keeps optional alert code unmounted until the reserved slot nears the viewport', async () => {
    render(<DeferredDecisionAlertsPanel {...props} />);

    const region = screen.getByRole('region', { name: 'hava81.alerts.title' });
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('heading', { name: 'hava81.alerts.title' })).toBeInTheDocument();
    expect(screen.queryByTestId('loaded-alerts')).not.toBeInTheDocument();
    expect(observe).toHaveBeenCalledWith(region);
    expect(observerCallback).toBeDefined();

    act(() => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    expect(await screen.findByTestId('loaded-alerts')).toBeInTheDocument();
    expect(disconnect).toHaveBeenCalled();
  });

  it('activates when keyboard focus reaches the placeholder', async () => {
    render(<DeferredDecisionAlertsPanel {...props} />);

    fireEvent.focus(screen.getByRole('region', { name: 'hava81.alerts.title' }));

    expect(await screen.findByTestId('loaded-alerts')).toBeInTheDocument();
  });

  it('loads immediately when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<DeferredDecisionAlertsPanel {...props} />);

    expect(await screen.findByTestId('loaded-alerts')).toBeInTheDocument();
  });
});
