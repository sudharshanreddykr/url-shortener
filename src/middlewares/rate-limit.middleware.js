const redis = require('../config/redis.js');

const defaultMessage = 'Too many short URL creation requests. Please try again later.';

function getClientKey(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return (forwardedIp || req.ip || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function createRateLimiter({ windowMs, maxRequests, message = defaultMessage }) {
  return async (req, res, next) => {
    const key = `ratelimit:${getClientKey(req)}`;

    try {
      const current = await redis.get(key);

      if (current && Number.parseInt(current, 10) >= maxRequests) {
        const ttl = await redis.ttl(key);
        const retryAfterSeconds = Math.max(ttl, 1);

        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.setHeader('X-RateLimit-Limit', String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + retryAfterSeconds));

        return res.status(429).json({
          status: 'error',
          message,
        });
      }

      // Increment count and set TTL atomically via Redis pipeline
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      if (!current) {
        pipeline.pexpire(key, windowMs);
      }
      const results = await pipeline.exec();
      const newCount = results[0][1];
      const ttl = !current ? windowMs : (await redis.ttl(key)) * 1000;

      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(maxRequests - newCount, 0)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((Date.now() + ttl) / 1000)));

      return next();
    } catch (error) {
      console.error('Redis Distributed Rate Limiter Error:', error);
      // Fallback: fail open to keep service available if Redis is down
      return next();
    }
  };
}

module.exports = { createRateLimiter };
