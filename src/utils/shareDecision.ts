import type { Hava81ScoreBand } from '../domain/decision/types';
import { cityPath } from './cityRoute';

interface ShareDecisionInput {
  cityName: string;
  score: number;
  band: Hava81ScoreBand;
  bestTime?: string;
  umbrella: 'yes' | 'maybe' | 'no';
  recommendation?: string;
  language: string;
}

export const buildDecisionShare = ({
  cityName,
  score,
  band,
  bestTime,
  umbrella,
  recommendation,
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
  const bandText = tr
    ? { excellent: 'Çok uygun', good: 'Uygun', caution: 'Dikkat', difficult: 'Zorlayıcı' }[band]
    : { excellent: 'Very suitable', good: 'Suitable', caution: 'Caution', difficult: 'Difficult' }[band];
  const title = `${cityName} · Hava81 ${score}/100 · ${bandText}`;
  const text = [
    title,
    recommendation ? (tr ? `Öneri: ${recommendation}` : `Recommendation: ${recommendation}`) : null,
    bestTime ? (tr ? `En uygun zaman: ${bestTime}` : `Best window: ${bestTime}`) : null,
    umbrellaText,
    tr ? 'Havayı değil, gününü planla.' : 'Plan your day, not just the weather.',
  ]
    .filter(Boolean)
    .join('\n');
  const clipboardText = `${text}\n${url}`;
  return { title, text, url, clipboardText };
};
