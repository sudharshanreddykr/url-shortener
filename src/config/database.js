const { Sequelize } = require('sequelize');
const { config } = require('./environment.js');

let sequelize;

const commonOptions = {
  dialect: config.database.dialect,
  logging: config.database.logging,
  pool: {
    max: config.database.poolMax,
    min: config.database.poolMin,
    acquire: 30000,
    idle: 10000,
  },
};

if (config.database.url) {
  if (process.env.DATABASE_READ_URL) {
    sequelize = new Sequelize(config.database.url, {
      ...commonOptions,
      replication: {
        write: { url: config.database.url },
        read: [{ url: process.env.DATABASE_READ_URL }],
      },
    });
  } else {
    sequelize = new Sequelize(config.database.url, commonOptions);
  }
} else {
  if (process.env.DB_READ_HOST) {
    sequelize = new Sequelize(
      config.database.name,
      config.database.username,
      config.database.password,
      {
        ...commonOptions,
        replication: {
          write: { host: config.database.host, port: config.database.port },
          read: [
            {
              host: process.env.DB_READ_HOST,
              port: Number(process.env.DB_READ_PORT || 5432),
              username: process.env.DB_READ_USER || config.database.username,
              password: process.env.DB_READ_PASSWORD || config.database.password,
            },
          ],
        },
      }
    );
  } else {
    sequelize = new Sequelize(
      config.database.name,
      config.database.username,
      config.database.password,
      {
        host: config.database.host,
        port: config.database.port,
        ...commonOptions,
      }
    );
  }
}

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL database connected successfully');
    
    // Sync models
    // In production, you would use migrations
    await sequelize.sync({ alter: false });
    console.log('Database models synced');

    // Create indexes manually with IF NOT EXISTS to prevent Sequelize sync limitations
    await sequelize.query('CREATE INDEX IF NOT EXISTS "urls_original_url" ON "Urls" ("originalUrl")');
    await sequelize.query('CREATE INDEX IF NOT EXISTS "urls_expires_at" ON "Urls" ("expiresAt")');
    await sequelize.query('CREATE INDEX IF NOT EXISTS "clicks_url_id" ON "Clicks" ("urlId")');
    await sequelize.query('CREATE INDEX IF NOT EXISTS "clicks_timestamp" ON "Clicks" ("timestamp")');
    console.log('Database indexes verified/created');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
