import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const runner = resolve('scripts/run-playwright.mjs');
const cleanupRoots: string[] = [];

const run = (
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> =>
  new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [runner, ...args], {
      env,
      stdio: 'ignore',
    });
    child.once('error', reject);
    child.once('close', (code, signal) => resolveRun({ code, signal }));
  });

async function makeTempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'hava81-runner-test-'));
  cleanupRoots.push(root);
  return root;
}

async function runnerTempDirs(root: string) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory() && entry.name.startsWith('hava81-playwright-'));
}

async function waitForFile(path: string, timeoutMs = 5_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await new Promise(resolveWait => setTimeout(resolveWait, 25));
    }
  }
  throw new Error(`Timed out waiting for ${path}`);
}

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('Playwright temp runner', () => {
  it('removes its temp directory when Playwright cannot spawn', async () => {
    const root = await makeTempRoot();
    const result = await run(['--list'], {
      ...process.env,
      PATH: '/definitely-missing-hava81-path',
      TMPDIR: root,
      TEMP: root,
      TMP: root,
    });

    expect(result.code).not.toBe(0);
    expect(await runnerTempDirs(root)).toHaveLength(0);
  });

  it.skipIf(process.platform === 'win32')('forwards SIGTERM to the child process group and cleans temp', async () => {
    const root = await makeTempRoot();
    const bin = join(root, 'bin');
    const parentPidFile = join(root, 'fake-parent.pid');
    const childPidFile = join(root, 'fake-child.pid');
    const parentSignalFile = join(root, 'fake-parent.signal');
    const childSignalFile = join(root, 'fake-child.signal');
    await mkdir(bin);

    const fakeChild = join(bin, 'fake-child');
    await writeFile(
      fakeChild,
      [
        '#!/bin/sh',
        `printf '%s' "$$" > "$FAKE_CHILD_PID"`,
        `trap 'printf "%s" TERM > "$FAKE_CHILD_SIGNAL"; exit 0' TERM`,
        `trap 'printf "%s" INT > "$FAKE_CHILD_SIGNAL"; exit 0' INT`,
        'while :; do sleep 1; done',
        '',
      ].join('\n')
    );
    await chmod(fakeChild, 0o755);

    const fakeNpx = join(bin, 'npx');
    await writeFile(
      fakeNpx,
      [
        '#!/bin/sh',
        `printf '%s' "$$" > "$FAKE_PARENT_PID"`,
        `trap 'printf "%s" TERM > "$FAKE_PARENT_SIGNAL"; exit 0' TERM`,
        `trap 'printf "%s" INT > "$FAKE_PARENT_SIGNAL"; exit 0' INT`,
        '"$FAKE_CHILD" &',
        'wait',
        '',
      ].join('\n')
    );
    await chmod(fakeNpx, 0o755);

    const wrapper = spawn(process.execPath, [runner, '--list'], {
      env: {
        ...process.env,
        PATH: `${bin}:/usr/bin:/bin`,
        TMPDIR: root,
        TEMP: root,
        TMP: root,
        FAKE_PARENT_PID: parentPidFile,
        FAKE_CHILD_PID: childPidFile,
        FAKE_PARENT_SIGNAL: parentSignalFile,
        FAKE_CHILD_SIGNAL: childSignalFile,
        FAKE_CHILD: fakeChild,
      },
      stdio: 'ignore',
    });

    const parentPid = Number((await waitForFile(parentPidFile)).trim());
    const childPid = Number((await waitForFile(childPidFile)).trim());
    expect(parentPid).toBeGreaterThan(0);
    expect(childPid).toBeGreaterThan(0);

    const wrapperClosed = new Promise<void>((resolveClose, reject) => {
      wrapper.once('error', reject);
      wrapper.once('close', () => resolveClose());
    });
    wrapper.kill('SIGTERM');

    const [parentSignal, childSignal] = await Promise.all([
      waitForFile(parentSignalFile),
      waitForFile(childSignalFile),
      wrapperClosed,
    ]);

    expect(parentSignal).toBe('TERM');
    expect(childSignal).toBe('TERM');
    expect(await runnerTempDirs(root)).toHaveLength(0);
  }, 12_000);
});
