const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database.js');
const Url = require('./url.model.js');

const Click = sequelize.define('Click', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  urlId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Url,
      key: 'id',
    },
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  referrer: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: false,
});

Url.hasMany(Click, { foreignKey: 'urlId', as: 'clicks' });
Click.belongsTo(Url, { foreignKey: 'urlId' });

module.exports = Click;
