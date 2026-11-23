const mongoose = require('mongoose');

// Append-only log of every graded answer. This is the ground truth needed to
// evaluate and recalibrate the adaptive model offline (the user document only
// keeps aggregate counters and the last few results per unit).
const attemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: mongoose.Schema.Types.ObjectId, required: true },
  bank: { type: String, enum: ['standard', 'usabo'], default: 'standard' },
  subject: String,
  units: [String],
  correct: { type: Boolean, required: true },
  // false when the answer was shown for review only (not the queued question)
  rated: { type: Boolean, default: true },
  mode: { type: String, default: 'classic' },
  userRatingBefore: Number,
  userRatingAfter: Number,
  questionRatingBefore: Number,
  questionRatingAfter: Number,
  // milliseconds between the question being served and the answer arriving
  latencyMs: Number,
  createdAt: { type: Date, default: Date.now },
});

attemptSchema.index({ user: 1, createdAt: -1 });
attemptSchema.index({ question: 1, createdAt: -1 });

module.exports = { attemptSchema };
