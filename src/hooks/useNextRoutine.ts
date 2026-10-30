import { useEffect, useMemo, useState } from 'react';
import type { TemperatureSensitivity } from '../domain/activity/types';
import type { PersonalTolerance } from '../domain/plan/types';
import { evaluateRoutine, type RoutineEvaluation } from '../domain/routines/evaluateRoutine';
import type { Routine } from '../domain/routines/types';
import type {
  AirQuality,
  AirQualityHourly,
  ContextSignals,
  HourlyForecast,
  NormalizedWeatherData,
} from '../types';
import { ROUTINES_CHANGED_EVENT, ROUTINES_KEY, loadRoutines } from '../storage/routineStore';

export interface NextRoutineInput {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
  contextSignals?: ContextSignals | null;
  sensitivity: TemperatureSensitivity;
  tolerance: PersonalTolerance;
}

/**
 * The soonest scored plan, for a "your next plan" card outside Planla (Today page, widgets).
 * Read-only: editing stays in Planla.
 */
export function useNextRoutine(
  input: NextRoutineInput | null
): { routine: Routine; evaluation: Extract<RoutineEvaluation, { status: 'scored' }> } | null {
  // Re-read when plans change here or in another tab.
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const bump = () => setRevision(value => value + 1);
    const onStorage = (event: StorageEvent) => {
      if (event.key === ROUTINES_KEY) bump();
    };
    window.addEventListener(ROUTINES_CHANGED_EVENT, bump);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ROUTINES_CHANGED_EVENT, bump);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return useMemo(() => {
    void revision;
    if (!input || input.hourly.length === 0) return null;
    const now = new Date();
    let best: {
      routine: Routine;
      evaluation: Extract<RoutineEvaluation, { status: 'scored' }>;
    } | null = null;
    for (const routine of loadRoutines()) {
      const evaluation = evaluateRoutine(routine, { ...input, now });
      if (evaluation.status !== 'scored') continue;
      if (!best || evaluation.occurrence.startMs < best.evaluation.occurrence.startMs) {
        best = { routine, evaluation };
      }
    }
    return best;
  }, [input, revision]);
}
