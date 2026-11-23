const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: String,
  school: String,
  city: String,
  classCode: String,
  // ign of the teacher who created the class
  teacher: String,
});

classSchema.index({ classCode: 1 }, { unique: true, sparse: true });

module.exports = { classSchema };
