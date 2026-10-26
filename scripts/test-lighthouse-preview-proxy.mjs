import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('..', import.meta.url).pathname;
const viteCli = join(root, 'node_modules/vite/bin/vite.js');
const tempDir = await mkdtemp(join(tmpdir(), 'hava81-lighthouse-proxy-'));
const distDir = join(tempDir, 'dist');
await mkdir(distDir, { recursive: true });
await writeFile(join(distDir, 'index.html'), '<!doctype html><html><body>preview-ok</body></html>');

let observedPath;
const api = createServer((request, response) => {
  observedPath = request.url;
  response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify({ status: 'ready', path: request.url }));
});
await new Promise((resolve, reject) => {
  api.once('error', reject);
  api.listen(0, '127.0.0.1', resolve);
});
const apiAddress = api.address();
assert.ok(apiAddress && typeof apiAddress === 'object');

const reserve = createServer();
await new Promise((resolve, reject) => {
  reserve.once('error', reject);
  reserve.listen(0, '127.0.0.1', resolve);
});
const previewAddress = reserve.address();
assert.ok(previewAddress && typeof previewAddress === 'object');
const previewPort = previewAddress.port;
await new Promise(resolve => reserve.close(resolve));

const preview = spawn(
  process.execPath,
  [viteCli, 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort', '--outDir', distDir],
  {
    cwd: root,
    env: {
      ...process.env,
      HAVA81_PREVIEW_API_PROXY_TARGET: `http://127.0.0.1:${apiAddress.port}`,
    },
    stdio: 'ignore',
  }
);

try {
  const deadline = Date.now() + 10_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) throw new Error(`Vite preview exited early (${preview.exitCode})`);
    try {
      const response = await fetch(`http://127.0.0.1:${previewPort}/`);
      if (response.ok && (await response.text()).includes('preview-ok')) {
        ready = true;
        break;
      }
    } catch {
      // Wait for the local preview listener to bind.
    }
    await delay(100);
  }
  assert.equal(ready, true, 'Vite preview should serve the temporary shell');

  const response = await fetch(`http://127.0.0.1:${previewPort}/api/v1/health/ready`);
  assert.equal(response.status, 200, 'same-origin API request should be proxied');
  assert.deepEqual(await response.json(), { status: 'ready', path: '/api/v1/health/ready' });
  assert.equal(observedPath, '/api/v1/health/ready', 'proxy must preserve the API path');
  console.log('Lighthouse preview API proxy contract: PASS');
} finally {
  preview.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => preview.once('exit', resolve)),
    delay(2_000).then(() => preview.kill('SIGKILL')),
  ]);
  await new Promise(resolve => api.close(resolve));
  await rm(tempDir, { recursive: true, force: true });
}
