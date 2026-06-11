const { connectDB } = require('./config/database.js');
const redis = require('./config/redis.js');
const { startWorker, stopWorker } = require('./workers/analytics.worker.js');

const start = async () => {
  console.log('Starting Analytics Worker Service...');
  
  // Connect to PostgreSQL database
  await connectDB();
  
  // Verify Redis connection is ready
  if (redis.status !== 'ready') {
    console.log('Waiting for Redis connection...');
    await new Promise((resolve) => {
      redis.once('ready', resolve);
    });
  }
  
  // Start the background polling loop
  startWorker();
  
  // Graceful shutdown handling
  const gracefulShutdown = () => {
    console.log('Received termination signal. Shutting down worker...');
    stopWorker();
    
    // Close connections
    redis.quit();
    process.exit(0);
  };
  
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
};

if (require.main === module) {
  start();
}

module.exports = { start };
