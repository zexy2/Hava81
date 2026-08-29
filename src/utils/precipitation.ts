/**
 * Converts precipitation probability to a 0–1 ratio.
 *
 * The BFF exposes integer percentages (0–100), while some legacy frontend
 * fixtures use fractional ratios strictly between 0 and 1. Treat exactly 1
 * as the BFF's 1% value so a low-probability forecast can never be inflated
 * to 100% in production.
 */
export const normalizePrecipitationProbability = (value: number): number => {
  if (!Number.isFinite(value)) return 0;

  const ratio = value >= 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, ratio));
};

export default normalizePrecipitationProbability;
