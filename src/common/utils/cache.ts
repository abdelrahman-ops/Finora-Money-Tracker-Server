interface CacheEntry {
  data: any;
  expiresAt: number;
}

const cacheMap = new Map<string, CacheEntry>();

export function getCacheKey(userId: string, path: string): string {
  return `${userId}:${path}`;
}

export function setCache(key: string, data: any, ttlSeconds: number = 30): void {
  cacheMap.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function getCache(key: string): any | null {
  const entry = cacheMap.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheMap.delete(key);
    return null;
  }
  return entry.data;
}

export function invalidateUserCache(userId: string): void {
  for (const key of cacheMap.keys()) {
    if (key.startsWith(`${userId}:`)) {
      cacheMap.delete(key);
    }
  }
}
