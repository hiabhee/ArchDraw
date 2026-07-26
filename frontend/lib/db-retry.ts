const COMPACTION_ERR = /Compaction failed/i;
const MAX_RETRIES = 3;
const BASE_DELAY = 100;

function isCompactionError(err: unknown): boolean {
  return err instanceof Error && COMPACTION_ERR.test(err.message);
}

const WRITE_METHODS = new Set([
  'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany',
]);

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (attempt < MAX_RETRIES - 1 && isCompactionError(err)) {
      const wait = Math.min(BASE_DELAY * Math.pow(2, attempt) + Math.random() * 50, 1000);
      await delay(wait);
      return withRetry(fn, attempt + 1);
    }
    throw err;
  }
}

type PrismaModel = Record<string, (...args: unknown[]) => Promise<unknown>>;

export function createRetryProxy<T extends PrismaModel>(model: T): T {
  return new Proxy(model, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (typeof original === 'function' && WRITE_METHODS.has(prop as string)) {
        return (...args: unknown[]) => withRetry(() => original.apply(target, args));
      }
      return original;
    },
  });
}
