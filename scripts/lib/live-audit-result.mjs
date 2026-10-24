/** Build deterministic errors for one responsive live-audit case. */
export function buildLiveAuditErrors({
  metrics,
  expectedCity,
  language,
  theme,
  width,
  pageErrors = [],
  weatherFailures = [],
}) {
  if (!metrics) return ['Responsive metrics unavailable'];

  return [
    ...(metrics.city !== expectedCity ? [`Expected ${expectedCity}, got ${metrics.city}`] : []),
    ...(metrics.language !== language ? [`Expected language ${language}, got ${metrics.language}`] : []),
    ...(metrics.theme !== theme ? [`Expected theme ${theme}, got ${metrics.theme}`] : []),
    ...(metrics.forecastState !== 'ready' ? [`Forecast ${metrics.forecastState}: final chart not available`] : []),
    ...(metrics.documentWidth > width + 1 ? [`Horizontal overflow: ${metrics.documentWidth}px > ${width}px`] : []),
    ...Object.entries(metrics.overlaps || {})
      .filter(([, area]) => area > 1)
      .map(([name, area]) => `${name} overlap: ${area}px²`),
    ...[...new Set(weatherFailures)].map(failure => `Weather API: ${failure}`),
    ...pageErrors.map(error => `JavaScript: ${error}`),
  ];
}
