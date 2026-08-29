#!/usr/bin/env node
import { mkdir, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import process from 'node:process';

const host = '127.0.0.1';
const DEFAULT_PREVIEW_PORT = 4173;
const requestedPreviewPort = Number(process.env.HAVA81_LIGHTHOUSE_PORT);
const port =
  Number.isInteger(requestedPreviewPort) && requestedPreviewPort >= 1024 && requestedPreviewPort <= 65535
    ? requestedPreviewPort
    : DEFAULT_PREVIEW_PORT;
const targetUrl = `http://${host}:${port}/index.html`;
const resultDir = '.lighthouse-results';
const resultPath = `${resultDir}/lhr.json`;
const lighthouseCli = new URL('../node_modules/lighthouse/cli/index.js', import.meta.url).pathname;
const viteCli = new URL('../node_modules/vite/bin/vite.js', import.meta.url).pathname;

const thresholds = [
  { key: 'performance', minimum: 0.75, level: 'warn' },
  { key: 'accessibility', minimum: 0.9, level: 'error' },
  { key: 'best-practices', minimum: 0.85, level: 'warn' },
  { key: 'seo', minimum: 0.85, level: 'warn' },
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

await assertPreviewPortIsFree();
await rm(resultDir, { recursive: true, force: true });
await mkdir(resultDir, { recursive: true });

const preview = spawn(
  process.execPath,
  [viteCli, 'preview', '--host', host, '--port', String(port)],
  { stdio: 'inherit', env: process.env }
);

let exitCode = 0;
try {
  await waitForPreview(preview);
  await run(
    process.execPath,
    [
      lighthouseCli,
      targetUrl,
      '--output=json',
      `--output-path=${resultPath}`,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
      '--quiet',
    ],
    { env: process.env }
  );

  const report = JSON.parse(await readFile(resultPath, 'utf8'));
  let hasError = false;
  for (const threshold of thresholds) {
    const score = report.categories?.[threshold.key]?.score;
    if (typeof score !== 'number') {
      console.error(`Lighthouse category ${threshold.key} did not produce a score.`);
      hasError = true;
      continue;
    }
    const percent = Math.round(score * 100);
    const minimum = Math.round(threshold.minimum * 100);
    console.log(
      `Lighthouse ${threshold.key}: ${percent} (minimum ${minimum}, ${threshold.level})`
    );
    if (score < threshold.minimum) {
      const message = `${threshold.key} score ${percent} is below ${minimum}`;
      if (threshold.level === 'error') {
        console.error(`ERROR: ${message}`);
        hasError = true;
      } else {
        console.warn(`WARN: ${message}`);
      }
    }
  }
  if (hasError) exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  exitCode = 1;
} finally {
  preview.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => preview.once('exit', resolve)),
    sleep(2_000).then(() => preview.kill('SIGKILL')),
  ]);
}

process.exitCode = exitCode;
