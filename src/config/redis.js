const Redis = require('ioredis');
const { config } = require('./environment.js');

const redisOptions = {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

if (!config.redis.url) {
  redisOptions.host = config.redis.host;
  redisOptions.port = config.redis.port;
  if (config.redis.password) {
    redisOptions.password = config.redis.password;
  }
}

const redis = config.redis.url ? new Redis(config.redis.url, redisOptions) : new Redis(redisOptions);

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

module.exports = redis;
