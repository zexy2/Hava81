import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type {
  ActivityKind,
  DecisionProfile,
  TemperatureSensitivity,
} from '../domain/activity/types';
import { trackProductEvent } from '../analytics/productEvents';

const DEFAULT_PROFILE: DecisionProfile = {
  activities: ['walk', 'run'],
  temperatureSensitivity: 'balanced',
};

export function useDecisionProfile() {
  const [profile, setProfile] = useLocalStorage<DecisionProfile>(
    'hava81-decision-profile-v1',
    DEFAULT_PROFILE
  );
  const toggleActivity = useCallback(
    (activity: ActivityKind) => {
      setProfile(current => {
        const exists = current.activities.includes(activity);
        const activities = exists
          ? current.activities.filter(item => item !== activity)
          : current.activities.length >= 3
            ? [...current.activities.slice(1), activity]
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
  const setCommuteTime = useCallback(
    (kind: 'start' | 'end', value?: string) => {
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
    setCommuteTime,
    clearCommuteTimes,
    setActivityWindow,
    clearActivityWindow,
  };
}
