const dotenv = require('dotenv');

dotenv.config();

function parseEnvInt(value, fallback, minimum = -Infinity) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }

  return parsed;
}

const config = {
  port: parseEnvInt(process.env.PORT, 5001, 1),
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:5001',
  defaultLinkTtlDays: parseEnvInt(process.env.DEFAULT_LINK_TTL_DAYS, 30, 1),
  rateLimitWindowMs: parseEnvInt(process.env.RATE_LIMIT_WINDOW_MS, 900000, 1000),
  rateLimitMaxRequests: parseEnvInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10, 1),
  cleanupIntervalMs: parseEnvInt(process.env.CLEANUP_INTERVAL_MS, 3600000, 1000),
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseEnvInt(process.env.DB_PORT, 5432),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'url_shortener',
    dialect: 'postgres',
    logging: process.env.DB_LOGGING === 'true',
    poolMax: parseEnvInt(process.env.DB_POOL_MAX, 10, 1),
    poolMin: parseEnvInt(process.env.DB_POOL_MIN, 0, 0),
  },
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseEnvInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || null,
    ttl: parseEnvInt(process.env.REDIS_TTL, 3600), // Default 1 hour
  },
};

module.exports = { config };
