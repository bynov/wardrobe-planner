import type { StorageLike } from './persist';

/** Map-backed `StorageLike` for tests: `mem` is the raw backing store, for asserting on keys. */
export const memStorage = (): StorageLike & { mem: Map<string, string> } => {
  const mem = new Map<string, string>();
  return {
    mem,
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
  };
};
