const {
  findURLByShortCode,
  findExistingURL,
  createURL,
} = require('../store/link-store.js');
const { getUrlCache, setUrlCache, deleteUrlCache } = require('../store/cache-store.js');
const { config } = require('../config/environment.js');
const { generateShortCode } = require('../utils/nanoid.js');
const { BadRequestError, ConflictError, NotFoundError } = require('../utils/errors.js');
const validator = require('validator');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function resolveTtlDays(expiresInDays) {
  if (expiresInDays === undefined || expiresInDays === null) {
    return config.defaultLinkTtlDays;
  }

  const ttlDays = Number(expiresInDays);
  if (!Number.isInteger(ttlDays) || ttlDays <= 0) {
    throw new BadRequestError('expiresInDays must be a positive integer');
  }

  return ttlDays;
}

function resolveExpiresAt(ttlDays) {
  return new Date(Date.now() + ttlDays * MS_PER_DAY).toISOString();
}

const shortenURL = async (originalUrl, alias, options = {}) => {
  if (!validator.isURL(originalUrl)) {
    throw new BadRequestError('Invalid URL provided');
  }

  // Case 1: Custom alias requested
  if (alias) {
    const trimmedAlias = String(alias).trim();
    if (trimmedAlias.length < 6) {
      throw new BadRequestError('Custom alias must be at least 6 characters long');
    }

    const existingAlias = await findURLByShortCode(trimmedAlias);
    if (existingAlias) {
      // Idempotency check: If same alias is provided for the same URL, reuse it
      if (existingAlias.originalUrl === originalUrl) {
        return existingAlias;
      }
      throw new ConflictError('Custom alias already in use');
    }

    const ttlDays = resolveTtlDays(options.expiresInDays);
    const urlRecord = await createURL({
      originalUrl,
      shortCode: trimmedAlias,
      customAlias: true,
      ttlDays,
      expiresAt: resolveExpiresAt(ttlDays),
    });

    await setUrlCache(trimmedAlias, urlRecord);
    return urlRecord;
  }

  // Case 2: No custom alias, auto-generate one
  // Check if this URL already has a shortened record (without custom alias / canonical)
  const existingURL = await findExistingURL(originalUrl);
  if (existingURL) {
    return existingURL;
  }

  const ttlDays = resolveTtlDays(options.expiresInDays);
  let attempts = 0;
  while (attempts < 3) {
    const shortCode = generateShortCode();
    const collision = await findURLByShortCode(shortCode);
    if (!collision) {
      const urlRecord = await createURL({
        originalUrl,
        shortCode,
        customAlias: false,
        ttlDays,
        expiresAt: resolveExpiresAt(ttlDays),
      });

      await setUrlCache(shortCode, urlRecord);
      return urlRecord;
    }

    attempts++;
  }

  throw new Error('Failed to generate a unique short code');
};

const pendingLookups = new Map();

const getOriginalURL = async (shortCode) => {
  // Try Cache first
  const cachedUrl = await getUrlCache(shortCode);
  if (cachedUrl) {
    // Validate TTL expiration
    if (new Date(cachedUrl.expiresAt) > new Date()) {
      return cachedUrl;
    }
    // If expired, clean up the cache and proceed
    await deleteUrlCache(shortCode);
  }

  // Prevent Cache Stampede (Single Flight)
  if (pendingLookups.has(shortCode)) {
    return pendingLookups.get(shortCode);
  }

  const lookupPromise = (async () => {
    try {
      const url = await findURLByShortCode(shortCode);
      if (!url) {
        throw new NotFoundError('Short code not found');
      }

      // Set Cache
      await setUrlCache(shortCode, url);
      return url;
    } finally {
      pendingLookups.delete(shortCode);
    }
  })();

  pendingLookups.set(shortCode, lookupPromise);
  return lookupPromise;
};

module.exports = {
  shortenURL,
  getOriginalURL,
  resolveTtlDays,
};
