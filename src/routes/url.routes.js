const { Router } = require('express');
const { shorten, getStats } = require('../controllers/url.controller.js');
const { createRateLimiter } = require('../middlewares/rate-limit.middleware.js');
const { config } = require('../config/environment.js');

const router = Router();
const shortenRateLimiter = createRateLimiter({
  windowMs: config.rateLimitWindowMs,
  maxRequests: config.rateLimitMaxRequests,
});

router.post('/shorten', shortenRateLimiter, shorten);
router.get('/analytics/:code', getStats);

module.exports = router;
