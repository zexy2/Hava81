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
  });
});
