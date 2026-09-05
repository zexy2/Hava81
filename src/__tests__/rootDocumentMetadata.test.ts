import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOT_DOCUMENT_METADATA } from '../utils/rootDocumentMetadata';

describe('root document metadata contract', () => {
  it('keeps the SPA root restoration aligned with the static root shell', () => {
    const index = readFileSync('index.html', 'utf8');

    expect(index).toContain(`<title>${ROOT_DOCUMENT_METADATA.title}</title>`);
    expect(index).toContain(`content="${ROOT_DOCUMENT_METADATA.description}"`);
    expect(index).toContain(`content="${ROOT_DOCUMENT_METADATA.socialDescription}"`);
  });
});
