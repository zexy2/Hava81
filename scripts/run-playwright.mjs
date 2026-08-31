import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PREFIX = 'hava81-playwright-';
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

async function cleanupStaleRuns(baseDir) {
  const now = Date.now();
  const entries = await readdir(baseDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith(PREFIX))
      .map(async entry => {
        const path = join(baseDir, entry.name);
        try {
          const metadata = await stat(path);
          if (now - metadata.mtimeMs >= STALE_AFTER_MS) {
            await rm(path, { recursive: true, force: true });
          }
        } catch (error) {
          if (error?.code !== 'ENOENT' && error?.code !== 'EACCES' && error?.code !== 'EPERM') {
            throw error;
          }
        }
      })
  );
}

const baseDir = tmpdir();
await cleanupStaleRuns(baseDir);
const runTmpDir = await mkdtemp(join(baseDir, PREFIX));

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['playwright', 'test', ...process.argv.slice(2)],
  {
    env: { ...process.env, TMPDIR: runTmpDir, TEMP: runTmpDir, TMP: runTmpDir },
    stdio: 'inherit',
  }
);

let forwardedSignal;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    forwardedSignal = signal;
    if (!child.killed) child.kill(signal);
  });
}

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    if (signal && !forwardedSignal) {
      resolve(1);
      return;
    }
    resolve(code ?? (signal ? 1 : 0));
  });
});

await rm(runTmpDir, { recursive: true, force: true }).catch(error => {
  if (error?.code !== 'ENOENT') {
    console.warn(`Unable to remove Playwright temp directory ${runTmpDir}: ${error.message}`);
  }
});

process.exitCode = exitCode;
