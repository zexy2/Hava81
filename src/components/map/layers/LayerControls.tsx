import { useTranslation } from 'react-i18next';
import {
  LAYER_HOURS,
  MAP_LAYERS,
  layerHasOutlook,
  type LayerHour,
  type MapLayer,
} from './layerModel';

const GLYPHS: Record<MapLayer, string> = {
  precipitation: 'M12 3.5c-3.2 4.3-5.5 7.6-5.5 10.4a5.5 5.5 0 0 0 11 0c0-2.8-2.3-6.1-5.5-10.4Z',
  temperature: 'M10 4.5a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0Z M12 10v6',
  wind: 'M3.5 9h11a2.5 2.5 0 1 0-2.5-2.5 M3.5 13h15a2.5 2.5 0 1 1-2.5 2.5 M3.5 17h7',
  cloud: 'M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 10.3 3.9 3.9 0 0 0 7 18Z',
};

interface LayerControlsProps {
  layer: MapLayer;
  hour: LayerHour;
  onLayerChange: (layer: MapLayer) => void;
  onHourChange: (hour: LayerHour) => void;
  /** No province readings to draw from: the controls explain instead of pretending. */
  unavailable: boolean;
}

/** The layer switch, the time scrubber for forecast layers, and a quiet fallback note. */
export function LayerControls({
  layer,
  hour,
  onLayerChange,
  onHourChange,
  unavailable,
}: LayerControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="map-layers">
      <div className="map-layers__switch" role="group" aria-label={t('weather.mapLayers.label')}>
        {MAP_LAYERS.map(item => (
          <button
            key={item}
            type="button"
            className="map-layers__option"
            aria-pressed={layer === item}
            onClick={() => onLayerChange(item)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path d={GLYPHS[item]} />
            </svg>
            <span>{t(`weather.mapLayers.${item}`)}</span>
          </button>
        ))}
      </div>
      {layerHasOutlook(layer) && !unavailable ? (
        <div className="map-layers__time" role="group" aria-label={t('weather.mapLayers.time')}>
          {LAYER_HOURS.map(item => (
            <button
              key={item}
              type="button"
              className="map-layers__step"
              aria-pressed={hour === item}
              onClick={() => onHourChange(item)}
            >
              {item === 0
                ? t('weather.mapLayers.now')
                : t('weather.mapLayers.ahead', { hours: item })}
            </button>
          ))}
        </div>
      ) : null}
      {unavailable ? (
        <p className="map-layers__note" role="status">
          {t('weather.mapLayers.unavailable')}
        </p>
      ) : null}
    </div>
  );
}
