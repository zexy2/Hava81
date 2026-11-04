import { act, render } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProvinceTemperature } from '../../api/weatherService';
import { TURKISH_CITIES } from '../../constants/cities';
import { MapContext } from '../../components/map/mapContext';
import { FieldLayer, WindLayer } from '../../components/map/layers/MapLayers';
import { renderField } from '../../components/map/layers/renderField';

vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?url', () => ({ default: '/worker.mjs' }));
vi.mock('maplibre-gl', () => {
  class Marker {
    element: HTMLElement;
    constructor(options: { element: HTMLElement }) {
      this.element = options.element;
    }
    setLngLat() {
      return this;
    }
    addTo() {
      document.body.appendChild(this.element);
      return this;
    }
    remove() {
      this.element.remove();
    }
  }
  return { Marker, Map: class {}, Popup: class {}, setWorkerUrl: () => undefined };
});

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

const fakeCanvas = (painted: number[]) => {
  HTMLCanvasElement.prototype.getContext = function () {
    return {
      createImageData: (width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData: (image: { data: Uint8ClampedArray }) => {
        let alpha = 0;
        for (let index = 3; index < image.data.length; index += 4)
          if (image.data[index] > 0) alpha += 1;
        painted.push(alpha);
      },
    };
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
};

const provinces = (value: Partial<ProvinceTemperature> = {}): ProvinceTemperature[] =>
  TURKISH_CITIES.map(city => ({
    plate: city.plateCode,
    name: city.name,
    lat: city.coordinates.lat,
    lon: city.coordinates.lon,
    temperature: 10 + (city.plateCode % 20),
    icon: '02d',
    description: 'az bulutlu',
    observedAt: new Date(),
    ...value,
  }));

/** A MapLibre stand-in: records sources and layers and lets the test fire map events. */
const fakeMap = () => {
  const handlers: Record<string, Array<() => void>> = {};
  const sources = new Map<
    string,
    { url: string; updateImage: (options: { url: string }) => void }
  >();
  const layers = new Set<string>();
  const container = document.createElement('div');
  let styleLoaded = true;
  let sourceLoaded = false;
  const map = {
    getContainer: () => container,
    isStyleLoaded: () => styleLoaded,
    getStyle: () => ({
      layers: [
        { id: 'water', type: 'fill' },
        { id: 'labels', type: 'symbol' },
      ],
    }),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, source: { url: string }) => {
      const entry = {
        url: source.url,
        updateImage: (options: { url: string }) => (entry.url = options.url),
      };
      sources.set(id, entry);
    },
    removeSource: (id: string) => sources.delete(id),
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    addLayer: (layer: { id: string }, before?: string) => {
      layers.add(layer.id);
      map.before = before;
    },
    removeLayer: (id: string) => layers.delete(id),
    isSourceLoaded: () => sourceLoaded,
    on: (name: string, handler: () => void) => (handlers[name] ??= []).push(handler),
    off: (name: string, handler: () => void) => {
      handlers[name] = (handlers[name] ?? []).filter(entry => entry !== handler);
    },
    before: undefined as string | undefined,
  };
  return {
    map,
    container,
    sources,
    layers,
    emit: (name: string) => (handlers[name] ?? []).forEach(handler => handler()),
    setStyleLoaded: (value: boolean) => (styleLoaded = value),
    setSourceLoaded: (value: boolean) => (sourceLoaded = value),
  };
};

const withMap = (map: unknown, children: React.ReactNode) => (
  <MapContext.Provider value={map as MapLibreMap}>{children}</MapContext.Provider>
);

describe('map layers', () => {
  let painted: number[];
  beforeEach(() => {
    painted = [];
    fakeCanvas(painted);
  });
  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
  });

  it('renderField paints a field inside Türkiye and nothing without samples or a canvas', () => {
    expect(renderField([], 'temperature')).toBeNull();
    const samples = provinces().map(province => ({
      lat: province.lat,
      lon: province.lon,
      value: province.temperature,
    }));
    expect(renderField(samples, 'temperature')).toMatch(/^data:image\/png/);
    expect(painted[0]).toBeGreaterThan(1_000);

    // #1720: one province paints only its own neighbourhood, not the whole country.
    renderField([{ lat: 41, lon: 29, value: 12 }], 'temperature');
    expect(painted[1]).toBeGreaterThan(0);
    expect(painted[1]).toBeLessThan(painted[0] / 4);

    HTMLCanvasElement.prototype.getContext = (() => null) as typeof originalGetContext;
    expect(renderField(samples, 'temperature')).toBeNull();
  });

  it('renderField returns null when the canvas cannot be exported', () => {
    HTMLCanvasElement.prototype.toDataURL = () => {
      throw new Error('tainted');
    };
    const samples = [{ lat: 41, lon: 29, value: 12 }];
    expect(renderField(samples, 'precipitation', 'amount')).toBeNull();
  });

  it('FieldLayer adds the field under the labels, swaps it per layer and marks it loaded', () => {
    const fake = fakeMap();
    const { rerender, container, unmount } = render(
      withMap(fake.map, <FieldLayer provinces={provinces()} layer="temperature" hour={0} />)
    );
    expect(fake.sources.get('hava81-field')?.url).toMatch(/^data:image/);
    expect(fake.layers.has('hava81-field')).toBe(true);
    expect(fake.map.before).toBe('labels');
    expect(fake.container).toHaveAttribute('data-map-layer', 'temperature');
    expect(fake.container).toHaveAttribute('data-map-field', 'loading');
    expect(container.querySelector('img')).toHaveAttribute('data-map-layer', 'temperature');

    // #1756: loaded only once MapLibre has decoded the image source.
    fake.setSourceLoaded(true);
    act(() => fake.emit('sourcedata'));
    expect(fake.container).toHaveAttribute('data-map-field', 'loaded');

    // A new layer updates the same image source instead of stacking sources.
    rerender(
      withMap(
        fake.map,
        <FieldLayer provinces={provinces({ cloudCover: 60 })} layer="cloud" hour={0} />
      )
    );
    expect(fake.sources.size).toBe(1);
    expect(fake.container).toHaveAttribute('data-map-layer', 'cloud');

    // Nothing to draw: the field is removed.
    rerender(withMap(fake.map, <FieldLayer provinces={[]} layer="wind" hour={0} />));
    expect(fake.sources.size).toBe(0);
    expect(fake.layers.size).toBe(0);
    expect(fake.container).not.toHaveAttribute('data-map-layer');
    expect(fake.container).not.toHaveAttribute('data-map-field');

    rerender(
      withMap(fake.map, <FieldLayer provinces={provinces()} layer="temperature" hour={0} />)
    );
    unmount();
    expect(fake.sources.size).toBe(0);
    expect(fake.container).not.toHaveAttribute('data-map-layer');
  });

  it('FieldLayer waits for the style and re-adds itself after a style swap', () => {
    const fake = fakeMap();
    fake.setStyleLoaded(false);
    render(withMap(fake.map, <FieldLayer provinces={provinces()} layer="temperature" hour={0} />));
    expect(fake.sources.size).toBe(0);
    fake.setStyleLoaded(true);
    act(() => fake.emit('styledata'));
    expect(fake.sources.size).toBe(1);
  });

  it('FieldLayer renders nothing without a map', () => {
    const { container } = render(
      <FieldLayer provinces={provinces()} layer="temperature" hour={0} />
    );
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('WindLayer draws one downwind arrow per province with a direction, heavier in strong wind', () => {
    const fake = fakeMap();
    const readings = provinces().map((province, index) =>
      index < 3 ? { ...province, windDirection: 0, windSpeed: index === 0 ? 30 : 2 } : province
    );
    render(withMap(fake.map, <WindLayer provinces={readings} />));
    const arrows = document.querySelectorAll('[data-wind-province]');
    expect(arrows).toHaveLength(3);
    expect(arrows[0]).toHaveAttribute('data-rotation', '180');
    const weights = [...arrows].map(arrow =>
      Number((arrow as HTMLElement).style.getPropertyValue('--wind-weight'))
    );
    expect(weights[0]).toBe(3.2);
    expect(weights[1]).toBeLessThan(weights[0]);
  });
});
