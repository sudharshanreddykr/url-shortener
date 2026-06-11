const { shortenURL, getOriginalURL } = require('../services/url.service.js');
const { logClick, getAnalytics } = require('../services/analytics.service.js');
const { config } = require('../config/environment.js');

const shorten = async (req, res, next) => {
  try {
    const { url, alias, expiresInDays } = req.body;
    const urlRecord = await shortenURL(url, alias, { expiresInDays });

    res.status(201).json({
      status: 'success',
      data: {
        originalUrl: urlRecord.originalUrl,
        shortCode: urlRecord.shortCode,
        shortUrl: config.baseUrl + '/' + urlRecord.shortCode,
        ttlDays: urlRecord.ttlDays,
        expiresAt: urlRecord.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const redirect = async (req, res, next) => {
  try {
    const { code } = req.params;
    const urlRecord = await getOriginalURL(code);

    logClick(urlRecord.id, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      referrer: req.headers['referer'],
    });

    res.redirect(301, urlRecord.originalUrl);
  } catch (error) {
    next(error);
  }
};

const getStats = async (req, res, next) => {
  try {
    const { code } = req.params;
    const stats = await getAnalytics(code);

    if (!stats) {
      return res.status(404).json({
        status: 'error',
        message: 'Short code not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  shorten,
  redirect,
  getStats,
};
