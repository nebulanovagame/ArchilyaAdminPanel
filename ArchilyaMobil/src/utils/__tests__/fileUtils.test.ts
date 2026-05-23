/// <reference types="jest" />

import { formatFileSize, isImageFileLike, resolveFileExtension } from '../fileUtils';

describe('fileUtils helpers', () => {
  it('resolves file extension from name, mime and hint', () => {
    expect(resolveFileExtension('render.PNG')).toBe('png');
    expect(resolveFileExtension('', 'application/pdf')).toBe('pdf');
    expect(resolveFileExtension('', '', 'dwg')).toBe('dwg');
  });

  it('formats file sizes predictably', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('detects image-like files', () => {
    expect(isImageFileLike({ type: 'image/png', name: 'gorsel.png' })).toBe(true);
    expect(isImageFileLike({ mimeType: 'application/pdf', name: 'plan.pdf' })).toBe(false);
    expect(isImageFileLike({ name: 'cephe.webp' })).toBe(true);
  });
});
