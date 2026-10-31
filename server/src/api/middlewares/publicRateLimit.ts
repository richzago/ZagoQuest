/**
 * Small bounded, in-process IP request limiter for public REST endpoints.
 * Does not replace shared reverse-proxy / multi-instance throttling in production.
 * Express defaults to trust proxy OFF; do not trust spoofable X-Forwarded-For.
 */
import type { RequestHandler } from "express";

type RateLimitOptions = {
  maxRequests: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
};

export function createIpRateLimiter({
  maxRequests, windowMs, maxKeys = 10_000, now = Date.now,
}: RateLimitOptions): RequestHandler {
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 ||
      !Number.isSafeInteger(windowMs) || windowMs < 1 ||
      !Number.isSafeInteger(maxKeys) || maxKeys < 1) {
    throw new Error("Configuração inválida de rate limit.");
  }
  const buckets = new Map<string, { requests: number; resetsAt: number }>();
  const message = { error: "Muitas tentativas. Tente novamente mais tarde." };
  return (req, res, next) => {
    const timestamp = now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let bucket = buckets.get(key);
    if (bucket && bucket.resetsAt <= timestamp) {
      buckets.delete(key);
      bucket = undefined;
    }
    if (!bucket && buckets.size >= maxKeys) {
      // Reclaim expired entries without unbounded timers or Maps.
      for (const [ip, entry] of buckets) {
        if (entry.resetsAt <= timestamp) buckets.delete(ip);
      }
      // Fail closed when at capacity; infrastructure protection is still needed.
      if (buckets.size >= maxKeys) {
        res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
        res.status(429).json(message);
        return;
      }
    }
    if (!bucket) {
      bucket = { requests: 0, resetsAt: timestamp + windowMs };
      buckets.set(key, bucket);
    }
    bucket.requests++;
    if (bucket.requests > maxRequests) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetsAt - timestamp) / 1000))));
      res.status(429).json(message);
      return;
    }
    next();
  };
}

/** Each instance applies to its own route and maintains separate counters. */
export const loginRateLimit = createIpRateLimiter({ maxRequests: 20, windowMs: 5 * 60_000 });
export const registrationRateLimit = createIpRateLimiter({ maxRequests: 5, windowMs: 60 * 60_000 });
