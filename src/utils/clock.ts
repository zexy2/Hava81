export const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Digits typed in any common way ("830", "0830", "8:30", "08.30") → "08:30", or null. */
export function normalizeClock(raw: string): string | null {
  const text = raw.trim().replace(/[.,\s]/g, ':');
  if (CLOCK_PATTERN.test(text)) return text;
  const digits = text.replace(/\D/g, '');
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [hours, minutes] = text.split(':');
    const candidate = `${hours.padStart(2, '0')}:${minutes}`;
    return CLOCK_PATTERN.test(candidate) ? candidate : null;
  }
  if (digits.length === 3 || digits.length === 4) {
    const candidate = `${digits.slice(0, -2).padStart(2, '0')}:${digits.slice(-2)}`;
    return CLOCK_PATTERN.test(candidate) ? candidate : null;
  }
  if (digits.length === 1 || digits.length === 2) {
    const candidate = `${digits.padStart(2, '0')}:00`;
    return CLOCK_PATTERN.test(candidate) ? candidate : null;
  }
  return null;
}
