/**
 * SVG Sanitization Utility
 *
 * Sanitizes SVG content to prevent XSS attacks while preserving
 * valid SVG markup for diagram rendering.
 *
 * Uses DOMPurify (allow-list based) rather than block-list regexes,
 * which are notoriously bypassable.
 */

import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import logger from '@/lib/logger';

const SANITIZE_CONFIG: Config = {
  // Allow only SVG + filter profiles; drops all HTML elements (foreignObject etc.)
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'foreignObject'],
  FORBID_ATTR: [
    // Event handlers (DOMPurify strips these by default too, but be explicit)
    'onload',
    'onerror',
    'onclick',
    'onmouseover',
    'onfocus',
    'onbegin',
    'onend',
    'onrepeat',
  ],
};

/**
 * Sanitizes SVG content by removing potentially dangerous elements and attributes.
 *
 * @param svg - The SVG string to sanitize
 * @returns Sanitized SVG string ('' on failure)
 */
export function sanitizeSVG(svg: string): string {
  if (!svg || typeof svg !== 'string') {
    return '';
  }

  try {
    // DOMPurify may return a TrustedHTML wrapper in hardened runtimes —
    // coerce to a plain string before string ops.
    const clean = DOMPurify.sanitize(svg, SANITIZE_CONFIG);
    const sanitized = typeof clean === 'string' ? clean : String(clean);

    if (!sanitized) {
      logger.warn('[SVG Sanitizer] DOMPurify produced empty result');
      return '';
    }

    // Ensure SVG has proper namespace
    let withNs = sanitized;
    if (withNs.includes('<svg') && !withNs.includes('xmlns=')) {
      withNs = withNs.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    return withNs;
  } catch (error) {
    logger.error('[SVG Sanitizer] Sanitization failed:', error);
    // On error, return empty string to be safe
    return '';
  }
}

/**
 * Validates that content looks like valid SVG.
 * This is a basic check - not a full validation.
 */
export function isValidSVG(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Basic check: should start with SVG tag
  const trimmed = content.trim();
  return trimmed.startsWith('<svg') && trimmed.includes('</svg>');
}

/**
 * Sanitizes and validates SVG content.
 * Returns null if content is invalid after sanitization.
 */
export function sanitizeAndValidateSVG(svg: string): string | null {
  const sanitized = sanitizeSVG(svg);

  if (!sanitized) {
    logger.warn('[SVG Sanitizer] Sanitization produced empty result');
    return null;
  }

  if (!isValidSVG(sanitized)) {
    logger.warn('[SVG Sanitizer] Content is not valid SVG after sanitization');
    return null;
  }

  return sanitized;
}
