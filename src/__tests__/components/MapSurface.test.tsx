import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event?: unknown) => void;

const maps = vi.hoisted(() => [] as FakeMap[]);
const markers = vi.hoisted(() => [] as Array<{ lngLat: [number, number]; removed: boolean }>);
const popups = vi.hoisted(() => [] as Array<{ removed: boolean }>);

interface FakeMap {
  options: { style: string; center: [number, number]; zoom: number };
  handlers: Record<string, Handler[]>;
  layers: Record<string, { type: string }>;
  paint: Array<[string, string, string]>;
  calls: string[];
  tilesLoaded: boolean;
  emit: (name: string, event?: unknown) => void;
}

vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?url', () => ({ default: '/worker.mjs' }));
vi.mock('maplibre-gl', () => {
  class Map {
    options: FakeMap['options'];
    handlers: FakeMap['handlers'] = {};
    layers: FakeMap['layers'] = { water: { type: 'fill' }, waterway: { type: 'line' } };
    paint: FakeMap['paint'] = [];
    calls: string[] = [];
    tilesLoaded = true;
    touchZoomRotate = { disableRotation: () => undefined };
    keyboard = { disableRotation: () => undefined };
    canvas = document.createElement('canvas');
    constructor(options: FakeMap['options']) {
      this.options = options;
      maps.push(this as unknown as FakeMap);
    }
    on(name: string, handler: Handler) {
      (this.handlers[name] ??= []).push(handler);
      return this;
    }
    emit(name: string, event?: unknown) {
      for (const handler of this.handlers[name] ?? []) handler(event);
    }
    getLayer(id: string) {
      return this.layers[id];
    }
    setPaintProperty(id: string, property: string, value: string) {
      this.paint.push([id, property, value]);
    }
    areTilesLoaded() {
      return this.tilesLoaded;
    }
    getZoom() {
      return 7;
    }
    getCanvas() {
      return this.canvas;
    }
    jumpTo() {
      this.calls.push('jumpTo');
    }
    flyTo() {
      this.calls.push('flyTo');
    }
    setStyle(style: string) {
      this.calls.push(`setStyle:${style}`);
    }
    zoomIn() {
      this.calls.push('zoomIn');
    }
    zoomOut() {
      this.calls.push('zoomOut');
    }
    remove() {
      this.calls.push('remove');
    }
  }
  class Marker {
    entry = { lngLat: [0, 0] as [number, number], removed: false };
    element: HTMLElement;
    // Like MapLibre, the marker element is attached to the map's container when added.
    constructor(options: { element: HTMLElement }) {
      this.element = options.element;
      markers.push(this.entry);
    }
    setLngLat(lngLat: [number, number]) {
      this.entry.lngLat = lngLat;
      return this;
    }
    addTo() {
      document.body.appendChild(this.element);
      return this;
    }
    remove() {
      this.element.remove();
      this.entry.removed = true;
    }
  }
  class Popup {
    entry = { removed: false };
    constructor() {
      popups.push(this.entry);
    }
    setLngLat() {
      return this;
    }
    setDOMContent(node: HTMLElement) {
      document.body.appendChild(node);
      return this;
    }
    addTo() {
      return this;
    }
    remove() {
      this.entry.removed = true;
    }
  }
  return { Map, Marker, Popup, setWorkerUrl: () => undefined };
});

import { MapMarker, MapPopup, MapSurface, MapZoomControls } from '../../components/map/MapSurface';

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const enableWebGL = () => {
  HTMLCanvasElement.prototype.getContext = function (kind: string) {
    if (kind === '2d') {
      return {
        fillStyle: '',
        fillRect: () => undefined,
        getImageData: () => ({ data: [10, 20, 30, 255] }),
      };
    }
    return {};
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
};

const surface = (props: Partial<Parameters<typeof MapSurface>[0]> = {}) => {
  const onTiles = vi.fn();
  const onZoom = vi.fn();
  const onBackgroundClick = vi.fn();
  const view = render(
    <MapSurface
      center={{ lat: 41, lon: 29 }}
      focusZoom={6.5}
      initialZoom={5.2}
      theme="light"
      attempt={0}
      onTiles={onTiles}
      onZoom={onZoom}
      onBackgroundClick={onBackgroundClick}
      canvasLabel="Hava haritası"
      {...props}
    >
      <span>child</span>
    </MapSurface>
  );
  return { ...view, onTiles, onZoom, onBackgroundClick };
};

const element = () => document.querySelector('[data-map-surface]') as HTMLElement;

describe('MapSurface', () => {
  beforeEach(() => {
    maps.length = 0;
    markers.length = 0;
    popups.length = 0;
  });
  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('reports a failed map without WebGL instead of an empty canvas', () => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof originalGetContext;
    const { onTiles } = surface();
    expect(element()).toHaveAttribute('data-map-renderer', 'none');
    expect(element()).toHaveAttribute('data-map-tiles', 'failed');
    expect(onTiles).toHaveBeenCalledWith('failed');
    expect(maps).toHaveLength(0);
  });

  it('loads the style, reports tiles, zoom and background clicks, and names the canvas', () => {
    enableWebGL();
    const { onTiles, onZoom, onBackgroundClick, unmount } = surface();
    const [map] = maps;
    expect(map.options.style).toMatch(/\/positron$/);
    expect(onTiles).toHaveBeenLastCalledWith('loading');
    expect(screen.queryByText('child')).toBeNull();

    act(() => map.emit('load'));
    expect(screen.getByText('child')).toBeInTheDocument();
    expect(map.calls).toContain('jumpTo');
    expect((map as unknown as { canvas: HTMLCanvasElement }).canvas).toHaveAttribute(
      'aria-label',
      'Hava haritası'
    );

    act(() => map.emit('styledata'));
    expect(map.paint).toEqual([
      ['water', 'fill-color', 'rgb(10, 20, 30)'],
      ['waterway', 'line-color', 'rgb(10, 20, 30)'],
    ]);

    act(() => map.emit('idle'));
    expect(onTiles).toHaveBeenLastCalledWith('loaded');
    expect(element()).toHaveAttribute('data-map-tiles', 'loaded');
    // A tile failing after the first paint does not mark the map as failed.
    act(() => map.emit('error', { error: new Error('tile') }));
    expect(element()).toHaveAttribute('data-map-tiles', 'loaded');

    act(() => map.emit('zoomend'));
    expect(onZoom).toHaveBeenCalledWith(7);

    const marker = document.createElement('button');
    marker.setAttribute('data-map-marker', '');
    act(() => map.emit('click', { originalEvent: { target: marker } }));
    expect(onBackgroundClick).not.toHaveBeenCalled();
    act(() => map.emit('click', { originalEvent: { target: document.body } }));
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);

    unmount();
    expect(map.calls).toContain('remove');
  });

  it('marks a style that never loads as failed and waits for tiles before "loaded"', () => {
    enableWebGL();
    const { onTiles } = surface();
    const [map] = maps;
    map.tilesLoaded = false;
    act(() => map.emit('idle'));
    expect(onTiles).not.toHaveBeenCalledWith('loaded');
    act(() => map.emit('error', { error: new Error('style') }));
    expect(element()).toHaveAttribute('data-map-tiles', 'failed');
  });

  it('follows the city: flies normally, jumps when motion is reduced, and swaps the theme style', () => {
    enableWebGL();
    const { rerender } = surface();
    const [map] = maps;
    act(() => map.emit('load'));
    const props = {
      focusZoom: 6.5,
      initialZoom: 5.2,
      attempt: 0,
      onTiles: () => undefined,
      onZoom: () => undefined,
      canvasLabel: 'Hava haritası',
    };
    rerender(<MapSurface {...props} center={{ lat: 39.9, lon: 32.8 }} theme="light" />);
    expect(map.calls).toContain('flyTo');

    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    map.calls.length = 0;
    rerender(<MapSurface {...props} center={{ lat: 38.4, lon: 27.1 }} theme="light" />);
    expect(map.calls).toEqual(['jumpTo']);

    rerender(<MapSurface {...props} center={{ lat: 38.4, lon: 27.1 }} theme="dark" />);
    expect(map.calls.some(call => /^setStyle:.*\/dark$/.test(call))).toBe(true);
  });

  it('places markers, popups and zoom controls on the loaded map', () => {
    enableWebGL();
    const onActivate = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <MapSurface
        center={{ lat: 41, lon: 29 }}
        focusZoom={6.5}
        initialZoom={5.2}
        theme="light"
        attempt={0}
        onTiles={() => undefined}
        onZoom={() => undefined}
        canvasLabel="Hava haritası"
      />
    );
    const [map] = maps;
    act(() => map.emit('load'));
    const children = (lat: number) => (
      <>
        <MapMarker
          lat={lat}
          lon={29}
          label="İstanbul: 15°"
          className="marker"
          style={{ '--tone': 'red' } as React.CSSProperties}
          zIndex={3}
          dataAttributes={{ 'data-plate': '34' }}
          onActivate={onActivate}
        >
          <span>15°</span>
        </MapMarker>
        <MapMarker lat={40} lon={30} label="" className="arrow" interactive={false}>
          <span>↑</span>
        </MapMarker>
        <MapPopup lat={41} lon={29} label="İstanbul" closeLabel="Kapat" onClose={onClose}>
          <p>popup</p>
        </MapPopup>
        <MapZoomControls zoomInLabel="Yakınlaştır" zoomOutLabel="Uzaklaştır" />
      </>
    );
    const surfaceProps = {
      center: { lat: 41, lon: 29 },
      focusZoom: 6.5,
      initialZoom: 5.2,
      theme: 'light' as const,
      attempt: 0,
      onTiles: () => undefined,
      onZoom: () => undefined,
      canvasLabel: 'Hava haritası',
    };
    rerender(<MapSurface {...surfaceProps}>{children(41)}</MapSurface>);

    const marker = screen.getByRole('button', { name: 'İstanbul: 15°' });
    expect(marker).toHaveAttribute('data-plate', '34');
    expect(marker.style.zIndex).toBe('3');
    expect(marker.style.getPropertyValue('--tone')).toBe('red');
    fireEvent.click(marker);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(document.querySelector('span[aria-hidden="true"].arrow')).not.toBeNull();

    rerender(<MapSurface {...surfaceProps}>{children(41.5)}</MapSurface>);
    expect(markers[0].lngLat).toEqual([29, 41.5]);

    expect(screen.getByRole('dialog', { name: 'İstanbul' })).toHaveTextContent('popup');
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Yakınlaştır' }));
    fireEvent.click(screen.getByRole('button', { name: 'Uzaklaştır' }));
    expect(map.calls).toEqual(expect.arrayContaining(['zoomIn', 'zoomOut']));

    rerender(<MapSurface {...surfaceProps} />);
    expect(markers.every(entry => entry.removed)).toBe(true);
    expect(popups.every(entry => entry.removed)).toBe(true);
  });
});

describe('map styles', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults to the public OpenFreeMap styles', async () => {
    const { OPENFREEMAP_STYLES } = await import('../../components/map/mapStyles');
    expect(OPENFREEMAP_STYLES).toEqual({
      light: 'https://tiles.openfreemap.org/styles/positron',
      dark: 'https://tiles.openfreemap.org/styles/dark',
    });
  });

  it('#1757 uses a configured https style host and ignores anything else', async () => {
    vi.stubEnv('VITE_MAP_STYLE_BASE_URL', 'https://tiles.example.test/styles/');
    vi.resetModules();
    const configured = await import('../../components/map/mapStyles');
    expect(configured.OPENFREEMAP_STYLES.light).toBe('https://tiles.example.test/styles/positron');

    vi.stubEnv('VITE_MAP_STYLE_BASE_URL', 'http://insecure.test/styles');
    vi.resetModules();
    const insecure = await import('../../components/map/mapStyles');
    expect(insecure.OPENFREEMAP_STYLES.dark).toBe('https://tiles.openfreemap.org/styles/dark');
  });
});
