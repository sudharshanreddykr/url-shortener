const redis = require('../config/redis.js');
const {
  findURLByShortCode,
  getRecentClicks,
} = require('../store/link-store.js');

const logClick = async (urlId, metadata) => {
  try {
    const clickEvent = {
      urlId,
      userAgent: metadata.userAgent || null,
      ipAddress: metadata.ipAddress || null,
      referrer: metadata.referrer || null,
      timestamp: new Date().toISOString(),
    };
    await redis.lpush('queue:clicks', JSON.stringify(clickEvent));
  } catch (error) {
    console.error('Failed to queue click event to Redis:', error);
    // Fallback: write directly to DB if Redis queueing fails
    try {
      const { createClick, incrementClicksCount } = require('../store/link-store.js');
      await createClick({
        urlId,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        referrer: metadata.referrer,
      });
      await incrementClicksCount(urlId);
    } catch (dbError) {
      console.error('Failed fallback click logging to database:', dbError);
    }
  }
};

const getAnalytics = async (shortCode) => {
  const url = await findURLByShortCode(shortCode);

  if (!url) return null;

  return {
    shortCode: url.shortCode,
    originalUrl: url.originalUrl,
    expiresAt: url.expiresAt,
    ttlDays: url.ttlDays,
    totalClicks: url.clicksCount,
    recentClicks: await getRecentClicks(url.id, 100),
  };
};

module.exports = {
  logClick,
  getAnalytics,
};
