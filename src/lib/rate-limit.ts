interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

if (typeof setInterval !== "undefined") {
  setInterval(cleanup, 60_000);
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return { allowed: true, remaining: config.max - 1, resetAt: now + config.windowMs };
  }

  if (entry.count >= config.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: config.max - entry.count, resetAt: entry.resetAt };
}

export function getRateLimitKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  const raw = forwarded ?? realIp ?? vercelIp;
  const ip = raw?.split(",")[0]?.trim() ?? "unknown";
  return `${prefix}:${ip}`;
}

export const AUTH_RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, max: 5 },
  register: { windowMs: 60 * 60 * 1000, max: 3 },
  forgotPassword: { windowMs: 60 * 60 * 1000, max: 3 },
  resetPassword: { windowMs: 15 * 60 * 1000, max: 5 },
} as const;
