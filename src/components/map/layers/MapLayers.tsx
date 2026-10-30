import React, { useEffect, useMemo } from 'react';
import type { ProvinceTemperature } from '../../../api/weatherService';
import { useMapSurface } from '../mapContext';
import { MapMarker } from '../MapSurface';
import {
  downwindRotation,
  layerSamples,
  type LayerHour,
  type MapLayer,
  type PrecipitationMeasure,
} from './layerModel';
import { FIELD_BOUNDS, renderField } from './renderField';

const FIELD_SOURCE = 'hava81-field';
const FIELD_LAYER = 'hava81-field';

interface FieldLayerProps {
  provinces: Iterable<ProvinceTemperature>;
  layer: MapLayer;
  hour: LayerHour;
  measure?: PrecipitationMeasure;
}

/** Image corners in MapLibre's order: top-left, top-right, bottom-right, bottom-left. */
const fieldCoordinates = (): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] => {
  const [[south, west], [north, east]] = FIELD_BOUNDS;
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
};

/**
 * The drawn field for the active layer: interpolated from the 81-province readings, clipped
 * to the outline, laid over the base map below its labels. It is re-added after a theme
 * change swaps the base style. The same image is mirrored into a hidden, decorative <img>
 * so the field (layer and source) can be inspected without reading WebGL pixels.
 */
export function FieldLayer({ provinces, layer, hour, measure = 'chance' }: FieldLayerProps) {
  const map = useMapSurface();
  const url = useMemo(
    () => renderField(layerSamples(provinces, layer, hour, measure), layer, measure),
    [provinces, layer, hour, measure]
  );

  useEffect(() => {
    if (!map) return undefined;
    const surface = map.getContainer();
    const apply = () => {
      if (!map.isStyleLoaded()) return;
      const existing = map.getSource(FIELD_SOURCE) as
        { updateImage?: (options: { url: string }) => void } | undefined;
      if (!url) {
        if (map.getLayer(FIELD_LAYER)) map.removeLayer(FIELD_LAYER);
        if (existing) map.removeSource(FIELD_SOURCE);
        return;
      }
      if (existing?.updateImage) {
        existing.updateImage({ url });
      } else {
        map.addSource(FIELD_SOURCE, { type: 'image', url, coordinates: fieldCoordinates() });
      }
      if (!map.getLayer(FIELD_LAYER)) {
        // Below the first symbol layer, so place names stay readable over the weather.
        const firstLabel = map.getStyle().layers?.find(item => item.type === 'symbol')?.id;
        map.addLayer(
          {
            id: FIELD_LAYER,
            type: 'raster',
            source: FIELD_SOURCE,
            paint: {
              'raster-opacity': 1,
              'raster-fade-duration': 0,
              'raster-resampling': 'linear',
            },
          },
          firstLabel
        );
      }
    };
    apply();
    map.on('styledata', apply);
    if (url) surface.setAttribute('data-map-layer', layer);
    else surface.removeAttribute('data-map-layer');
    return () => {
      map.off('styledata', apply);
    };
  }, [layer, map, url]);

  useEffect(
    () => () => {
      if (!map) return;
      map.getContainer().removeAttribute('data-map-layer');
      if (!map.getStyle()) return;
      if (map.getLayer(FIELD_LAYER)) map.removeLayer(FIELD_LAYER);
      if (map.getSource(FIELD_SOURCE)) map.removeSource(FIELD_SOURCE);
    },
    [map]
  );

  if (!url) return null;
  return (
    <img
      className="weather-map__field-image"
      src={url}
      alt=""
      aria-hidden="true"
      data-map-layer={layer}
    />
  );
}

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
          lat: province.lat,
          lon: province.lon,
          rotation: downwindRotation(province.windDirection as number),
          // Stroke weight grows with speed, so strong wind reads before any number does.
          weight: Math.min(3.2, 1.4 + (province.windSpeed ?? 0) / 8).toFixed(2),
        })),
    [provinces]
  );
  return (
    <>
      {arrows.map(arrow => (
        <WindArrow key={`wind-${arrow.plate}`} {...arrow} />
      ))}
    </>
  );
}

function WindArrow({
  plate,
  lat,
  lon,
  rotation,
  weight,
}: {
  plate: number;
  lat: number;
  lon: number;
  rotation: number;
  weight: string;
}) {
  const attributes = useMemo(() => ({ 'data-wind-marker': '' }), []);
  return (
    <MapMarker
      lat={lat}
      lon={lon}
      label=""
      className="weather-map__wind"
      // Sits just above the province marker instead of under it.
      anchorOffset={[0, -32]}
      zIndex={1}
      dataAttributes={attributes}
      interactive={false}
    >
      <span
        className="weather-map__wind-arrow"
        data-wind-province={plate}
        data-rotation={rotation}
        style={
          { '--wind-rotation': `${rotation}deg`, '--wind-weight': weight } as React.CSSProperties
        }
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
          <path d="M12 20V5M6.5 10.5 12 5l5.5 5.5" />
        </svg>
      </span>
    </MapMarker>
  );
}
