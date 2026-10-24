import { describe, expect, it, vi } from 'vitest';
import { launchLiveAuditBrowser } from '../../scripts/lib/live-audit-browser.mjs';

describe('live responsive audit browser connection', () => {
  it('connects to an explicit loopback CDP endpoint instead of launching a second browser', async () => {
    const browser = { connected: true };
    const chromium = {
      launch: vi.fn(async () => browser),
      connectOverCDP: vi.fn(async () => browser),
    };

    await expect(launchLiveAuditBrowser(chromium, {
      HAVA81_CHROMIUM_CDP_URL: 'http://127.0.0.1:9222',
      HAVA81_CHROMIUM_EXECUTABLE_PATH: '/snap/bin/chromium',
    })).resolves.toBe(browser);

    expect(chromium.connectOverCDP).toHaveBeenCalledWith('http://127.0.0.1:9222');
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it.each([
    'https://127.0.0.1:9222',
    'http://192.0.2.10:9222',
    'http://127.0.0.1',
    'http://user:secret@127.0.0.1:9222',
    'http://127.0.0.1:9222/json/version',
  ])('rejects unsafe or ambiguous CDP endpoint %s', async endpoint => {
    const chromium = {
      launch: vi.fn(async () => ({ connected: false })),
      connectOverCDP: vi.fn(async () => ({ connected: true })),
    };

    await expect(launchLiveAuditBrowser(chromium, { HAVA81_CHROMIUM_CDP_URL: endpoint }))
      .rejects.toThrow(/loopback HTTP URL with an explicit port/);
    expect(chromium.connectOverCDP).not.toHaveBeenCalled();
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it('preserves the isolated launch path when CDP is not configured', async () => {
    const browser = { connected: true };
    const chromium = {
      launch: vi.fn(async () => browser),
      connectOverCDP: vi.fn(async () => browser),
    };

    await expect(launchLiveAuditBrowser(chromium, {
      HAVA81_CHROMIUM_EXECUTABLE_PATH: '/usr/bin/chromium',
    })).resolves.toBe(browser);

    expect(chromium.launch).toHaveBeenCalledWith({
      timeout: 30_000,
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox'],
    });
    expect(chromium.connectOverCDP).not.toHaveBeenCalled();
  });
});
