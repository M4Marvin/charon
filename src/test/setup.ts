/**
 * jsdom 29 under Node 26 does not expose a working localStorage (Node's
 * experimental implementation requires --localstorage-file). Settings tests
 * need a real, synchronous Storage, so provide a minimal in-memory one when
 * the environment has none.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage === null) {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}

if (typeof window !== "undefined" && (!window.localStorage || window.localStorage === undefined)) {
  try {
    Object.defineProperty(window, "localStorage", {
      get: () => globalThis.localStorage,
      configurable: true,
    });
  } catch {
    // window and globalThis are the same object in jsdom; nothing to do.
  }
}
