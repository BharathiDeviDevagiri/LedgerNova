const cleanupIntervalMs = 60 * 1000;

export function createRateLimiter({ windowMs, max, message }) {
  if (!Number.isInteger(windowMs) || windowMs < 1 ||
      !Number.isInteger(max) || max < 1) {
    throw new TypeError('Rate limiter requires a positive integer window and limit.');
  }

  const clients = new Map();
  let lastCleanup = Date.now();

  return (req, res, next) => {
    const now = Date.now();

    if (now - lastCleanup >= cleanupIntervalMs) {
      for (const [ip, bucket] of clients) {
        if (bucket.resetAt <= now) clients.delete(ip);
      }
      lastCleanup = now;
    }

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    let bucket = clients.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      clients.set(ip, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(resetSeconds));
      return res.status(429).json({
        success: false,
        error: message,
      });
    }

    return next();
  };
}

export const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again later.',
});

export const registrationRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts. Please try again later.',
});
