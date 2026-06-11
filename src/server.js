const app = require("./app.js");
const { config } = require("./config/environment.js");
const { connectDB } = require("./config/database.js");
const { purgeExpiredRecords } = require("./store/link-store.js");
const { startWorker, stopWorker } = require("./workers/analytics.worker.js");

const start = async () => {
  await connectDB();

  // Start background worker in dev mode automatically for testing convenience
  if (config.nodeEnv === "development" || process.env.RUN_WORKER === "true") {
    startWorker();
  }

  setInterval(() => {
    purgeExpiredRecords();
  }, config.cleanupIntervalMs).unref();

  const server = app.listen(config.port, () => {
    console.log(
      `URL Shortener Service running on port ${config.port} in ${config.nodeEnv} mode`,
    );
    console.log("Swagger docs available at http://localhost:3000/docs");
  });

  const gracefulShutdown = () => {
    console.log("Received shutdown signal. Stopping server gracefully...");
    if (config.nodeEnv === "development" || process.env.RUN_WORKER === "true") {
      stopWorker();
    }
    server.close(() => {
      console.log("Server stopped.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
};

if (require.main === module) {
  start();
}

module.exports = { start };
