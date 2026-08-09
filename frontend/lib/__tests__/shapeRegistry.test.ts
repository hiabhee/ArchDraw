import { describe, expect, it } from 'vitest';
import { NODE_SHAPE_CONFIG } from '@/constants/nodeShapeConfig';
import {
  SUPPORTED_SHAPES,
  isDirectiveOnlyShape,
  shapeForServiceType,
  shapeFromServiceConfigKey,
  shapeFromVariant,
} from '@/lib/shapeRegistry';

describe('shapeRegistry', () => {
  it('every NODE_SHAPE_CONFIG entry resolves to a supported ShapeType', () => {
    for (const [key, config] of Object.entries(NODE_SHAPE_CONFIG)) {
      const shape = shapeFromVariant(config.variant);
      expect(SUPPORTED_SHAPES, `variant ${config.variant} (${key}) must resolve`).toContain(shape);
    }
  });

  it('shapeFromServiceConfigKey matches shapeFromVariant for every config key', () => {
    for (const key of Object.keys(NODE_SHAPE_CONFIG)) {
      expect(shapeFromServiceConfigKey(key)).toBe(shapeFromVariant(NODE_SHAPE_CONFIG[key].variant));
    }
  });

  it('unknown or missing variants fall back to rounded-rectangle', () => {
    expect(shapeFromVariant(undefined)).toBe('rounded-rectangle');
    expect(shapeFromVariant('NOT_A_VARIANT')).toBe('rounded-rectangle');
    expect(shapeForServiceType(undefined)).toBe('rounded-rectangle');
    expect(shapeForServiceType('does-not-exist')).toBe('rounded-rectangle');
  });

  it('classifies semantic service types to the new silhouettes', () => {
    expect(shapeForServiceType('loadbalancer')).toBe('hexagon');
    expect(shapeForServiceType('ingress')).toBe('hexagon');
    expect(shapeForServiceType('nginx')).toBe('hexagon');
    expect(shapeForServiceType('waf')).toBe('shield');
    expect(shapeForServiceType('vault')).toBe('shield');
    expect(shapeForServiceType('auth')).toBe('shield');
    expect(shapeForServiceType('external')).toBe('cloud');
    expect(shapeForServiceType('saas')).toBe('cloud');
    expect(shapeForServiceType('browser')).toBe('monitor');
    expect(shapeForServiceType('webapp')).toBe('monitor');
    expect(shapeForServiceType('mobile')).toBe('mobile');
    expect(shapeForServiceType('ios')).toBe('mobile');
    expect(shapeForServiceType('user')).toBe('actor');
    expect(shapeForServiceType('customer')).toBe('actor');
  });

  it('directive-only detection matches the native Mermaid shape set', () => {
    for (const native of ['rectangle', 'rounded-rectangle', 'diamond', 'cylinder', 'circle', 'parallelogram', 'hexagon']) {
      expect(isDirectiveOnlyShape(native)).toBe(false);
    }
    for (const nonNative of ['cloud', 'shield', 'actor', 'monitor', 'mobile', 'dashed-rectangle']) {
      expect(isDirectiveOnlyShape(nonNative)).toBe(true);
    }
    expect(isDirectiveOnlyShape(undefined)).toBe(false);
    expect(isDirectiveOnlyShape('')).toBe(false);
  });

  it('SUPPORTED_SHAPES is deduplicated and covers the canonical set', () => {
    expect(new Set(SUPPORTED_SHAPES).size).toBe(SUPPORTED_SHAPES.length);
    expect(SUPPORTED_SHAPES).toContain('hexagon');
    expect(SUPPORTED_SHAPES).toContain('cloud');
    expect(SUPPORTED_SHAPES).toContain('shield');
    expect(SUPPORTED_SHAPES).toContain('actor');
    expect(SUPPORTED_SHAPES).toContain('monitor');
    expect(SUPPORTED_SHAPES).toContain('mobile');
    expect(SUPPORTED_SHAPES).toContain('dashed-rectangle');
  });
});
