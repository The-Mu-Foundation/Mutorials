const mongoose = require('mongoose');

// true if the value is a string/ObjectId that can be cast to an ObjectId
function isValidId(value) {
  if (
    typeof value !== 'string' &&
    !(value instanceof mongoose.Types.ObjectId)
  ) {
    return false;
  }
  return mongoose.isValidObjectId(value) && String(value).length === 24;
}

// converts a string to an ObjectId; returns null instead of throwing
function toObjectId(value) {
  return isValidId(value) ? new mongoose.Types.ObjectId(String(value)) : null;
}

module.exports = { isValidId, toObjectId };
