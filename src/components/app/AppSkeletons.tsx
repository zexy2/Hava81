import type { Ref } from 'react';

/** Loading skeletons for the app shell (first load and the lazy forecast card). */

export const AtlasLoadingState = ({
  label,
  slowMessage,
}: {
  label: string;
  slowMessage?: string;
}) => (
  <div className="atlas-loading" role="status" aria-live="polite" aria-atomic="true">
    <div className="atlas-loading__copy">
      <p className="atlas-loading__status">{label}</p>
      {slowMessage ? <p className="atlas-loading__notice">{slowMessage}</p> : null}
    </div>
    <section className="atlas-loading__decision" aria-hidden="true">
      <div className="atlas-loading__line atlas-loading__line--short" />
      <div className="atlas-loading__temperature" />
      <div className="atlas-loading__line" />
      <div className="atlas-loading__signal" />
      <div className="atlas-loading__rail" />
    </section>
    <section className="atlas-loading__forecast" aria-hidden="true">
      <div className="atlas-loading__line atlas-loading__line--short" />
      <div className="atlas-loading__chart" />
      <div className="atlas-loading__rows" />
    </section>
  </div>
);

// Keep the forecast column visible both while the API responds and while
// the split ForecastAtlas bundle is being downloaded on a cold connection.
export const ForecastLoadingCard = ({
  title,
  label,
  anchorRef,
  onActivate,
  reserveLoadedHeight = false,
}: {
  title: string;
  label: string;
  anchorRef?: Ref<HTMLElement>;
  onActivate?: () => void;
  /**
   * Data is in and only the chart is deferred: hold the loaded atlas's space so it can arrive
   * without pushing the sections below. API loading / error placeholders stay compact.
   */
  reserveLoadedHeight?: boolean;
}) => (
  <section
    ref={anchorRef}
    className={`atlas-forecast-loading atlas-forecast-loading--card${
      reserveLoadedHeight ? ' atlas-forecast-loading--deferred' : ''
    }`}
    role="status"
    aria-live="polite"
    onPointerDown={onActivate}
    onFocusCapture={onActivate}
  >
    <h2 className="atlas-forecast-loading__title">{title}</h2>
    <span className="sr-only">{label}</span>
    <div className="atlas-loading__line atlas-loading__line--short" aria-hidden="true" />
    <div className="atlas-loading__chart" aria-hidden="true" />
    <div className="atlas-loading__rows" aria-hidden="true" />
  </section>
);
