const mongoose = require('mongoose');

// define user schema
const dailySchema = new mongoose.Schema({
  date: {
    type: String,
    default: new Date().toISOString().split('T')[0],
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
});

module.exports = { dailySchema };
