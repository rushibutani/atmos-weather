const WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;
const buckets = new Map<string, { count: number; reset: number }>();

function removeExpiredBuckets(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.reset <= now) buckets.delete(key);
  }
}

export function rateLimit(key: string, limit: number) {
  const now = Date.now();
  removeExpiredBuckets(now);
  const item = buckets.get(key);

  if (!item || item.reset <= now) {
    buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    return true;
  }

  if (item.count >= limit) return false;
  item.count += 1;
  return true;
}
