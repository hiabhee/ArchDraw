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

  it('classifies semantic service types to the existing silhouettes', () => {
    expect(shapeForServiceType('loadbalancer')).toBe('hexagon');
    expect(shapeForServiceType('ingress')).toBe('hexagon');
    expect(shapeForServiceType('nginx')).toBe('hexagon');
    expect(shapeForServiceType('external')).toBe('cloud');
    expect(shapeForServiceType('saas')).toBe('cloud');
    expect(shapeForServiceType('browser')).toBe('monitor');
    expect(shapeForServiceType('webapp')).toBe('monitor');
    expect(shapeForServiceType('mobile')).toBe('mobile');
    expect(shapeForServiceType('ios')).toBe('mobile');
    expect(shapeForServiceType('user')).toBe('actor');
    expect(shapeForServiceType('customer')).toBe('actor');
  });

  it('classifies all new queue-type services to queue shape', () => {
    for (const svc of ['queue', 'kafka', 'rabbitmq', 'sqs', 'sns', 'pubsub', 'eventbus', 'nats', 'kinesis']) {
      expect(shapeForServiceType(svc), `${svc} should be queue`).toBe('queue');
    }
  });

  it('classifies all new cache-type services to cache shape', () => {
    for (const svc of ['cache', 'redis', 'memcached', 'elasticache', 'cdn', 'varnish']) {
      expect(shapeForServiceType(svc), `${svc} should be cache`).toBe('cache');
    }
  });

  it('classifies all new function-type services to function shape', () => {
    for (const svc of ['function', 'lambda', 'cloudfunction', 'cloudfunctions', 'edgeworker', 'worker', 'scheduler', 'cronjob']) {
      expect(shapeForServiceType(svc), `${svc} should be function`).toBe('function');
    }
  });

  it('classifies all new container-type services to container shape', () => {
    for (const svc of ['docker', 'container', 'pod', 'kubernetes', 'k8s', 'deployment']) {
      expect(shapeForServiceType(svc), `${svc} should be container`).toBe('container');
    }
  });

  it('classifies all new bucket-type services to bucket shape', () => {
    for (const svc of ['storage', 'objectstorage', 'object-storage', 's3', 'gcs', 'blob', 'azureblob', 'minio']) {
      expect(shapeForServiceType(svc), `${svc} should be bucket`).toBe('bucket');
    }
  });

  it('directive-only detection matches the native Mermaid shape set', () => {
    for (const native of ['rectangle', 'rounded-rectangle', 'diamond', 'cylinder', 'circle', 'parallelogram', 'hexagon']) {
      expect(isDirectiveOnlyShape(native)).toBe(false);
    }
    for (const nonNative of ['cloud', 'actor', 'monitor', 'mobile', 'dashed-rectangle', 'queue', 'cache', 'function', 'container', 'bucket']) {
      expect(isDirectiveOnlyShape(nonNative)).toBe(true);
    }
    expect(isDirectiveOnlyShape(undefined)).toBe(false);
    expect(isDirectiveOnlyShape('')).toBe(false);
  });

  it('SUPPORTED_SHAPES is deduplicated and covers the canonical set', () => {
    expect(new Set(SUPPORTED_SHAPES).size).toBe(SUPPORTED_SHAPES.length);
    expect(SUPPORTED_SHAPES).toContain('hexagon');
    expect(SUPPORTED_SHAPES).toContain('cloud');
    expect(SUPPORTED_SHAPES).toContain('actor');
    expect(SUPPORTED_SHAPES).toContain('monitor');
    expect(SUPPORTED_SHAPES).toContain('mobile');
    expect(SUPPORTED_SHAPES).toContain('dashed-rectangle');
    // New architecture-native shapes
    expect(SUPPORTED_SHAPES).toContain('queue');
    expect(SUPPORTED_SHAPES).toContain('cache');
    expect(SUPPORTED_SHAPES).toContain('function');
    expect(SUPPORTED_SHAPES).toContain('container');
    expect(SUPPORTED_SHAPES).toContain('bucket');
  });

  it('new shapes resolve correctly from VARIANT_TO_SHAPE', () => {
    expect(shapeFromVariant('QUEUE')).toBe('queue');
    expect(shapeFromVariant('CACHE')).toBe('cache');
    expect(shapeFromVariant('FUNCTION')).toBe('function');
    expect(shapeFromVariant('CONTAINER')).toBe('container');
    expect(shapeFromVariant('BUCKET')).toBe('bucket');
  });
});
