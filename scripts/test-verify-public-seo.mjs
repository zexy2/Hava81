import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { provinceNamesBySlug } from './lib/live-audit-city-catalog.mjs';

const script = fileURLToPath(new URL('./verify-public-seo.mjs', import.meta.url));

async function runFixture({ wrongCanonical = false, badSitemap = false, temporaryFailure = false } = {}) {
  const attempts = new Map();
  let base;
  const server = createServer((req, res) => {
    const path = req.url?.split('?')[0] || '/';
    const seen = (attempts.get(path) || 0) + 1;
    attempts.set(path, seen);
    if (path === '/izmir/' && temporaryFailure && seen === 1) {
      res.writeHead(503);
      res.end('try again');
      return;
    }
    const title = name => name + ' hava durumu ve gün planı — Hava81';
    const document = (name, url) =>
      '<!doctype html><html><head><title>' + title(name) + '</title>' +
      '<link rel="canonical" href="' + url + '">' +
      '<script type="application/ld+json">' + JSON.stringify({
        url, name: title(name), about: { name },
      }) + '</script></head><body>Weather</body></html>';
    res.setHeader('Content-Type', path.endsWith('.xml') ? 'application/xml' : 'text/html; charset=utf-8');
    if (path === '/') { res.end(document('Hava81', base + '/')); return; }
    if (path === '/sitemap.xml') {
      const urls = [base + '/', ...[...provinceNamesBySlug.keys()].map(slug => base + '/' + slug + '/')];
      if (badSitemap) urls.pop();
      res.end('<urlset>' + urls.map(url => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>');
      return;
    }
    const slug = path.slice(1, -1);
    const name = provinceNamesBySlug.get(slug);
    if (!name) { res.writeHead(404); res.end('missing'); return; }
    res.end(document(name, base + '/' + (wrongCanonical && slug === 'izmir' ? 'wrong' : slug) + '/'));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port;
  try {
    const child = spawn(process.execPath, [script], { env: {
      ...process.env,
      HAVA81_PUBLIC_URL: base,
      HAVA81_PUBLIC_SEO_ATTEMPTS: '2',
      HAVA81_PUBLIC_SEO_TIMEOUT_MS: '2000',
    } });
    const chunks = [];
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', chunk => chunks.push(chunk.toString()));
    }
    const [exitCode] = await once(child, 'exit');
    return { exitCode, output: chunks.join(''), attempts };
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('validates 81 published provinces, homepage and sitemap', async () => {
  const result = await runFixture();
  assert.equal(result.exitCode, 0, result.output);
  assert.match(result.output, /81 province pages/);
  assert.equal(result.attempts.size, 83);
});
test('rejects a wrong published city canonical URL', async () => {
  const result = await runFixture({ wrongCanonical: true });
  assert.notEqual(result.exitCode, 0);
  assert.match(result.output, /izmir: Canonical URL mismatch/);
});
test('rejects a missing published sitemap entry', async () => {
  const result = await runFixture({ badSitemap: true });
  assert.notEqual(result.exitCode, 0);
  assert.match(result.output, /sitemap:/);
});
test('retries a transient 503 without masking the result', async () => {
  const result = await runFixture({ temporaryFailure: true });
  assert.equal(result.exitCode, 0, result.output);
  assert.equal(result.attempts.get('/izmir/'), 2);
});
