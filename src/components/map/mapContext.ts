import type { Map as MapLibreMap } from 'maplibre-gl';
import { createContext, useContext } from 'react';

export const MapContext = createContext<MapLibreMap | null>(null);

/** The live map for children; null until the style has loaded. */
export const useMapSurface = () => useContext(MapContext);
