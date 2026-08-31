const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number) { const now = Date.now(); const item = buckets.get(key); if (!item || item.reset < now) { buckets.set(key, { count: 1, reset: now + 60_000 }); return true; } if (item.count >= limit) return false; item.count++; return true; }
