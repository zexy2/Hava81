import { parseLoopbackCdpUrl } from './loopback-cdp-url.mjs';


/**
 * Use an already-running loopback Chrome DevTools endpoint on locked-down hosts,
 * otherwise preserve the normal isolated Playwright launch path.
 */
export async function launchLiveAuditBrowser(chromium, env = process.env) {
  const cdpUrl = env.HAVA81_CHROMIUM_CDP_URL?.trim();
  if (cdpUrl) {
    return chromium.connectOverCDP(parseLoopbackCdpUrl(cdpUrl));
  }

  return chromium.launch({
    timeout: 30_000,
    executablePath: env.HAVA81_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: env.HAVA81_CHROMIUM_EXECUTABLE_PATH ? ['--no-sandbox'] : [],
  });
}
