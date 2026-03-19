const { PendingQues, Ques, db } = require('../mongo');

/**
 * Transfers pending questions that already have exactly one reviewer
 * from the `pendingQuestions` collection to the `questions` collection.
 *
 * Usage:
 *   node utils/functions/scripts/transferReviewedQuestions.js
 */

async function transferReviewedQuestions() {
  // Find pending questions that have exactly one reviewer
  const pending = await PendingQues.find(
    { reviewers: { $size: 1 } },
    {
      question: 1,
      choices: 1,
      tags: 1,
      rating: 1,
      answer: 1,
      answer_ex: 1,
      author: 1,
      type: 1,
      ext_source: 1,
      source_statement: 1,
      subject: 1,
      units: 1,
      reviewers: 1,
      writtenDate: 1,
      hourRefactor: 1,
    }
  )
    .lean()
    .exec();

  if (!pending.length) {
    console.log('No pending questions with exactly one reviewer found.');
    return { transferred: 0 };
  }

  const idsToRemove = [];

  const questionsToInsert = pending.map((doc) => {
    idsToRemove.push(doc._id);

    const { _id, ...rest } = doc;

    return {
      ...rest,
      // Initialize stats for newly accepted questions
      stats: {
        pass: 0,
        fail: 0,
      },
    };
  });

  const insertResult = await Ques.insertMany(questionsToInsert);

  const deleteResult = await PendingQues.deleteMany({
    _id: { $in: idsToRemove },
  });

  return {
    transferred: insertResult.length || 0,
    deletedFromPending: deleteResult.deletedCount || 0,
  };
}

async function main() {
  try {
    const { transferred, deletedFromPending } =
      await transferReviewedQuestions();

    console.log(`Transferred to questions: ${transferred}`);
    console.log(`Removed from pendingQuestions: ${deletedFromPending}`);
  } catch (err) {
    console.error('Error transferring reviewed questions:', err);
    process.exitCode = 1;
  } finally {
    if (db && db.close) {
      db.close(() => {
        process.exit();
      });
    } else {
      process.exit();
    }
  }
}

if (require.main === module) {
  main();
}
