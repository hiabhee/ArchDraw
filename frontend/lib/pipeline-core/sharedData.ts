import type { PipelineContext } from './PipelineContext';

/**
 * Branded shared-data keys — avoid stringly `setShared('foo')` sprawl.
 * Domain packages define their keys with `sharedKey<T>('name')`.
 */
export type SharedKey<T> = string & { readonly __type?: T };

export function sharedKey<T>(name: string): SharedKey<T> {
  return name as SharedKey<T>;
}

export function setSharedTyped<T>(
  context: PipelineContext,
  key: SharedKey<T>,
  value: T
): void {
  context.setShared(key, value);
}

export function getSharedTyped<T>(
  context: PipelineContext,
  key: SharedKey<T>
): T | undefined {
  return context.getShared<T>(key);
}
