// Best-effort, in-process fixed-window rate limiter for the Anthropic-calling API routes. Keyed
// per user per route so one student hammering (or scripting) an endpoint can't run up API costs
// or exhaust the shared Anthropic quota for everyone else.
//
// PHASE2: this is per-server-instance state, not a shared store — on a multi-instance serverless
// deployment each instance enforces its own independent quota, so the *effective* limit is
// (limit x live instance count), not exactly `limit`. That's an acceptable trade-off for blunting
// casual abuse without adding an external dependency (Redis/Upstash); swap for a shared-store
// limiter if real abuse is observed.
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Cheap unbounded-growth guard: only sweep once the map has grown suspiciously large, rather than
// running a background timer (which would keep a serverless instance alive between invocations).
const PRUNE_THRESHOLD = 5000;

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (buckets.size > PRUNE_THRESHOLD) pruneExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
