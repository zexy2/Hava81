import { TURKISH_CITIES, normalizeCitySearchText, type TurkishCity } from '../constants/cities';

const levenshtein = (a: string, b: string): number => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
};

/** Closest province for a failed query ("Şunu mu demek istediniz?"), or null if nothing is close. */
export const suggestCity = (query: string): TurkishCity | null => {
  const q = normalizeCitySearchText(query);
  if (q.length < 2) return null;
  let best: TurkishCity | null = null;
  let bestDistance = Infinity;
  for (const city of TURKISH_CITIES) {
    const name = normalizeCitySearchText(city.name);
    const distance = name.startsWith(q) ? 0 : levenshtein(q, name);
    if (distance < bestDistance) {
      best = city;
      bestDistance = distance;
    }
  }
  const tolerance = Math.max(1, Math.floor(q.length / 3));
  return best && bestDistance <= tolerance ? best : null;
};
