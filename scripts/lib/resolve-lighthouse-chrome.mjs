import { access } from 'node:fs/promises';

/**
 * Prefer an explicit operator override; otherwise use Playwright's managed browser only when
 * it is actually installed. Returning undefined intentionally leaves chrome-launcher's normal
 * system-browser discovery intact for CI images that do not install Playwright browsers.
 */
export async function resolveLighthouseChromePath({
  configuredPath,
  playwrightExecutablePath,
  canAccess = access,
} = {}) {
  if (configuredPath) return configuredPath;
  if (!playwrightExecutablePath) return undefined;

  try {
    await canAccess(playwrightExecutablePath);
    return playwrightExecutablePath;
  } catch {
    return undefined;
  }
}
