// Process-wide AI backend and similarity index. Tests install a fake backend
// with setBackend().
const { ai } = require('../config');
const { createBackend } = require('./backend');
const { SimilarityIndex } = require('./similarity');

let backend = null;
let index = null;

function getBackend() {
  if (!backend) backend = createBackend(ai);
  return backend;
}

function getIndex(mongo) {
  if (!index) {
    index = new SimilarityIndex({
      mongo,
      backend: getBackend(),
      model: ai.embedModel,
    });
  }
  return index;
}

function setBackend(replacement) {
  backend = replacement;
  index = null;
}

module.exports = { getBackend, getIndex, setBackend };
