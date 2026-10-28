#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { resolveLighthouseChromePath } from './lib/resolve-lighthouse-chrome.mjs';
import { resolveLighthouseTargetUrl } from './lib/lighthouse-target-url.mjs';
import { resolveLoopbackCdpPort } from './lib/loopback-cdp-url.mjs';
import {
  assertLighthouseWeatherReady,
  withLighthouseWeatherReadinessConfirmation,
} from './lib/lighthouse-weather-readiness.mjs';
import {
  medianAuditNumericValue,
  medianCategoryScore,
  shouldRepeatPerformanceMeasurement,
} from './lib/lighthouse-performance-confirmation.mjs';

const host = '127.0.0.1';
const DEFAULT_PREVIEW_PORT = 4173;
const requestedPreviewPort = Number(process.env.HAVA81_LIGHTHOUSE_PORT);
const port =
  Number.isInteger(requestedPreviewPort) &&
  requestedPreviewPort >= 1024 &&
  requestedPreviewPort <= 65535
    ? requestedPreviewPort
    : DEFAULT_PREVIEW_PORT;
const targetUrl = resolveLighthouseTargetUrl(
  process.env.HAVA81_LIGHTHOUSE_PATH,
  `http://${host}:${port}`
);
const cdpPort = process.env.HAVA81_CHROMIUM_CDP_URL?.trim()
  ? resolveLoopbackCdpPort(process.env.HAVA81_CHROMIUM_CDP_URL.trim())
  : undefined;
if (cdpPort === port) {
  throw new Error('HAVA81_CHROMIUM_CDP_URL port must differ from the local Lighthouse preview port.');
}
const tempPrefix = 'hava81-lighthouse-';
const staleTempAgeMs = 6 * 60 * 60 * 1000;
const resultDir = '.lighthouse-results';
const resultPath = `${resultDir}/lhr.json`;
const weatherConfirmResultPath = `${resultDir}/lhr-weather-confirm.json`;
const performanceRepeatResultPath = `${resultDir}/lhr-performance-repeat.json`;
const performanceRepeatWeatherConfirmResultPath = `${resultDir}/lhr-performance-weather-confirm.json`;
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

function printCategoryAuditFailures(report, categoryKey) {
  const auditRefs = report.categories?.[categoryKey]?.auditRefs ?? [];
  const seen = new Set();
  for (const auditRef of auditRefs) {
    if (!(auditRef.weight > 0) || seen.has(auditRef.id)) continue;
    seen.add(auditRef.id);
    const audit = report.audits?.[auditRef.id];
    if (!audit || typeof audit.score !== 'number' || audit.score >= 1) continue;
    const score = Math.round(audit.score * 100);
    const detail = audit.displayValue ? ` — ${audit.displayValue}` : '';
    console.error(`  failing audit ${auditRef.id}: ${score} — ${audit.title}${detail}`);
  }
}

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
      ...(cdpPort
        ? [`--port=${cdpPort}`]
        : ['--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage']),
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
let chromePath;
if (!cdpPort) {
  let playwrightExecutablePath;
  if (!process.env.CHROME_PATH) {
    try {
      const { chromium } = await import('playwright');
      playwrightExecutablePath = chromium.executablePath();
    } catch {
      // Playwright is optional for this fallback: keep chrome-launcher's normal discovery.
    }
  }
  chromePath = await resolveLighthouseChromePath({
    configuredPath: process.env.CHROME_PATH,
    playwrightExecutablePath,
  });
  if (chromePath && !process.env.CHROME_PATH) {
    console.log(`[lighthouse] using installed Playwright Chromium: ${chromePath}`);
  }
} else {
  console.log(`[lighthouse] connecting to existing loopback Chrome DevTools port ${cdpPort}`);
}
const runEnv = {
  ...process.env,
  TMPDIR: runTempDir,
  TEMP: runTempDir,
  TMP: runTempDir,
};
if (cdpPort) {
  delete runEnv.CHROME_PATH;
} else if (chromePath) {
  runEnv.CHROME_PATH = chromePath;
}

const preview = spawn(
  process.execPath,
  [viteCli, 'preview', '--host', host, '--port', String(port)],
  { stdio: 'inherit', env: runEnv }
);

let exitCode = 0;
try {
  console.log(`[lighthouse] target ${targetUrl}`);
  await waitForPreview(preview);
  const report = await withLighthouseWeatherReadinessConfirmation(
    await runLighthouseWithStartupRetry(resultPath, runEnv),
    async () => {
      console.warn(
        'Lighthouse did not observe real current weather on the first measurement; retrying readiness once with a fresh report.'
      );
      await sleep(1_500);
      return runLighthouseWithStartupRetry(weatherConfirmResultPath, runEnv);
    }
  );
  assertLighthouseWeatherReady(report);
  const performanceThreshold = thresholds.find(threshold => threshold.key === 'performance');
  const performanceReports = [report];
  const firstPerformanceScore = report.categories?.performance?.score;
  if (
    performanceThreshold &&
    shouldRepeatPerformanceMeasurement(firstPerformanceScore, performanceThreshold.target)
  ) {
    console.warn(
      `Lighthouse performance ${(firstPerformanceScore * 100).toFixed(1)} is below target ${Math.round(performanceThreshold.target * 100)}; ` +
        'running one confirmation measurement and using the median score to reduce runner-contention noise.'
    );
    const repeatReport = await withLighthouseWeatherReadinessConfirmation(
      await runLighthouseWithStartupRetry(performanceRepeatResultPath, runEnv),
      async () => {
        console.warn(
          'Lighthouse performance confirmation did not observe real current weather; retrying readiness once with a fresh report.'
        );
        await sleep(1_500);
        return runLighthouseWithStartupRetry(performanceRepeatWeatherConfirmResultPath, runEnv);
      }
    );
    assertLighthouseWeatherReady(repeatReport);
    const repeatScore = repeatReport.categories?.performance?.score;
    if (typeof repeatScore !== 'number' || !Number.isFinite(repeatScore)) {
      throw new Error('Lighthouse performance confirmation did not produce a valid category score.');
    }
    performanceReports.push(repeatReport);
  }
  const performanceScoreMedian = medianCategoryScore(performanceReports, 'performance');
  if (performanceScoreMedian === null) {
    throw new Error('Lighthouse did not produce a valid performance score for the usable report.');
  }
  const performanceDiagnosticReport = performanceReports.reduce((lowest, candidate) => {
    const candidateScore = candidate.categories?.performance?.score;
    const lowestScore = lowest.categories?.performance?.score;
    return typeof candidateScore === 'number' &&
      (typeof lowestScore !== 'number' || candidateScore < lowestScore)
      ? candidate
      : lowest;
  }, performanceReports[0]);
  if (performanceReports.length > 1) {
    const sampleScores = performanceReports.map(item =>
      (item.categories.performance.score * 100).toFixed(1)
    );
    console.log(
      `Lighthouse performance samples: ${sampleScores.join(', ')}; median ${(performanceScoreMedian * 100).toFixed(1)}`
    );
  }
  let hasError = false;
  for (const threshold of thresholds) {
    const score = threshold.key === 'performance'
      ? performanceScoreMedian
      : report.categories?.[threshold.key]?.score;
    if (typeof score !== 'number') {
      console.error(`Lighthouse category ${threshold.key} did not produce a score.`);
      hasError = true;
      continue;
    }
    const percent = threshold.key === 'performance'
      ? (score * 100).toFixed(1)
      : Math.round(score * 100);
    const floor = Math.round(threshold.floor * 100);
    const target = Math.round(threshold.target * 100);
    console.log(`Lighthouse ${threshold.key}: ${percent} (floor ${floor}, target ${target})`);
    if (score < threshold.floor) {
      console.error(`ERROR: ${threshold.key} score ${percent} is below hard floor ${floor}`);
      printCategoryAuditFailures(
        threshold.key === 'performance' ? performanceDiagnosticReport : report,
        threshold.key
      );
      hasError = true;
    } else if (score < threshold.target) {
      console.warn(`WARN: ${threshold.key} score ${percent} is below target ${target}`);
    }
  }

  const formatMetricValue = (auditKey, value) => {
    if (!Number.isFinite(value)) return 'unknown';
    if (auditKey === 'cumulative-layout-shift') return value.toFixed(3);
    if (auditKey === 'total-blocking-time') return `${Math.round(value)} ms`;
    return `${(value / 1000).toFixed(2)} s`;
  };
  for (const [auditKey, label] of performanceMetrics) {
    const audit = report.audits?.[auditKey];
    if (!audit) continue;
    const value = audit.displayValue ?? audit.numericValue;
    if (performanceReports.length > 1) {
      const sampleValues = performanceReports.map(item => item.audits?.[auditKey]?.numericValue);
      const medianValue = medianAuditNumericValue(performanceReports, auditKey);
      if (sampleValues.every(sample => typeof sample === 'number' && Number.isFinite(sample)) && medianValue !== null) {
        const samples = sampleValues.map((sample, index) =>
          `sample ${index + 1} ${formatMetricValue(auditKey, sample)}`
        ).join(', ');
        console.log(
          `Lighthouse metric ${label}: ${samples}; median ${formatMetricValue(auditKey, medianValue)}`
        );
        continue;
      }
    }
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
