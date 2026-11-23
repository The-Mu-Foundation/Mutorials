const { toObjectId } = require('./ids');

const REQUIRED_REVIEWS = 2;

// ids of questions the reviewer chose to skip, kept in a cookie
function skippedIds(req) {
  const raw = req.cookies && req.cookies.skipQuestions;
  return (Array.isArray(raw) ? raw : []).map(toObjectId).filter(Boolean);
}

/**
 * Moves every pending question that has enough reviews into the live
 * collection. The live copy keeps the pending question's _id and the pending
 * copy is only removed after the insert, so a crash cannot lose a question and
 * a retry cannot duplicate one.
 */
async function promoteReviewed(
  mongo,
  pendingName,
  liveName,
  minReviews = REQUIRED_REVIEWS,
) {
  const pending = mongo.db.collection(pendingName);
  const live = mongo.db.collection(liveName);
  const ready = await pending
    .find({
      $expr: { $gte: [{ $size: { $ifNull: ['$reviewers', []] } }, minReviews] },
    })
    .toArray();
  for (const question of ready) {
    try {
      await live.insertOne({
        ...question,
        stats: question.stats || { pass: 0, fail: 0 },
      });
    } catch (err) {
      if (!err || err.code !== 11000) throw err;
    }
    await pending.deleteOne({ _id: question._id });
  }
  return ready.length;
}

module.exports = { skippedIds, promoteReviewed, REQUIRED_REVIEWS };
