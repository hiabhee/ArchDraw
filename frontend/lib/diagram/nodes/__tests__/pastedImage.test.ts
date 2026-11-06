import { describe, expect, it } from 'vitest';
import { parsePastedImage } from '../pastedImage';

const here = { renderStyle: 'studio-metallic', dark: true };

describe('parsePastedImage', () => {
  it('turns a preview link into an image in the editor look, keeping the link', () => {
    const image = parsePastedImage('https://archdraw.hiabhee.online/share/abcd1234-ef56', here)!;
    expect(image.href).toBe('https://archdraw.hiabhee.online/share/abcd1234-ef56');
    expect(image.src).toContain('/api/diagram/image/abcd1234-ef56?');
    expect(image.src).toContain('style=studio-metallic');
    expect(image.src).toContain('theme=dark');
  });

  it('maps studio-minimal to the studio image style', () => {
    expect(parsePastedImage('https://x.test/share/abcd1234', { renderStyle: 'studio-minimal', dark: false })!.src).toContain('style=studio&');
  });

  it('keeps the look an image link was shared with', () => {
    const image = parsePastedImage('https://x.test/api/diagram/image/abcd1234?style=sketch&theme=light&format=svg', here)!;
    expect(image.src).toContain('style=sketch');
    expect(image.src).toContain('theme=light');
    expect(image.href).toBe('https://x.test/share/abcd1234');
  });

  it('accepts a plain image URL and rejects everything else', () => {
    expect(parsePastedImage('https://cdn.test/pic.png?v=2', here)).toEqual({ src: 'https://cdn.test/pic.png?v=2' });
    expect(parsePastedImage('https://example.com/page', here)).toBeUndefined();
    expect(parsePastedImage('javascript:alert(1)', here)).toBeUndefined();
    expect(parsePastedImage('two words', here)).toBeUndefined();
    expect(parsePastedImage('', here)).toBeUndefined();
  });
});
