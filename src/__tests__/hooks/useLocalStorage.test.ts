import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLocalStorage } from '../../hooks/useLocalStorage';

describe('useLocalStorage synchronization', () => {
  beforeEach(() => localStorage.clear());

  it('resets other hook consumers when the key is removed', () => {
    const first = renderHook(() => useLocalStorage('shared-pref', ['istanbul'] as string[]));
    const second = renderHook(() => useLocalStorage('shared-pref', ['istanbul'] as string[]));

    act(() => first.result.current[1](['istanbul', 'izmir']));
    expect(second.result.current[0]).toEqual(['istanbul', 'izmir']);

    act(() => first.result.current[2]());

    expect(first.result.current[0]).toEqual(['istanbul']);
    expect(second.result.current[0]).toEqual(['istanbul']);
    expect(localStorage.getItem('shared-pref')).toBeNull();
  });

  it('uses the reset value for an immediate functional update after removal', () => {
    const { result } = renderHook(() => useLocalStorage('counter-pref', 1));

    act(() => result.current[1](5));
    act(() => {
      result.current[2]();
      result.current[1](previous => previous + 1);
    });

    expect(result.current[0]).toBe(2);
    expect(localStorage.getItem('counter-pref')).toBe('2');
  });

  it('treats a native cross-tab removal event as a reset', () => {
    localStorage.setItem('remote-pref', JSON.stringify('dark'));
    const { result } = renderHook(() => useLocalStorage('remote-pref', 'auto'));
    expect(result.current[0]).toBe('dark');

    act(() => {
      localStorage.removeItem('remote-pref');
      window.dispatchEvent(new StorageEvent('storage', { key: 'remote-pref', newValue: null }));
    });

    expect(result.current[0]).toBe('auto');
  });
});
