#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const host = '127.0.0.1';
const DEFAULT_PREVIEW_PORT = 4173;
const requestedPreviewPort = Number(process.env.HAVA81_LIGHTHOUSE_PORT);
const port =
  Number.isInteger(requestedPreviewPort) &&
  requestedPreviewPort >= 1024 &&
  requestedPreviewPort <= 65535
    ? requestedPreviewPort
    : DEFAULT_PREVIEW_PORT;
const targetUrl = `http://${host}:${port}/index.html`;
const tempPrefix = 'hava81-lighthouse-';
const staleTempAgeMs = 6 * 60 * 60 * 1000;
const resultDir = '.lighthouse-results';
const resultPath = `${resultDir}/lhr.json`;
const confirmResultPath = `${resultDir}/lhr-confirm.json`;
const lighthouseCli = new URL('../node_modules/lighthouse/cli/index.js', import.meta.url).pathname;
const viteCli = new URL('../node_modules/vite/bin/vite.js', import.meta.url).pathname;

const thresholds = [
  { key: 'performance', floor: 0.6, target: 0.8 },
  { key: 'accessibility', floor: 0.95, target: 1 },
  { key: 'best-practices', floor: 0.95, target: 0.95 },
  { key: 'seo', floor: 0.95, target: 1 },
];

const performanceMetrics = [
  ['first-contentful-paint', 'FCP'],
  ['largest-contentful-paint', 'LCP'],
  ['total-blocking-time', 'TBT'],
  ['cumulative-layout-shift', 'CLS'],
  ['speed-index', 'SI'],
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function cleanupStaleTempRuns(baseDir) {
  const now = Date.now();
  const entries = await readdir(baseDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith(tempPrefix))
      .map(async entry => {
        const path = join(baseDir, entry.name);
        try {
          const metadata = await stat(path);
          if (now - metadata.mtimeMs >= staleTempAgeMs) {
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

async function assertPreviewPortIsFree() {
  const isOccupied = await new Promise(resolve => {
    const socket = connect({ host, port });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });

  if (isOccupied) {
    throw new Error(
      `refusing to run Lighthouse because ${host}:${port} is already in use by another process`
    );
  }
}

async function waitForPreview(preview) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) {
      throw new Error(`preview exited before becoming ready (code ${preview.exitCode})`);
    }
    try {
      const response = await fetch(targetUrl, { redirect: 'manual' });
      if (response.ok) return;
      lastError = new Error(`preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(
    `preview did not become ready: ${lastError instanceof Error ? lastError.message : lastError}`
  );
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? signal}`));
    });
  });
}

async function runLighthouse(outputPath, env) {
  await run(
    process.execPath,
    [
      lighthouseCli,
      targetUrl,
      '--output=json',
      `--output-path=${outputPath}`,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
      '--quiet',
    ],
    { env }
  );
  return JSON.parse(await readFile(outputPath, 'utf8'));
}

async function runLighthouseWithStartupRetry(outputPath, env) {
  try {
    return await runLighthouse(outputPath, env);
  } catch (firstError) {
    // Hosted runners occasionally launch Chrome but fail Lighthouse's first DevTools
    // connection. Retry the measurement process once; score-floor failures are evaluated
    // after a report exists and therefore are never hidden by this infrastructure retry.
    console.warn('Lighthouse process failed before producing a usable report; retrying once.');
    await rm(outputPath, { force: true }).catch(() => undefined);
    await sleep(1_500);
    try {
      return await runLighthouse(outputPath, env);
    } catch (retryError) {
      if (retryError instanceof Error && firstError instanceof Error) {
        retryError.message += ` (first attempt: ${firstError.message})`;
      }
      throw retryError;
    }
  }
}

await assertPreviewPortIsFree();
await rm(resultDir, { recursive: true, force: true });
await mkdir(resultDir, { recursive: true });

const tempBaseDir = tmpdir();
await cleanupStaleTempRuns(tempBaseDir);
const runTempDir = await mkdtemp(join(tempBaseDir, tempPrefix));
const runEnv = { ...process.env, TMPDIR: runTempDir, TEMP: runTempDir, TMP: runTempDir };

const preview = spawn(
  process.execPath,
  [viteCli, 'preview', '--host', host, '--port', String(port)],
  { stdio: 'inherit', env: runEnv }
);

let exitCode = 0;
try {
  await waitForPreview(preview);
  let report = await runLighthouseWithStartupRetry(resultPath, runEnv);
  const performanceThreshold = thresholds.find(threshold => threshold.key === 'performance');
  const firstPerformanceScore = report.categories?.performance?.score;
  if (
    performanceThreshold &&
    typeof firstPerformanceScore === 'number' &&
    firstPerformanceScore < performanceThreshold.floor
  ) {
    console.warn(
      `Lighthouse performance ${Math.round(firstPerformanceScore * 100)} is below the hard floor; ` +
        'running one confirmation measurement to distinguish a persistent regression from runner contention.'
    );
    report = await runLighthouseWithStartupRetry(confirmResultPath, runEnv);
  }
  let hasError = false;
  for (const threshold of thresholds) {
    const score = report.categories?.[threshold.key]?.score;
    if (typeof score !== 'number') {
      console.error(`Lighthouse category ${threshold.key} did not produce a score.`);
      hasError = true;
      continue;
    }
    const percent = Math.round(score * 100);
    const floor = Math.round(threshold.floor * 100);
    const target = Math.round(threshold.target * 100);
    console.log(`Lighthouse ${threshold.key}: ${percent} (floor ${floor}, target ${target})`);
    if (score < threshold.floor) {
      console.error(`ERROR: ${threshold.key} score ${percent} is below hard floor ${floor}`);
      hasError = true;
    } else if (score < threshold.target) {
      console.warn(`WARN: ${threshold.key} score ${percent} is below target ${target}`);
    }
  }

  for (const [auditKey, label] of performanceMetrics) {
    const audit = report.audits?.[auditKey];
    if (!audit) continue;
    const value = audit.displayValue ?? audit.numericValue;
    if (value !== undefined && value !== null) {
      console.log(`Lighthouse metric ${label}: ${value}`);
    }
  }
  if (hasError) exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  exitCode = 1;
} finally {
  preview.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => preview.once('exit', resolve)),
    sleep(2_000).then(() => preview.kill('SIGKILL')),
  ]);
  await rm(runTempDir, { recursive: true, force: true }).catch(error => {
    if (error?.code !== 'ENOENT') {
      console.warn(`Unable to remove Lighthouse temp directory ${runTempDir}: ${error.message}`);
    }
  });
}

process.exitCode = exitCode;
