import { readFileSync } from 'node:fs';

/**
 * Reads a stylesheet for the regex-based style tests without its cascade-layer
 * wrapper (`@layer components { … }`, Faz 2.1) and the indentation it adds, so
 * selectors and declarations read as they are written.
 */
export function readCss(path: string): string {
  const lines = readFileSync(path, 'utf8').split('\n');
  const start = lines.findIndex(line => /^@layer [\w.-]+ \{$/.test(line));
  if (start === -1) return lines.join('\n');
  let end = lines.length - 1;
  while (end > start && lines[end].trim() === '') end--;
  if (lines[end] !== '}') return lines.join('\n');
  const body = lines.slice(start + 1, end).map(line => line.replace(/^ {2}/, ''));
  return [...lines.slice(0, start), ...body, ...lines.slice(end + 1)].join('\n');
}
