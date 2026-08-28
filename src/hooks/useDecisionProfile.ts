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
  return { profile, toggleActivity, setTemperatureSensitivity };
}
