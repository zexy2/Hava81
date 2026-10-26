import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type {
  ActivityKind,
  DecisionProfile,
  TemperatureSensitivity,
} from '../domain/activity/types';
import type { PersonalTolerance, WeatherTolerance } from '../domain/plan/types';
import { trackProductEvent } from '../analytics/productEvents';

const DEFAULT_PROFILE: DecisionProfile = {
  activities: ['walk', 'run'],
  temperatureSensitivity: 'balanced',
};

const ACTIVITY_KINDS: readonly ActivityKind[] = [
  'walk',
  'run',
  'picnic',
  'children',
  'motorcycle',
  'laundry',
];
const TEMPERATURE_SENSITIVITIES: readonly TemperatureSensitivity[] = ['cold', 'balanced', 'heat'];
const WEATHER_TOLERANCES: readonly WeatherTolerance[] = ['low', 'normal', 'high'];
const CLOCK_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const isActivityKind = (value: unknown): value is ActivityKind =>
  typeof value === 'string' && ACTIVITY_KINDS.includes(value as ActivityKind);
const isTemperatureSensitivity = (value: unknown): value is TemperatureSensitivity =>
  typeof value === 'string' && TEMPERATURE_SENSITIVITIES.includes(value as TemperatureSensitivity);
const isWeatherTolerance = (value: unknown): value is WeatherTolerance =>
  typeof value === 'string' && WEATHER_TOLERANCES.includes(value as WeatherTolerance);
const isClockTime = (value: unknown): value is string =>
  typeof value === 'string' && CLOCK_TIME_PATTERN.test(value);

const deserializeDecisionProfile = (serialized: string): DecisionProfile => {
  const parsed = JSON.parse(serialized) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_PROFILE;

  const candidate = parsed as Partial<Record<keyof DecisionProfile, unknown>>;
  let activities = DEFAULT_PROFILE.activities;
  if (Array.isArray(candidate.activities)) {
    const validActivities = candidate.activities.filter(isActivityKind);
    const uniqueActivities = [...new Set(validActivities)].slice(0, 3);
    activities =
      candidate.activities.length === 0 || uniqueActivities.length > 0
        ? uniqueActivities
        : DEFAULT_PROFILE.activities;
  }

  return {
    activities,
    temperatureSensitivity: isTemperatureSensitivity(candidate.temperatureSensitivity)
      ? candidate.temperatureSensitivity
      : DEFAULT_PROFILE.temperatureSensitivity,
    ...(isClockTime(candidate.commuteStart) ? { commuteStart: candidate.commuteStart } : {}),
    ...(isClockTime(candidate.commuteEnd) ? { commuteEnd: candidate.commuteEnd } : {}),
    ...(isClockTime(candidate.activityStart) ? { activityStart: candidate.activityStart } : {}),
    ...(isClockTime(candidate.activityEnd) ? { activityEnd: candidate.activityEnd } : {}),
    ...(isWeatherTolerance(candidate.windTolerance)
      ? { windTolerance: candidate.windTolerance }
      : {}),
    ...(isWeatherTolerance(candidate.rainTolerance)
      ? { rainTolerance: candidate.rainTolerance }
      : {}),
    ...(candidate.pollenAllergy === true ? { pollenAllergy: true } : {}),
  };
};

export function useDecisionProfile() {
  const [profile, setProfile] = useLocalStorage<DecisionProfile>(
    'hava81-decision-profile-v1',
    DEFAULT_PROFILE,
    { deserializer: deserializeDecisionProfile }
  );
  const toggleActivity = useCallback(
    (activity: ActivityKind) => {
      setProfile(current => {
        const exists = current.activities.includes(activity);
        if (!exists && current.activities.length >= 3) return current;
        const activities = exists
          ? current.activities.filter(item => item !== activity)
          : [...current.activities, activity];
        trackProductEvent('activity_preference_changed', {
          activity,
          selected: !exists,
          activities,
        });
        return { ...current, activities };
      });
    },
    [setProfile]
  );
  const setTemperatureSensitivity = useCallback(
    (temperatureSensitivity: TemperatureSensitivity) => {
      setProfile(current => ({ ...current, temperatureSensitivity }));
      trackProductEvent('temperature_sensitivity_changed', { temperatureSensitivity });
    },
    [setProfile]
  );
  const setTolerance = useCallback(
    (kind: 'wind' | 'rain', value: WeatherTolerance) => {
      const key = kind === 'wind' ? 'windTolerance' : 'rainTolerance';
      setProfile(current => ({ ...current, [key]: value }));
      trackProductEvent('weather_tolerance_changed', { kind, value });
    },
    [setProfile]
  );
  const setPollenAllergy = useCallback(
    (pollenAllergy: boolean) => {
      setProfile(current => ({ ...current, pollenAllergy }));
      trackProductEvent('pollen_allergy_changed', { pollenAllergy });
    },
    [setProfile]
  );
  const setCommuteTime = useCallback(
    (kind: 'start' | 'end', value?: string) => {
      if (value !== undefined && !isClockTime(value)) return;
      const key = kind === 'start' ? 'commuteStart' : 'commuteEnd';
      setProfile(current => ({ ...current, [key]: value }));
      trackProductEvent('commute_schedule_changed', { kind, value: value ?? null });
    },
    [setProfile]
  );
  const clearCommuteTimes = useCallback(() => {
    setProfile(current => ({ ...current, commuteStart: undefined, commuteEnd: undefined }));
    trackProductEvent('commute_schedule_cleared');
  }, [setProfile]);
  const setActivityWindow = useCallback(
    (kind: 'start' | 'end', value?: string) => {
      if (value !== undefined && !isClockTime(value)) return;
      const key = kind === 'start' ? 'activityStart' : 'activityEnd';
      setProfile(current => ({ ...current, [key]: value }));
      trackProductEvent('activity_window_changed', { kind, value: value ?? null });
    },
    [setProfile]
  );
  const clearActivityWindow = useCallback(() => {
    setProfile(current => ({ ...current, activityStart: undefined, activityEnd: undefined }));
    trackProductEvent('activity_window_cleared');
  }, [setProfile]);
  return {
    profile,
    toggleActivity,
    setTemperatureSensitivity,
    setTolerance,
    setPollenAllergy,
    setCommuteTime,
    clearCommuteTimes,
    setActivityWindow,
    clearActivityWindow,
  };
}

/** The profile's comfort tolerances in the shape the scorers expect. */
export const toleranceOf = (profile: DecisionProfile): PersonalTolerance => ({
  wind: profile.windTolerance,
  rain: profile.rainTolerance,
  pollenAllergy: profile.pollenAllergy === true,
});
