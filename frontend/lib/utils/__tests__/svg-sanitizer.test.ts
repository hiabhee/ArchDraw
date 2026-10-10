import { describe, it, expect } from 'vitest';
import { sanitizeSVG, isValidSVG, sanitizeAndValidateSVG } from '../svg-sanitizer';

describe('svg-sanitizer', () => {
  describe('sanitizeSVG', () => {
    it('should allow valid SVG content', () => {
      const validSVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" /></svg>';
      const result = sanitizeSVG(validSVG);
      expect(result).toContain('<svg');
      expect(result).toContain('<rect');
    });

    it('should remove script tags', () => {
      const maliciousSVG = '<svg><script>alert("XSS")</script><rect /></svg>';
      const result = sanitizeSVG(maliciousSVG);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
      expect(result).toContain('<rect');
    });

    it('should remove onload event handlers', () => {
      const maliciousSVG = '<svg onload="alert(1)"><rect /></svg>';
      const result = sanitizeSVG(maliciousSVG);
      expect(result).not.toContain('onload');
      expect(result).not.toContain('alert');
    });

    it('should remove onclick event handlers', () => {
      const maliciousSVG = '<svg><rect onclick="alert(1)" /></svg>';
      const result = sanitizeSVG(maliciousSVG);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('alert');
    });

    it('should remove javascript: protocol', () => {
      const maliciousSVG = '<svg><a href="javascript:alert(1)"><text>Click</text></a></svg>';
      const result = sanitizeSVG(maliciousSVG);
      expect(result).not.toMatch(/javascript:/i);
    });

    it('should remove data:text/html', () => {
      const maliciousSVG = '<svg><image href="data:text/html,<script>alert(1)</script>" /></svg>';
      const result = sanitizeSVG(maliciousSVG);
      expect(result).not.toMatch(/data:text\/html/i);
    });

    it('should remove iframe elements', () => {
      const maliciousSVG = '<svg><foreignObject><iframe src="evil.com"></iframe></foreignObject></svg>';
      const result = sanitizeSVG(maliciousSVG);
      expect(result).not.toContain('<iframe');
    });

    it('should remove object elements', () => {
      const maliciousSVG = '<svg><foreignObject><object data="evil.swf"></object></foreignObject></svg>';
      const result = sanitizeSVG(maliciousSVG);
      expect(result).not.toContain('<object');
    });

    it('should remove embed elements', () => {
      const maliciousSVG = '<svg><foreignObject><embed src="evil.swf"></embed></foreignObject></svg>';
      const result = sanitizeSVG(maliciousSVG);
      expect(result).not.toContain('<embed');
    });

    it('should remove style elements (potential CSS injection)', () => {
      const maliciousSVG = '<svg><style>body { background: url("javascript:alert(1)") }</style></svg>';
      const result = sanitizeSVG(maliciousSVG);
      expect(result).not.toContain('<style');
    });

    it('should add xmlns if missing', () => {
      const svgWithoutNamespace = '<svg><rect /></svg>';
      const result = sanitizeSVG(svgWithoutNamespace);
      expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('should handle empty string', () => {
      const result = sanitizeSVG('');
      expect(result).toBe('');
    });

    it('should handle null/undefined safely', () => {
      expect(sanitizeSVG(null as unknown as string)).toBe('');
      expect(sanitizeSVG(undefined as unknown as string)).toBe('');
    });

    it('should remove multiple event handlers', () => {
      const maliciousSVG = '<svg onload="a()" onclick="b()"><rect onmouseover="c()" /></svg>';
      const result = sanitizeSVG(maliciousSVG);
      expect(result).not.toContain('onload');
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onmouseover');
    });

    it('should preserve valid SVG attributes', () => {
      const validSVG = '<svg width="100" height="100"><rect x="10" y="10" fill="red" /></svg>';
      const result = sanitizeSVG(validSVG);
      expect(result).toContain('width="100"');
      expect(result).toContain('height="100"');
      expect(result).toContain('fill="red"');
    });

    it('should handle complex Mermaid-generated SVG', () => {
      const mermaidSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300">
        <defs><marker id="arrow"></marker></defs>
        <g class="diagram">
          <rect class="node" x="10" y="10" width="100" height="50" rx="5" />
          <text class="label" x="60" y="35" text-anchor="middle">Node</text>
          <path class="edge" d="M120,35 L200,35" marker-end="url(#arrow)" />
        </g>
      </svg>`;
      const result = sanitizeSVG(mermaidSVG);
      expect(result).toContain('<svg');
      expect(result).toContain('<rect');
      expect(result).toContain('<text');
      expect(result).toContain('<path');
      expect(result).toContain('marker-end');
    });
  });

  describe('isValidSVG', () => {
    it('should return true for valid SVG', () => {
      const validSVG = '<svg><rect /></svg>';
      expect(isValidSVG(validSVG)).toBe(true);
    });

    it('should return false for non-SVG content', () => {
      expect(isValidSVG('<div>Not SVG</div>')).toBe(false);
      expect(isValidSVG('plain text')).toBe(false);
      expect(isValidSVG('')).toBe(false);
    });

    it('should return false for incomplete SVG', () => {
      expect(isValidSVG('<svg>')).toBe(false);
      expect(isValidSVG('</svg>')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isValidSVG(null as unknown as string)).toBe(false);
      expect(isValidSVG(undefined as unknown as string)).toBe(false);
    });
  });

  describe('sanitizeAndValidateSVG', () => {
    it('should return sanitized SVG for valid input', () => {
      const validSVG = '<svg><rect /></svg>';
      const result = sanitizeAndValidateSVG(validSVG);
      expect(result).not.toBeNull();
      expect(result).toContain('<svg');
    });

    it('should return null for invalid SVG after sanitization', () => {
      const invalidSVG = '<div>Not SVG</div>';
      const result = sanitizeAndValidateSVG(invalidSVG);
      expect(result).toBeNull();
    });

    it('should sanitize and validate malicious SVG', () => {
      const maliciousSVG = '<svg onload="alert(1)"><rect /></svg>';
      const result = sanitizeAndValidateSVG(maliciousSVG);
      expect(result).not.toBeNull();
      expect(result).not.toContain('onload');
    });

    it('should return null for empty string', () => {
      const result = sanitizeAndValidateSVG('');
      expect(result).toBeNull();
    });
  });
});
