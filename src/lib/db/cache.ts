/**
 * Simple in-memory TTL cache for slow-changing data like
 * prices, vessels list, and config.
 *
 * Avoids hitting MongoDB on every page load for data that
 * changes at most a few times per day.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Get or set a cached value.
 * If the cache is expired or empty, calls `fetcher` and stores the result.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 5 * 60 * 1000 // default 5 minutes
): Promise<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry && Date.now() < entry.expiresAt) {
    return entry.data;
  }

  const data = await fetcher();
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/**
 * Invalidate a specific cache key (e.g. after saving config).
 */
export function invalidate(key: string): void {
  store.delete(key);
}

/**
 * Clear all cached entries.
 */
export function clearAll(): void {
  store.clear();
}
