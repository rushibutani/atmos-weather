const WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;
const buckets = new Map<string, { count: number; reset: number }>();

function removeExpiredBuckets(now: number) {
  if (buckets.size < MAX_BUCKETS) return;

  for (const [key, bucket] of buckets) {
    if (bucket.reset <= now) buckets.delete(key);
  }

  while (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }
}

export function rateLimit(key: string, limit: number) {
  const now = Date.now();
  removeExpiredBuckets(now);
  const item = buckets.get(key);

  if (!item || item.reset <= now) {
    buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1, reset: now + WINDOW_MS };
  }

  if (item.count >= limit) return { allowed: false, remaining: 0, reset: item.reset };
  item.count += 1;
  return { allowed: true, remaining: limit - item.count, reset: item.reset };
}
