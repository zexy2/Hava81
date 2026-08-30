import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDecisionProfile } from '../../hooks/useDecisionProfile';

describe('useDecisionProfile persistence', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to safe defaults for a wrong-shape persisted profile', () => {
    localStorage.setItem('hava81-decision-profile-v1', JSON.stringify(['walk', 'run']));

    const { result } = renderHook(() => useDecisionProfile());

    expect(result.current.profile).toEqual({
      activities: ['walk', 'run'],
      temperatureSensitivity: 'balanced',
    });
  });

  it('sanitizes activities, sensitivity and clock fields from persisted JSON', () => {
    localStorage.setItem(
      'hava81-decision-profile-v1',
      JSON.stringify({
        activities: ['walk', 'walk', 'laundry', 'run', 'picnic', 'unknown'],
        temperatureSensitivity: 'heat',
        commuteStart: '08:30',
        commuteEnd: '25:00',
        activityStart: '23:15',
        activityEnd: 615,
        unexpected: 'ignored',
      })
    );

    const { result } = renderHook(() => useDecisionProfile());

    expect(result.current.profile).toEqual({
      activities: ['walk', 'laundry', 'run'],
      temperatureSensitivity: 'heat',
      commuteStart: '08:30',
      activityStart: '23:15',
    });
  });

  it('preserves an explicit empty activity selection', () => {
    localStorage.setItem(
      'hava81-decision-profile-v1',
      JSON.stringify({ activities: [], temperatureSensitivity: 'cold' })
    );

    const { result } = renderHook(() => useDecisionProfile());

    expect(result.current.profile).toEqual({
      activities: [],
      temperatureSensitivity: 'cold',
    });
  });

  it('does not silently replace a selected activity when the three-activity limit is reached', () => {
    localStorage.setItem(
      'hava81-decision-profile-v1',
      JSON.stringify({ activities: ['walk', 'run', 'picnic'], temperatureSensitivity: 'balanced' })
    );
    const { result } = renderHook(() => useDecisionProfile());

    act(() => result.current.toggleActivity('motorcycle'));

    expect(result.current.profile.activities).toEqual(['walk', 'run', 'picnic']);
  });

  it('sanitizes cross-tab storage updates before applying them', () => {
    const { result } = renderHook(() => useDecisionProfile());

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'hava81-decision-profile-v1',
          newValue: JSON.stringify({
            activities: ['motorcycle', 'bogus'],
            temperatureSensitivity: 'invalid',
            commuteStart: '07:05',
          }),
        })
      );
    });

    expect(result.current.profile).toEqual({
      activities: ['motorcycle'],
      temperatureSensitivity: 'balanced',
      commuteStart: '07:05',
    });
  });
});
