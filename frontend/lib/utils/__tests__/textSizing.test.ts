import { describe, it, expect } from 'vitest';
import {
  estimateTextNodeSize,
  estimateAnnotationNodeSize,
  TEXT_LABEL_FONT_SIZE,
  ANNOTATION_FONT_SIZE,
} from '../textSizing';

describe('estimateTextNodeSize', () => {
  it('grows with font size', () => {
    const small = estimateTextNodeSize('Hello World', 'small');
    const heading = estimateTextNodeSize('Hello World', 'heading');
    expect(heading.width).toBeGreaterThan(small.width);
    expect(heading.height).toBeGreaterThan(small.height);
  });

  it('estimates a single-line box at the natural (fit-content) width', () => {
    const { width, height } = estimateTextNodeSize('System Architecture', 'heading');
    expect(width).toBeGreaterThan(60);
    expect(height).toBeLessThanOrEqual(width);
    expect(height).toBeGreaterThan(0);
  });

  it('counts explicit line breaks', () => {
    const one = estimateTextNodeSize('One line');
    const two = estimateTextNodeSize('Line one\nLine two');
    expect(two.height).toBeGreaterThan(one.height);
  });

  it('has a floor for empty text', () => {
    const { width, height } = estimateTextNodeSize('', 'small');
    expect(width).toBeGreaterThanOrEqual(60);
    expect(height).toBeGreaterThan(0);
  });
});

describe('estimateAnnotationNodeSize', () => {
  it('grows with body content', () => {
    const minimal = estimateAnnotationNodeSize('Note');
    const verbose = estimateAnnotationNodeSize('Note', 'A longer body that wraps into several lines');
    expect(verbose.height).toBeGreaterThanOrEqual(minimal.height);
    expect(verbose.width).toBeGreaterThanOrEqual(minimal.width);
  });

  it('respects the annotation min box', () => {
    const { width, height } = estimateAnnotationNodeSize('Note');
    expect(width).toBeGreaterThanOrEqual(180);
    expect(height).toBeGreaterThanOrEqual(80);
  });

  it('keeps the shared font maps in sync with the components', () => {
    expect(TEXT_LABEL_FONT_SIZE.heading).toBe(72);
    expect(TEXT_LABEL_FONT_SIZE.small).toBe(24);
    expect(ANNOTATION_FONT_SIZE.heading).toBe(32);
    expect(ANNOTATION_FONT_SIZE.medium).toBe(24);
  });
});
