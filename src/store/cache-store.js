const redis = require('../config/redis.js');
const { config } = require('../config/environment.js');

const URL_CACHE_PREFIX = 'url:';

const setUrlCache = async (shortCode, data) => {
  try {
    await redis.set(
      `${URL_CACHE_PREFIX}${shortCode}`,
      JSON.stringify(data),
      'EX',
      config.redis.ttl
    );
  } catch (error) {
    console.error('Redis Cache Error (set):', error);
  }
};

const getUrlCache = async (shortCode) => {
  try {
    const data = await redis.get(`${URL_CACHE_PREFIX}${shortCode}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis Cache Error (get):', error);
    return null;
  }
};

const deleteUrlCache = async (shortCode) => {
  try {
    await redis.del(`${URL_CACHE_PREFIX}${shortCode}`);
  } catch (error) {
    console.error('Redis Cache Error (del):', error);
  }
};

module.exports = {
  setUrlCache,
  getUrlCache,
  deleteUrlCache,
};
