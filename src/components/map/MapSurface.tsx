import * as maplibregl from 'maplibre-gl';
// MapLibre 6 runs its tile parsing in a module worker shipped as a separate file; Vite copies
// it into the build and hands back its same-origin URL (covered by worker-src 'self').
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// OpenFreeMap: free vector tiles, commercial use allowed, no key (https://openfreemap.org).
// Positron reads quietly under weather layers; Dark keeps the same structure at night.
export const OPENFREEMAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;
export type MapTheme = keyof typeof OPENFREEMAP_STYLES;

type LngLat = [lon: number, lat: number];

maplibregl.setWorkerUrl(workerUrl);

const MapContext = createContext<maplibregl.Map | null>(null);

/** The live map for children; null until the style has loaded. */
export const useMapSurface = () => useContext(MapContext);

const supportsWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

export type TileState = 'loading' | 'loaded' | 'failed';

interface MapSurfaceProps {
  center: { lat: number; lon: number };
  /** Zoom to fly to whenever the centre changes. */
  focusZoom: number;
  initialZoom: number;
  theme: MapTheme;
  className?: string;
  /** Re-creates the map; used by the retry action after a failure. */
  attempt: number;
  onZoom: (zoom: number) => void;
  onTiles: (state: TileState) => void;
  /** Called when a click lands on the map itself (not on a marker). */
  onBackgroundClick?: () => void;
  children?: React.ReactNode;
}

/**
 * MapLibre with OpenFreeMap tiles. Children (markers, popups, layers) receive the map through
 * context once its style is ready. `data-map-surface` and `data-map-tiles` let tests and CSS
 * talk about the map without depending on the library's own class names.
 */
export function MapSurface({
  center,
  focusZoom,
  initialZoom,
  theme,
  className,
  attempt,
  onZoom,
  onTiles,
  onBackgroundClick,
  children,
}: MapSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [tiles, setTiles] = useState<TileState>('loading');
  const [noWebGL] = useState(() => typeof document !== 'undefined' && !supportsWebGL());
  const callbacks = useRef({ onZoom, onTiles, onBackgroundClick });
  callbacks.current = { onZoom, onTiles, onBackgroundClick };
  const firstCenter = useRef(center);
  const appliedTheme = useRef(theme);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || noWebGL) {
      if (noWebGL) {
        setTiles('failed');
        callbacks.current.onTiles('failed');
      }
      return undefined;
    }
    const reportTiles = (state: TileState) => {
      setTiles(state);
      callbacks.current.onTiles(state);
    };
    reportTiles('loading');
    let loadedOnce = false;
    const instance = new maplibregl.Map({
      container,
      style: OPENFREEMAP_STYLES[appliedTheme.current],
      center: [firstCenter.current.lon, firstCenter.current.lat] satisfies LngLat,
      zoom: initialZoom,
      minZoom: 4,
      maxZoom: 14,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      cooperativeGestures: false,
    });
    instance.touchZoomRotate.disableRotation();
    instance.keyboard.disableRotation();
    instance.on('load', () => setMap(instance));
    instance.on('idle', () => {
      if (!loadedOnce && instance.areTilesLoaded()) {
        loadedOnce = true;
        reportTiles('loaded');
      }
    });
    instance.on('error', event => {
      // A failed tile after the first paint is not a failed map; a failed style is.
      if (!loadedOnce) reportTiles('failed');
      if (import.meta.env.DEV) console.warn('[map]', event.error?.message);
    });
    instance.on('zoomend', () => callbacks.current.onZoom(instance.getZoom()));
    instance.on('click', event => {
      const target = event.originalEvent.target as HTMLElement | null;
      if (target?.closest('[data-map-marker]')) return;
      callbacks.current.onBackgroundClick?.();
    });
    return () => {
      setMap(null);
      instance.remove();
    };
    // `attempt` re-creates the map for the retry button; other props are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, noWebGL]);

  // Follow the selected city: fly there, or jump when the reader prefers less motion.
  const isFirstCenter = useRef(true);
  useEffect(() => {
    if (!map) return;
    if (isFirstCenter.current) {
      isFirstCenter.current = false;
      if (center.lat === firstCenter.current.lat && center.lon === firstCenter.current.lon) {
        map.jumpTo({ center: [center.lon, center.lat], zoom: focusZoom });
        return;
      }
    }
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) map.jumpTo({ center: [center.lon, center.lat], zoom: focusZoom });
    else map.flyTo({ center: [center.lon, center.lat], zoom: focusZoom, duration: 400 });
  }, [center.lat, center.lon, focusZoom, map]);

  // A theme change swaps the base style; the weather layers re-add themselves on `styledata`.
  useEffect(() => {
    if (!map || appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    map.setStyle(OPENFREEMAP_STYLES[theme]);
  }, [map, theme]);

  return (
    <div
      ref={containerRef}
      className={className}
      data-map-surface=""
      data-map-tiles={tiles}
      data-map-renderer={noWebGL ? 'none' : 'webgl'}
    >
      {map ? <MapContext.Provider value={map}>{children}</MapContext.Provider> : null}
    </div>
  );
}

interface MapMarkerProps {
  lat: number;
  lon: number;
  /** Accessible name; also the tooltip. */
  label: string;
  className: string;
  /** Inline style variables for the marker body (colours). */
  style?: React.CSSProperties;
  /** Keeps the marker's anchor on the point; plate markers anchor on their left plate. */
  anchorOffset?: [number, number];
  onActivate?: () => void;
  zIndex?: number;
  dataAttributes?: Record<string, string>;
  /** Decorative markers (wind arrows) are plain elements, not buttons. */
  interactive?: boolean;
  children: React.ReactNode;
}

/** A DOM marker rendered by React into a MapLibre marker element. */
export function MapMarker({
  lat,
  lon,
  label,
  className,
  style,
  anchorOffset,
  onActivate,
  zIndex,
  dataAttributes,
  interactive = true,
  children,
}: MapMarkerProps) {
  const map = useMapSurface();
  const [element] = useState<HTMLElement>(() => {
    if (!interactive) {
      const node = document.createElement('span');
      node.setAttribute('aria-hidden', 'true');
      return node;
    }
    const node = document.createElement('button');
    node.type = 'button';
    node.setAttribute('data-map-marker', '');
    return node;
  });
  const activate = useRef(onActivate);
  activate.current = onActivate;
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const position = useRef<LngLat>([lon, lat]);
  position.current = [lon, lat];

  useEffect(() => {
    if (!map) return undefined;
    const marker = new maplibregl.Marker({ element, anchor: 'center', offset: anchorOffset })
      .setLngLat(position.current)
      .addTo(map);
    markerRef.current = marker;
    const handle = (event: Event) => {
      event.stopPropagation();
      activate.current?.();
    };
    element.addEventListener('click', handle);
    return () => {
      element.removeEventListener('click', handle);
      marker.remove();
      markerRef.current = null;
    };
    // Position changes are applied below without re-creating the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, element]);

  useEffect(() => {
    element.className = className;
    if (label) {
      element.setAttribute('aria-label', label);
      element.title = label;
    }
    element.style.zIndex = zIndex === undefined ? '' : String(zIndex);
    for (const [name, value] of Object.entries(dataAttributes ?? {}))
      element.setAttribute(name, value);
  }, [className, dataAttributes, element, label, zIndex]);

  useEffect(() => {
    markerRef.current?.setLngLat([lon, lat]);
  }, [lat, lon]);

  useEffect(() => {
    for (const [name, value] of Object.entries(style ?? {})) {
      element.style.setProperty(name, String(value));
    }
  }, [element, style]);

  if (!map) return null;
  return createPortal(children, element);
}

interface MapPopupProps {
  lat: number;
  lon: number;
  className?: string;
  onClose: () => void;
  closeLabel: string;
  children: React.ReactNode;
}

/** One popup at a time, anchored above its point, closed by its button or Escape. */
export function MapPopup({ lat, lon, className, onClose, closeLabel, children }: MapPopupProps) {
  const map = useMapSurface();
  const [element] = useState(() => {
    const node = document.createElement('div');
    node.setAttribute('data-map-popup', '');
    node.setAttribute('role', 'dialog');
    return node;
  });
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!map) return undefined;
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      closeOnMove: false,
      focusAfterOpen: false,
      offset: 26,
      maxWidth: '18rem',
      className: className ?? '',
    })
      .setLngLat([lon, lat])
      .setDOMContent(element)
      .addTo(map);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      popup.remove();
    };
  }, [className, element, lat, lon, map]);

  if (!map) return null;
  return createPortal(
    <>
      <button
        type="button"
        className="weather-map__popup-close"
        aria-label={closeLabel}
        onClick={() => close.current()}
      >
        <span aria-hidden="true">×</span>
      </button>
      {children}
    </>,
    element
  );
}

/** Zoom buttons in the map's corner, sized for touch. */
export function MapZoomControls({
  zoomInLabel,
  zoomOutLabel,
}: {
  zoomInLabel: string;
  zoomOutLabel: string;
}) {
  const map = useMapSurface();
  if (!map) return null;
  return (
    <div className="weather-map__zoom" data-map-zoom="">
      <button
        type="button"
        data-map-zoom-in=""
        aria-label={zoomInLabel}
        onClick={() => map.zoomIn()}
      >
        <span aria-hidden="true">+</span>
      </button>
      <button
        type="button"
        data-map-zoom-out=""
        aria-label={zoomOutLabel}
        onClick={() => map.zoomOut()}
      >
        <span aria-hidden="true">−</span>
      </button>
    </div>
  );
}
