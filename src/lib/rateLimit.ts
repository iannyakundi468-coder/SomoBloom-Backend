import type { Context, Next } from 'hono';

type RateLimitOptions = {
  windowMs: number; // Rate limit window duration in milliseconds
  maxRequests: number; // Maximum allowed requests in window
  keyGenerator?: (c: Context) => string;
};

// In-memory window cache fallback for Cloudflare Worker instance
const memoryStore = new Map<string, { count: number; expiresAt: number }>();

/**
 * Creates an IP / Identifier rate-limiting middleware for Hono router.
 */
export function rateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyGenerator } = options;

  return async (c: Context, next: Next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
    const key = keyGenerator ? keyGenerator(c) : `rl:${c.req.path}:${ip}`;
    const now = Date.now();

    const record = memoryStore.get(key);

    if (record && record.expiresAt > now) {
      if (record.count >= maxRequests) {
        c.header('Retry-After', String(Math.ceil((record.expiresAt - now) / 1000)));
        return c.json({
          error: 'Too many requests. Please try again later.',
          retryAfterSeconds: Math.ceil((record.expiresAt - now) / 1000)
        }, 429);
      }
      record.count += 1;
    } else {
      memoryStore.set(key, {
        count: 1,
        expiresAt: now + windowMs
      });
    }

    // Clean up expired keys periodically
    if (memoryStore.size > 1000) {
      for (const [k, v] of memoryStore.entries()) {
        if (v.expiresAt <= now) memoryStore.delete(k);
      }
    }

    return await next();
  };
}
