/**
 * SVG Sanitization Utility
 * 
 * Sanitizes SVG content to prevent XSS attacks while preserving
 * valid SVG markup for diagram rendering.
 * 
 * NOTE: This is a basic sanitizer focused on removing script tags
 * and dangerous event handlers. For production systems with untrusted
 * SVG content, consider using a library like DOMPurify.
 */

import logger from '@/lib/logger';

/**
 * List of dangerous SVG elements that can execute scripts
 */
const DANGEROUS_ELEMENTS = [
  'script',
  'iframe',
  'object',
  'embed',
  'link',
  'style', // style can contain CSS expressions in older browsers
];

/**
 * Event handler attributes that can execute JavaScript
 */
const DANGEROUS_ATTRIBUTES = [
  'onload',
  'onerror',
  'onclick',
  'onmouseover',
  'onmouseout',
  'onmousemove',
  'onmousedown',
  'onmouseup',
  'onfocus',
  'onblur',
  'onchange',
  'onsubmit',
  'onkeydown',
  'onkeyup',
  'onkeypress',
  'onanimationstart',
  'onanimationend',
  'ontransitionend',
  'onbegin',
  'onend',
  'onrepeat',
];

/**
 * Patterns that might indicate JavaScript execution attempts
 */
const DANGEROUS_PATTERNS = [
  /javascript:/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
  /<script/gi,
  /expression\(/gi, // CSS expressions
  /import\s+/gi, // CSS @import
];

/**
 * Sanitizes SVG content by removing potentially dangerous elements and attributes.
 * 
 * @param svg - The SVG string to sanitize
 * @returns Sanitized SVG string
 */
export function sanitizeSVG(svg: string): string {
  if (!svg || typeof svg !== 'string') {
    return '';
  }

  try {
    let sanitized = svg;

    // First, remove dangerous elements (including their content)
    // This must happen before pattern removal to avoid leaving content behind
    for (const element of DANGEROUS_ELEMENTS) {
      // Match opening tag to closing tag with content
      const fullElementPattern = new RegExp(`<${element}[^>]*>.*?</${element}>`, 'gis');
      const selfClosingPattern = new RegExp(`<${element}[^>]*/>`, 'gi');
      
      if (fullElementPattern.test(sanitized) || selfClosingPattern.test(sanitized)) {
        logger.warn(`[SVG Sanitizer] Removed dangerous element: ${element}`);
        sanitized = sanitized.replace(fullElementPattern, '');
        sanitized = sanitized.replace(selfClosingPattern, '');
      }
    }

    // Then check for dangerous patterns in remaining content
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        logger.warn('[SVG Sanitizer] Detected dangerous pattern:', pattern.source);
        sanitized = sanitized.replace(pattern, '');
      }
    }

    // Remove dangerous attributes
    for (const attr of DANGEROUS_ATTRIBUTES) {
      const attrPattern = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      if (attrPattern.test(sanitized)) {
        logger.warn(`[SVG Sanitizer] Removed dangerous attribute: ${attr}`);
        sanitized = sanitized.replace(attrPattern, '');
      }
    }

    // Remove any remaining suspicious event handlers (catch-all)
    const eventHandlerPattern = /\son\w+\s*=\s*["'][^"']*["']/gi;
    sanitized = sanitized.replace(eventHandlerPattern, '');

    // Ensure SVG has proper namespace (helps prevent some attacks)
    if (sanitized.includes('<svg') && !sanitized.includes('xmlns=')) {
      sanitized = sanitized.replace(
        /<svg/,
        '<svg xmlns="http://www.w3.org/2000/svg"'
      );
    }

    return sanitized;
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
