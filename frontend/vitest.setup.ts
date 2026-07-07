import '@testing-library/jest-dom';

const createStorageMock = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
};

const ensureStorage = (name: 'localStorage' | 'sessionStorage') => {
  const current = window[name] as Storage | undefined;
  if (current && typeof current.getItem === 'function') return;

  Object.defineProperty(window, name, {
    value: createStorageMock(),
    configurable: true,
  });
};

ensureStorage('localStorage');
ensureStorage('sessionStorage');
