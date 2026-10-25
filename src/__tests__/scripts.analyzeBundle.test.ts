import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
) as { scripts: Record<string, string> };
const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

describe('bundle analysis command', () => {
  it('enables source maps only for analysis builds', () => {
    expect(viteConfig).toContain('sourcemap: process.env.ANALYZE === "true"');
  });

  it('pins the analyzer and emits a gzip-aware TSV report for mapped chunks', () => {
    const command = packageJson.scripts.analyze;
    expect(command).toContain('ANALYZE=true npm run build');
    expect(command).toContain('source-map-explorer@2.5.3');
    expect(command).toContain('--no-border-checks');
    expect(command).toContain('--gzip');
    expect(command).toContain('--tsv dist/bundle-analysis.tsv');
    expect(command).toContain('find dist/assets');
    expect(command).toContain('rolldown-runtime-*.js');
  });
});
