import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PREFIX = 'hava81-playwright-';
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const SHUTDOWN_GRACE_MS = 2_000;

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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const baseDir = tmpdir();
await cleanupStaleRuns(baseDir);
const runTmpDir = await mkdtemp(join(baseDir, PREFIX));
const usesProcessGroup = process.platform !== 'win32';

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['playwright', 'test', ...process.argv.slice(2)],
  {
    detached: usesProcessGroup,
    env: { ...process.env, TMPDIR: runTmpDir, TEMP: runTmpDir, TMP: runTmpDir },
    stdio: 'inherit',
  }
);

let forwardedSignal;
let childExited = false;
let resolveChildExit;
const childExitObserved = new Promise(resolve => {
  resolveChildExit = resolve;
});

child.once('exit', () => {
  childExited = true;
  resolveChildExit();
});

function signalChildTree(signal) {
  if (childExited || !child.pid) return;

  try {
    if (usesProcessGroup) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      console.warn(`Unable to forward ${signal} to Playwright: ${error.message}`);
    }
  }
}

const signalHandlers = new Map();
for (const signal of ['SIGINT', 'SIGTERM']) {
  const handler = () => {
    forwardedSignal = signal;
    signalChildTree(signal);
  };
  signalHandlers.set(signal, handler);
  process.on(signal, handler);
}

async function ensureChildStopped() {
  if (childExited || !child.pid) return;

  signalChildTree('SIGTERM');
  await Promise.race([childExitObserved, delay(SHUTDOWN_GRACE_MS)]);
  if (childExited) return;

  signalChildTree('SIGKILL');
  await Promise.race([childExitObserved, delay(SHUTDOWN_GRACE_MS)]);
}

let exitCode;
try {
  exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal && !forwardedSignal) {
        resolve(1);
        return;
      }
      resolve(code ?? (signal ? 1 : 0));
    });
  });
} finally {
  for (const [signal, handler] of signalHandlers) {
    process.off(signal, handler);
  }

  await ensureChildStopped();
  await rm(runTmpDir, { recursive: true, force: true }).catch(error => {
    if (error?.code !== 'ENOENT') {
      console.warn(`Unable to remove Playwright temp directory ${runTmpDir}: ${error.message}`);
    }
  });
}

process.exitCode = exitCode;
