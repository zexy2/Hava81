import { describe, expect, it, vi } from 'vitest';
import { activateDeferredForecast, restoreViewportTop } from '../../scripts/lib/activate-deferred-forecast.mjs';

function createPage({
  chartInitiallyMounted = false,
  placeholderInitiallyVisible = true,
  detachDuringScroll = false,
  scrollFails = false,
} = {}) {
  let chartMounted = chartInitiallyMounted;
  let placeholderVisible = placeholderInitiallyVisible;
  const events: string[] = [];

  const forecastContent = {
    count: vi.fn(async () => (chartMounted ? 1 : 0)),
    waitFor: vi.fn(async () => {
      events.push('forecast-visible');
      if (!chartMounted) throw new Error('forecast did not mount');
    }),
  };
  const forecastBase = { first: vi.fn(() => forecastContent) };
  const placeholder = {
    first: vi.fn(() => placeholder),
    isVisible: vi.fn(async () => placeholderVisible),
    evaluate: vi.fn(async () => {
      events.push('scroll');
      if (detachDuringScroll) {
        placeholderVisible = false;
        chartMounted = true;
        throw new Error('placeholder detached during scroll');
      }
      if (scrollFails) throw new Error('scroll failed');
      chartMounted = true;
      placeholderVisible = false;
    }),
  };
  const placeholderBase = { filter: vi.fn(() => placeholder) };
  const initialState = {
    waitFor: vi.fn(async () => {
      events.push('initial-state-visible');
    }),
  };
  const initialStateBase = { first: vi.fn(() => initialState) };
  const page = {
    locator: vi.fn((selector: string) => {
      if (selector === '.hava81-forecast-atlas, .atlas-forecast-error-card') return forecastBase;
      if (selector === '.atlas-forecast-loading--card') return placeholderBase;
      return initialStateBase;
    }),
    evaluate: vi.fn(async () => {
      events.push('restore-top');
    }),
  };

  return { page, events, forecastContent, placeholder };
}

describe('shared deferred forecast audit helper', () => {
  it('scrolls the placeholder into the activation margin and waits for the chart', async () => {
    const { page, events, forecastContent, placeholder } = createPage();

    await expect(activateDeferredForecast(page)).resolves.toBe(forecastContent);

    expect(placeholder.evaluate).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['initial-state-visible', 'scroll', 'forecast-visible']);
  });

  it('does not scroll when the chart is already mounted', async () => {
    const { page, events, forecastContent, placeholder } = createPage({ chartInitiallyMounted: true });

    await expect(activateDeferredForecast(page)).resolves.toBe(forecastContent);

    expect(placeholder.evaluate).not.toHaveBeenCalled();
    expect(events).toEqual(['initial-state-visible', 'forecast-visible']);
  });

  it('ignores only the placeholder-detach race when activation has mounted the chart', async () => {
    const { page, events, forecastContent, placeholder } = createPage({ detachDuringScroll: true });

    await expect(activateDeferredForecast(page)).resolves.toBe(forecastContent);

    expect(placeholder.isVisible).toHaveBeenCalledTimes(2);
    expect(events).toEqual(['initial-state-visible', 'scroll', 'forecast-visible']);
  });

  it('preserves a genuine scroll error while the placeholder remains visible', async () => {
    const { page, placeholder } = createPage({ scrollFails: true });

    await expect(activateDeferredForecast(page)).rejects.toThrow('scroll failed');
    expect(placeholder.isVisible).toHaveBeenCalledTimes(2);
  });

  it('restores the page to the first viewport and waits for layout to settle', async () => {
    const { page, events } = createPage();

    await restoreViewportTop(page);

    expect(page.evaluate).toHaveBeenCalledTimes(2);
    expect(events).toEqual(['restore-top', 'restore-top']);
  });
});
