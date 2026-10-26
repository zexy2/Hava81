import { describe, expect, it, vi } from 'vitest';
import { RequestTimeoutError, fetchJsonResponse } from '../../../scripts/lib/decision-gate-http.mjs';

describe('decision-gate JSON request bounds', () => {
  it('returns the response and parsed body so the caller can apply status policy', async () => {
    const response = {
      ok: false,
      status: 429,
      headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? '17' : null) },
      json: async () => ({ error: { code: 'PROVIDER_RATE_LIMITED' } }),
    } as unknown as Response;
    const fetchImpl = vi.fn(async () => response);

    const result = await fetchJsonResponse('https://fixture.invalid/weather', { fetchImpl });

    expect(result.response.status).toBe(429);
    expect(result.response.headers.get('retry-after')).toBe('17');
    expect(result.body).toEqual({ error: { code: 'PROVIDER_RATE_LIMITED' } });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://fixture.invalid/weather',
      expect.objectContaining({ headers: { accept: 'application/json' }, signal: expect.any(Object) })
    );
  });

  it('aborts a stalled network request within the configured timeout', async () => {
    let receivedSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      receivedSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        receivedSignal?.addEventListener('abort', () => reject(new Error('Aborted')), {
          once: true,
        });
      });
    });

    const error = await fetchJsonResponse('https://fixture.invalid/stalled', { timeoutMs: 20, fetchImpl }).then(
      () => null,
      (reason: unknown) => reason
    );
    expect(error).toBeInstanceOf(RequestTimeoutError);
    expect(error).toMatchObject({ message: 'request timed out after 20ms', timeoutMs: 20 });
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('normalizes a body-read abort to the configured timeout error', async () => {
    let receivedSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      receivedSignal = init?.signal as AbortSignal;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () =>
          new Promise<never>((_resolve, reject) => {
            receivedSignal?.addEventListener('abort', () => reject(new Error('aborted body')), { once: true });
          }),
      } as unknown as Response;
    });

    await expect(
      fetchJsonResponse('https://fixture.invalid/abort-body', { timeoutMs: 20, fetchImpl })
    ).rejects.toThrow('request timed out after 20ms');
  });

  it('also bounds JSON body decoding after the response headers arrive', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => new Promise<never>(() => undefined),
    } as unknown as Response;
    const fetchImpl = vi.fn(async () => response);

    await expect(
      fetchJsonResponse('https://fixture.invalid/stalled-body', { timeoutMs: 20, fetchImpl })
    ).rejects.toThrow('request timed out after 20ms');
  });

  it('rejects invalid timeout values instead of silently disabling the bound', async () => {
    await expect(fetchJsonResponse('https://fixture.invalid', { timeoutMs: 0, fetchImpl: vi.fn() })).rejects.toThrow(
      'timeoutMs must be between 1 and 60000'
    );
    await expect(fetchJsonResponse('https://fixture.invalid', { timeoutMs: 60_001, fetchImpl: vi.fn() })).rejects.toThrow(
      'timeoutMs must be between 1 and 60000'
    );
  });
});
