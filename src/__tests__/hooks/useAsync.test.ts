import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { useAsync } from '../../hooks/useAsync';
import { ErrorCode } from '../../types';

describe('useAsync', () => {
  it('does not expose raw unexpected error messages', async () => {
    await i18n.changeLanguage('en');
    const rawMessage = 'provider secret token=abc123';
    const { result } = renderHook(() =>
      useAsync(async () => {
        throw new Error(rawMessage);
      })
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error?.code).toBe(ErrorCode.UNKNOWN);
    expect(result.current.error?.message).toBe(i18n.t('errors.genericError'));
    expect(result.current.error?.message).not.toContain(rawMessage);
    expect(result.current.error?.retryable).toBe(true);
  });
  it('keeps injected data authoritative over an older in-flight request', async () => {
    let resolveNetwork!: (value: string) => void;
    const networkPromise = new Promise<string>(resolve => {
      resolveNetwork = resolve;
    });
    const { result } = renderHook(() => useAsync(() => networkPromise));

    let pending!: Promise<string | null>;
    act(() => {
      pending = result.current.execute();
    });
    act(() => {
      result.current.setData('cached');
    });
    await act(async () => {
      resolveNetwork('stale-network');
      await pending;
    });

    expect(result.current.data).toBe('cached');
    expect(result.current.status).toBe('success');
    expect(result.current.isLoading).toBe(false);
  });

  it('marks injected cached data as a successful settled state', () => {
    const { result } = renderHook(() => useAsync(async () => 'network'));

    act(() => {
      result.current.setData('cached');
    });

    expect(result.current.data).toBe('cached');
    expect(result.current.status).toBe('success');
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isIdle).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
