const mongoose = require('mongoose');
const { getDatabaseUrl } = require('../../utils/config');

// connects to MongoDB; the URL always comes from configuration, never from source
const InitiateMongoServer = async () => {
  try {
    await mongoose.connect(getDatabaseUrl());
    console.log('Connected to the database!');
  } catch (e) {
    console.error('Failed to connect to the database:', e.message);
    throw e;
  }
};
module.exports = InitiateMongoServer;
