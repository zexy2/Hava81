import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { ImageOverlay, Marker } from 'react-leaflet';
import type { ProvinceTemperature } from '../../../api/weatherService';
import {
  downwindRotation,
  layerSamples,
  type LayerHour,
  type MapLayer,
  type PrecipitationMeasure,
} from './layerModel';
import { FIELD_BOUNDS, renderField } from './renderField';

interface FieldLayerProps {
  provinces: Iterable<ProvinceTemperature>;
  layer: MapLayer;
  hour: LayerHour;
  measure?: PrecipitationMeasure;
}

/**
 * The drawn field for the active layer, laid over the base map and under the markers.
 * The image is ours: interpolated from the 81-province readings, clipped to the outline.
 */
export function FieldLayer({ provinces, layer, hour, measure = 'chance' }: FieldLayerProps) {
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const url = useMemo(
    () => renderField(layerSamples(provinces, layer, hour, measure), layer, measure),
    [provinces, layer, hour, measure]
  );

  useEffect(() => {
    const element = overlayRef.current?.getElement();
    if (!element) return;
    element.setAttribute('data-map-layer', layer);
    element.setAttribute('alt', '');
    element.setAttribute('aria-hidden', 'true');
  }, [layer, url]);

  if (!url) return null;
  return (
    <ImageOverlay
      ref={overlayRef}
      url={url}
      bounds={FIELD_BOUNDS}
      opacity={1}
      zIndex={250}
      className="weather-map__field"
      eventHandlers={{
        load: event => {
          const element = (event.target as L.ImageOverlay).getElement();
          element?.setAttribute('data-map-layer', layer);
          element?.setAttribute('alt', '');
          element?.setAttribute('aria-hidden', 'true');
        },
      }}
    />
  );
}

const arrowIcon = (plate: number, rotation: number, speed: number) =>
  L.divIcon({
    className: 'weather-map__wind',
    iconSize: [36, 36],
    // Sits just above the province marker instead of under it.
    iconAnchor: [18, 50],
    // Stroke weight grows with speed, so strong wind reads before any number does.
    html: `<span class="weather-map__wind-arrow" data-wind-province="${plate}" data-rotation="${rotation}" style="--wind-rotation:${rotation}deg;--wind-weight:${Math.min(3.2, 1.4 + speed / 8).toFixed(2)}"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 20V5M6.5 10.5 12 5l5.5 5.5"/></svg></span>`,
  });

interface WindLayerProps {
  provinces: Iterable<ProvinceTemperature>;
}

/** One downwind arrow per province with a reported direction. Decorative for assistive tech. */
export function WindLayer({ provinces }: WindLayerProps) {
  const arrows = useMemo(
    () =>
      Array.from(provinces)
        .filter(province => typeof province.windDirection === 'number')
        .map(province => ({
          plate: province.plate,
          position: [province.lat, province.lon] as [number, number],
          icon: arrowIcon(
            province.plate,
            downwindRotation(province.windDirection as number),
            province.windSpeed ?? 0
          ),
        })),
    [provinces]
  );
  return (
    <>
      {arrows.map(arrow => (
        <Marker
          key={`wind-${arrow.plate}`}
          position={arrow.position}
          icon={arrow.icon}
          interactive={false}
          keyboard={false}
          zIndexOffset={-200}
        />
      ))}
    </>
  );
}
