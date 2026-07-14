/**
 * Converts precipitation probability to a 0–1 ratio.
 *
 * The BFF exposes percentages (0–100), while older frontend fixtures and
 * OpenWeather payloads use ratios (0–1). Keeping the adapter tolerant makes
 * the UI deterministic during migrations and prevents values such as 500%.
 */
export const normalizePrecipitationProbability = (value: number): number => {
  if (!Number.isFinite(value)) return 0;

  const ratio = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, ratio));
};

export default normalizePrecipitationProbability;
