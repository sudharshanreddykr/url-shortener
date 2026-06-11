const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database.js');

const Url = sequelize.define('Url', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  originalUrl: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      isUrl: true,
    },
  },
  shortCode: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  customAlias: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  ttlDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  clicksCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  timestamps: true,
});

module.exports = Url;
