import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type NotificationClickEvent = {
  notification: { close: () => void; data?: { url?: string } };
  waitUntil: (promise: Promise<unknown>) => void;
};

async function runNotificationClick({
  targetUrl,
  windows = [],
  matchAllError,
}: {
  targetUrl?: string;
  windows?: Array<Record<string, unknown>>;
  matchAllError?: Error;
}) {
  const source = readFileSync('public/sw.js', 'utf8');
  const listeners = new Map<string, (event: NotificationClickEvent) => void>();
  const openWindow = vi.fn().mockResolvedValue({ opened: true });
  const matchAll = matchAllError
    ? vi.fn().mockRejectedValue(matchAllError)
    : vi.fn().mockResolvedValue(windows);

  runInNewContext(source, {
    self: {
      location: { origin: 'https://hava81.example' },
      clients: { matchAll, openWindow },
      skipWaiting: vi.fn(),
      addEventListener: (name: string, listener: (event: NotificationClickEvent) => void) => {
        listeners.set(name, listener);
      },
    },
    URL,
    Set,
    Error,
  });

  const close = vi.fn();
  let clickPromise: Promise<unknown> | undefined;
  listeners.get('notificationclick')?.({
    notification: {
      close,
      data: targetUrl ? { url: targetUrl } : undefined,
    },
    waitUntil: promise => {
      clickPromise = promise;
    },
  });

  if (!clickPromise) throw new Error('The notification-click handler did not register waitUntil');
  return { result: await clickPromise, close, matchAll, openWindow };
}

describe('service worker notification clicks', () => {
  it('navigates and focuses an existing Hava81 window using the intended route state', async () => {
    const navigate = vi.fn().mockResolvedValue(undefined);
    const focused = { focused: true };
    const focus = vi.fn().mockResolvedValue(focused);
    const { result, close, matchAll, openWindow } = await runNotificationClick({
      targetUrl: '/izmir/?view=map#forecast',
      windows: [{ navigate, focus }],
    });

    expect(close).toHaveBeenCalledOnce();
    expect(matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true });
    expect(navigate).toHaveBeenCalledWith('/izmir/?view=map#forecast');
    expect(focus).toHaveBeenCalledOnce();
    expect(result).toBe(focused);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens the safe app root if client enumeration fails and the target is cross-origin', async () => {
    const { result, close, matchAll, openWindow } = await runNotificationClick({
      targetUrl: 'https://outside.example/redirect?secret=1',
      matchAllError: new Error('client enumeration unavailable'),
    });

    expect(close).toHaveBeenCalledOnce();
    expect(matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true });
    expect(openWindow).toHaveBeenCalledWith('/');
    expect(result).toEqual({ opened: true });
  });

  it('opens the intended route when an existing client cannot be navigated', async () => {
    const navigate = vi.fn().mockRejectedValue(new Error('stale client'));
    const focus = vi.fn().mockResolvedValue(undefined);
    const { close, openWindow } = await runNotificationClick({
      targetUrl: '/istanbul/?view=plan',
      windows: [{ navigate, focus }],
    });

    expect(close).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/istanbul/?view=plan');
    expect(focus).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith('/istanbul/?view=plan');
  });

  it('opens the intended route when an existing client cannot be focused', async () => {
    const navigate = vi.fn().mockResolvedValue(undefined);
    const focus = vi.fn().mockRejectedValue(new Error('focus denied'));
    const { close, openWindow } = await runNotificationClick({
      targetUrl: '/izmir/?view=map',
      windows: [{ navigate, focus }],
    });

    expect(close).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/izmir/?view=map');
    expect(focus).toHaveBeenCalledOnce();
    expect(openWindow).toHaveBeenCalledWith('/izmir/?view=map');
  });

  it('falls back to the app root for malformed notification URLs', async () => {
    const { openWindow } = await runNotificationClick({
      targetUrl: 'http://[::1',
      windows: [],
    });

    expect(openWindow).toHaveBeenCalledWith('/');
  });
});
