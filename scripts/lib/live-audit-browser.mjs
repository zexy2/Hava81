const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function parseLoopbackCdpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('HAVA81_CHROMIUM_CDP_URL must be a valid loopback HTTP URL with an explicit port.');
  }

  if (
    url.protocol !== 'http:' ||
    !LOOPBACK_HOSTS.has(url.hostname) ||
    !url.port ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error('HAVA81_CHROMIUM_CDP_URL must be a loopback HTTP URL with an explicit port; remote CDP endpoints are not allowed.');
  }

  return url.origin;
}

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
