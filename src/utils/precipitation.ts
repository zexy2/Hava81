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

interface PrecipitationSignal {
  pop: number;
  precipitationMm?: number;
}

export const precipitationSignalSeverity = (probability: number, amount?: number): number => {
  const normalizedProbability = Number.isFinite(probability)
    ? Math.min(1, Math.max(0, probability))
    : 0;
  const normalizedAmount = Number.isFinite(amount) ? Math.max(0, amount as number) : 0;
  return normalizedProbability + normalizedAmount * 0.12;
};

export const pickMostSignificantPrecipitation = <T extends PrecipitationSignal>(
  points: readonly T[]
): T | undefined =>
  points.reduce<T | undefined>((best, point) => {
    if (!best) return point;
    return precipitationSignalSeverity(point.pop, point.precipitationMm) >
      precipitationSignalSeverity(best.pop, best.precipitationMm)
      ? point
      : best;
  }, undefined);

export const formatPrecipitationAmount = (amount: number | undefined, locale: string): string | null => {
  if (!Number.isFinite(amount) || (amount ?? 0) <= 0) return null;

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const value = amount as number;
  return value < 0.1 ? `<${formatter.format(0.1)} mm` : `${formatter.format(value)} mm`;
};

export const formatPrecipitationSummary = (
  probability: number,
  amount: number | undefined,
  locale: string,
  dryText: string
): string => {
  const probabilityPercent = Math.round(Math.min(1, Math.max(0, probability)) * 100);
  const parts: string[] = [];
  if (probabilityPercent > 0) {
    parts.push(locale.startsWith('en') ? `${probabilityPercent}%` : `%${probabilityPercent}`);
  }
  const amountText = formatPrecipitationAmount(amount, locale);
  if (amountText) parts.push(amountText);
  return parts.length ? parts.join(' · ') : dryText;
};

export default normalizePrecipitationProbability;
