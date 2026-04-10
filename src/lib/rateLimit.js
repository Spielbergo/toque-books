/**
 * Simple in-memory rate limiter.
 *
 * ⚠️  Works per-process. In a multi-instance serverless deployment (e.g. Vercel)
 *     each instance has its own counter — upgrade to Upstash Redis before
 *     high-traffic public launch.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });
 *   const allowed = limiter.check(ip);   // returns true if under limit
 */
export function createRateLimiter({ windowMs = 60_000, max = 20 } = {}) {
  const store = new Map(); // ip → { count, resetAt }

  return {
    check(key) {
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      if (entry.count >= max) return false;

      entry.count += 1;
      return true;
    },
  };
}
