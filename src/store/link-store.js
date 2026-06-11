const { Op } = require('sequelize');
const Url = require('../models/url.model.js');
const Click = require('../models/click.model.js');

const initializeStore = async () => {
  // Database initialization is handled in src/config/database.js
};

const purgeExpiredRecords = async () => {
  try {
    const deletedCount = await Url.destroy({
      where: {
        expiresAt: {
          [Op.lte]: new Date(),
        },
      },
    });
    return { removedUrls: deletedCount, removedClicks: 0 }; // Click deletions handled by CASCADE if configured, but here we just return count
  } catch (error) {
    console.error('Failed to purge expired records:', error);
    return { removedUrls: 0, removedClicks: 0 };
  }
};

const findURLByShortCode = async (shortCode) => {
  try {
    return await Url.findOne({
      where: {
        shortCode,
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
    });
  } catch (error) {
    console.error('findURLByShortCode Error:', error);
    return null;
  }
};

const findExistingURL = async (originalUrl) => {
  try {
    // Prefer custom alias if multiple exist (to match original behavior)
    return await Url.findOne({
      where: {
        originalUrl,
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
      order: [['customAlias', 'DESC']],
    });
  } catch (error) {
    console.error('findExistingURL Error:', error);
    return null;
  }
};

const createURL = async ({ originalUrl, shortCode, customAlias, ttlDays, expiresAt }) => {
  try {
    return await Url.create({
      originalUrl,
      shortCode,
      customAlias,
      ttlDays,
      expiresAt,
    });
  } catch (error) {
    console.error('createURL Error:', error);
    throw error;
  }
};

const createClick = async ({ urlId, userAgent, ipAddress, referrer }) => {
  try {
    return await Click.create({
      urlId,
      userAgent,
      ipAddress,
      referrer,
    });
  } catch (error) {
    console.error('createClick Error:', error);
    return null;
  }
};

const incrementClicksCount = async (urlId) => {
  try {
    const url = await Url.findByPk(urlId);
    if (!url) return null;

    return await url.increment('clicksCount');
  } catch (error) {
    console.error('incrementClicksCount Error:', error);
    return null;
  }
};

const getRecentClicks = async (urlId, limit = 100) => {
  try {
    return await Click.findAll({
      where: { urlId },
      order: [['timestamp', 'DESC']],
      limit,
    });
  } catch (error) {
    console.error('getRecentClicks Error:', error);
    return [];
  }
};

module.exports = {
  initializeStore,
  purgeExpiredRecords,
  findURLByShortCode,
  findExistingURL,
  createURL,
  createClick,
  incrementClicksCount,
  getRecentClicks,
};
