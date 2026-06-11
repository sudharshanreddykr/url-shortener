const redis = require('../config/redis.js');
const Click = require('../models/click.model.js');
const Url = require('../models/url.model.js');
const { sequelize } = require('../config/database.js');

const BATCH_SIZE = 100;
const POLL_INTERVAL_MS = 5000; // 5 seconds
let isRunning = false;
let intervalId = null;

/**
 * Pops a batch of click events from Redis using a pipeline
 */
const fetchBatch = async (batchSize) => {
  try {
    const pipeline = redis.pipeline();
    for (let i = 0; i < batchSize; i++) {
      pipeline.rpop('queue:clicks');
    }
    const results = await pipeline.exec();
    
    return results
      .map(([err, val]) => val)
      .filter((val) => val !== null && val !== undefined)
      .map((val) => JSON.parse(val));
  } catch (error) {
    console.error('Error fetching batch from Redis:', error);
    return [];
  }
};

/**
 * Processes a batch of click events:
 * 1. Bulk inserts Click records
 * 2. Increments Url clicks count in aggregated queries
 */
const processBatch = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const clicks = await fetchBatch(BATCH_SIZE);
    if (clicks.length === 0) {
      isRunning = false;
      return;
    }

    console.log(`Processing batch of ${clicks.length} click events...`);

    // We run the DB operations inside a transaction to ensure consistency
    await sequelize.transaction(async (transaction) => {
      // 1. Bulk insert all click records
      await Click.bulkCreate(clicks, { transaction });

      // 2. Aggregate count increments by URL ID
      const increments = {};
      for (const click of clicks) {
        increments[click.urlId] = (increments[click.urlId] || 0) + 1;
      }

      // 3. Update the click count for each unique URL
      await Promise.all(
        Object.entries(increments).map(([urlId, count]) =>
          Url.increment('clicksCount', {
            by: count,
            where: { id: urlId },
            transaction,
          })
        )
      );
    });

    console.log(`Successfully processed ${clicks.length} click events.`);
  } catch (error) {
    console.error('Error processing click events batch:', error);
  } finally {
    isRunning = false;
  }
};

/**
 * Starts the worker polling loop
 */
const startWorker = () => {
  console.log('Analytics background worker started');
  // Run immediately on start
  processBatch();
  
  // Set up polling interval
  intervalId = setInterval(processBatch, POLL_INTERVAL_MS);
};

/**
 * Stops the worker polling loop gracefully
 */
const stopWorker = () => {
  console.log('Stopping analytics background worker...');
  if (intervalId) {
    clearInterval(intervalId);
  }
};

module.exports = {
  processBatch,
  startWorker,
  stopWorker,
};
