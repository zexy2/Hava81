import { cityPath } from './cityRoute';

interface ShareDecisionInput {
  cityName: string;
  score: number;
  bestTime?: string;
  umbrella: 'yes' | 'maybe' | 'no';
  language: string;
}

export const buildDecisionShare = ({
  cityName,
  score,
  bestTime,
  umbrella,
  language,
}: ShareDecisionInput) => {
  const path = cityPath(cityName) ?? '/';
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}${path}`
      : `https://hava81.zekiakgul.dev${path}`;
  const tr = language.startsWith('tr');
  const umbrellaText = tr
    ? umbrella === 'yes'
      ? 'Şemsiye: Evet'
      : umbrella === 'maybe'
        ? 'Şemsiye: Yanında olsun'
        : 'Şemsiye: Gerekmez'
    : umbrella === 'yes'
      ? 'Umbrella: Yes'
      : umbrella === 'maybe'
        ? 'Umbrella: Take one'
        : 'Umbrella: Not needed';
  const title = tr ? `${cityName} · Hava81 ${score}/100` : `${cityName} · Hava81 ${score}/100`;
  const text = [
    title,
    bestTime ? (tr ? `En iyi saat: ${bestTime}` : `Best time: ${bestTime}`) : null,
    umbrellaText,
    tr ? 'Havayı değil, gününü planla.' : 'Plan your day, not just the weather.',
    url,
  ]
    .filter(Boolean)
    .join('\n');
  return { title, text, url };
};
