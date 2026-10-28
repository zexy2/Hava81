import { useTranslation } from 'react-i18next';
import { useSettings } from '../context';
import type { WindowExplanation } from '../domain/decision/explain';
import { formatNumber } from '../utils/format';

/** One sentence for "why this window?", in the user's language and units. */
export const useWindowWhy = (formatTime: (date: Date) => string) => {
  const { t, i18n } = useTranslation();
  const { convertTemperature, convertWindSpeed, getTemperatureSymbol, getWindSpeedSymbol } =
    useSettings();

  // `window`: why the recommended window wins. `weak`: on an even day, why some hours are weaker.
  return (
    explanation?: WindowExplanation,
    mode: 'window' | 'weak' = 'window'
  ): string | undefined => {
    if (!explanation) return undefined;
    const { factor, worstValue, windowValue } = explanation;
    const time = formatTime(explanation.worstTime);
    const needsValues = factor !== 'air-quality' && factor !== 'severe-weather';
    if (needsValues && (!Number.isFinite(worstValue) || !Number.isFinite(windowValue)))
      return undefined;
    const convert = (value: number) => {
      if (factor === 'thermal') return Math.round(convertTemperature(value));
      if (factor === 'wind') return formatNumber(convertWindSpeed(value), i18n.language);
      return formatNumber(value, i18n.language);
    };
    return t(`hava81.dailyPlan.${mode === 'weak' ? 'whyWeak' : 'why'}.${factor}`, {
      time,
      worst: needsValues ? convert(worstValue as number) : undefined,
      best: needsValues ? convert(windowValue as number) : undefined,
      unit:
        factor === 'thermal'
          ? getTemperatureSymbol()
          : factor === 'wind'
            ? getWindSpeedSymbol()
            : '',
    });
  };
};
