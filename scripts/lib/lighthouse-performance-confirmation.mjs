export function shouldRepeatPerformanceMeasurement(score, target = 0.8) {
  return Number.isFinite(score) && Number.isFinite(target) && score < target;
}

export function median(values) {
  const sorted = values
    .filter(value => typeof value === 'number' && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function medianCategoryScore(reports, categoryKey) {
  return median(reports.map(report => report?.categories?.[categoryKey]?.score));
}

export function medianAuditNumericValue(reports, auditKey) {
  return median(reports.map(report => report?.audits?.[auditKey]?.numericValue));
}
