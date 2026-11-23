// Grading and atomic recording of answers, shared by every training mode.
const pluralize = require('pluralize');
const { calculateRatings } = require('./siteAlgorithms');

const SKIP_PENALTY = 8;

// normalizes any submitted value into an array of trimmed strings
function toStringArray(value) {
  if (value === undefined || value === null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => String(item).trim());
}

// compares two answer sets ignoring order and duplicates
function sameAnswerSet(expected, given) {
  const a = [...new Set(toStringArray(expected))].sort();
  const b = [...new Set(toStringArray(given))].sort();
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

// free response: case-insensitive text match, numeric equality, or plural-insensitive match
function freeResponseMatches(acceptedAnswers, response) {
  const typed = String(response).trim();
  if (typed === '') return false;
  const typedLower = typed.toLowerCase();
  return toStringArray(acceptedAnswers).some((accepted) => {
    const acceptedLower = accepted.toLowerCase();
    if (acceptedLower === typedLower) return true;
    if (acceptedLower !== '' && Number(acceptedLower) == Number(typed))
      return true;
    return pluralize(acceptedLower, 1) === pluralize(typedLower, 1);
  });
}

// Grades a submitted form body against a question.
// Returns null if the submission contains no answer, otherwise
// { correct, userAnswer }.
function gradeAnswer(question, body) {
  if (body.type === 'mc' && body.answerChoice !== undefined) {
    return {
      correct: String(question.answer[0]) === String(body.answerChoice),
      userAnswer: body.answerChoice,
    };
  }
  if (body.type === 'sa' && body.saChoice !== undefined) {
    return {
      correct: sameAnswerSet(question.answer, body.saChoice),
      userAnswer: body.saChoice,
    };
  }
  if (
    body.type === 'fr' &&
    typeof body.freeAnswer === 'string' &&
    body.freeAnswer.trim() !== ''
  ) {
    return {
      correct: freeResponseMatches(question.answer, body.freeAnswer),
      userAnswer: body.freeAnswer,
    };
  }
  return null;
}

// achievements newly earned given the post-answer state; returns { 'path': true }
function earnedAchievements({ subjectKey, correct, solves, rating, tagCount }) {
  const earned = { join_mutorials: true };
  if (correct) earned['first_' + subjectKey] = true;
  if (solves >= 500) earned.solves_500 = true;
  if (solves >= 300) earned.solves_300 = true;
  if (rating >= 3500) earned.rating_expert = true;
  if (rating >= 2750) earned.rating_advanced = true;
  if (rating >= 2000) earned.rating_intermediate = true;
  if (rating >= 1500) earned.rating_beginner = true;
  if (tagCount >= 180) earned.tags_180 = true;
  if (tagCount >= 100) earned.tags_100 = true;
  if (tagCount >= 50) earned.tags_50 = true;
  if (tagCount >= 20) earned.tags_20 = true;
  return earned;
}

// builds the per-unit statistics document after one more answer
function nextUnitStats(previous, question, correct, today) {
  const unit = previous || {
    correct: 0,
    wrong: 0,
    highestQRating: 100,
    highestQCorrectRating: 100,
    pastResults: [],
    pastRatings: [],
    lastTouched: '',
  };
  const next = {
    ...unit,
    pastResults: [...(unit.pastResults || [])],
    pastRatings: [...(unit.pastRatings || [])],
  };
  if (question.rating > next.highestQRating)
    next.highestQRating = question.rating;
  if (correct) {
    next.correct++;
    next.pastResults.push(1);
    if (question.rating > next.highestQCorrectRating) {
      next.highestQCorrectRating = question.rating;
    }
  } else {
    next.wrong++;
    next.pastResults.push(-1);
  }
  next.pastRatings.push(question.rating);
  next.pastResults = next.pastResults.slice(-15);
  next.pastRatings = next.pastRatings.slice(-15);
  next.lastTouched = today;
  return next;
}

// How long ago (ms) a question was served to this session, if known.
function takeServedLatency(session, questionId) {
  const served = session && session.served;
  if (!served || !served[questionId]) return undefined;
  const latency = Date.now() - served[questionId];
  delete served[questionId];
  return latency >= 0 ? latency : undefined;
}

// remembers when a question was shown (bounded so the session cannot grow forever)
function markServed(session, questionId) {
  if (!session) return;
  session.served = session.served || {};
  session.served[String(questionId)] = Date.now();
  const ids = Object.keys(session.served);
  if (ids.length > 20) {
    ids
      .sort((a, b) => session.served[a] - session.served[b])
      .slice(0, ids.length - 20)
      .forEach((id) => delete session.served[id]);
  }
}

/**
 * Atomically records a graded answer.
 *
 * Only the question currently queued for this user and subject earns rating,
 * experience and statistics, and only once: the compare-and-set on the queue
 * field makes double submits and replayed requests harmless. Any other answer is
 * explained but changes nothing.
 *
 * Returns { rated, correct, oldUserRating, newUserRating, oldQRating, newQRating }.
 */
async function recordAnswer(
  mongo,
  { user, question, correct, bank, mode, session, userAnswer },
) {
  const isUsabo = bank === 'usabo';
  const subjectKey = isUsabo
    ? 'usabo'
    : String(question.subject[0]).toLowerCase();
  const groupField = isUsabo ? 'categories' : 'units';
  const groups = (isUsabo ? question.categories : question.units) || [];
  const questionId = String(question._id);
  const oldUserRating = user.rating ? user.rating[subjectKey] : undefined;
  const oldQRating = question.rating;
  const outcome = {
    rated: false,
    correct,
    oldUserRating,
    newUserRating: oldUserRating,
    oldQRating,
    newQRating: oldQRating,
  };

  const queued =
    user.stats && user.stats.toAnswer && user.stats.toAnswer[subjectKey];
  const eligible =
    String(queued) === questionId &&
    Number.isFinite(oldUserRating) &&
    oldUserRating >= 0;
  if (!eligible) {
    return outcome;
  }

  const { newUserRating, newQuestionRating } = calculateRatings(
    oldUserRating,
    oldQRating,
    correct,
  );
  const experience = correct ? question.rating : Math.ceil(question.rating / 2);
  const today = new Date().toISOString().split('T')[0];

  const collectedTags = (user.stats && user.stats.collectedTags) || [];
  const newTags = correct
    ? (question.tags || []).filter((tag) => !collectedTags.includes(tag))
    : [];
  const solves = (user.stats.correct || 0) + (correct ? 1 : 0);

  const set = {
    ['rating.' + subjectKey]: newUserRating,
    ['stats.toAnswer.' + subjectKey]: '',
    'stats.lastAnswered': questionId,
  };
  const inc = {
    'stats.experience': experience,
    [correct ? 'stats.correct' : 'stats.wrong']: 1,
  };
  const push = {
    ['stats.ratingTracker.' + subjectKey]: {
      $each: [newUserRating],
      $slice: -20,
    },
  };
  const statsGroups = (user.stats && user.stats[groupField]) || {};
  groups.forEach((group) => {
    set[`stats.${groupField}.${group}`] = nextUnitStats(
      statsGroups[group],
      question,
      correct,
      today,
    );
  });
  const earned = earnedAchievements({
    subjectKey,
    correct,
    solves,
    rating: newUserRating,
    tagCount: collectedTags.length + newTags.length,
  });
  Object.keys(earned).forEach((key) => {
    set['achievements.' + key] = true;
  });

  const userUpdate = { $set: set, $inc: inc, $push: push };
  if (newTags.length > 0) {
    userUpdate.$addToSet = { 'stats.collectedTags': { $each: newTags } };
  }

  // compare-and-set: only succeeds while this exact question is still queued
  const result = await mongo.User.updateOne(
    { _id: user._id, ['stats.toAnswer.' + subjectKey]: questionId },
    userUpdate,
  );
  if (result.modifiedCount !== 1) {
    return outcome;
  }

  const QuestionModel = isUsabo ? mongo.USABOQues : mongo.Ques;
  // the user update above is the source of truth; log (rather than fail the
  // request) if a secondary write is rejected
  const secondary = await Promise.allSettled([
    QuestionModel.updateOne(
      { _id: question._id },
      {
        $set: { rating: newQuestionRating },
        $inc: { [correct ? 'stats.pass' : 'stats.fail']: 1 },
      },
    ),
    mongo.SiteData.updateOne(
      { tag: 'QUESTIONS' },
      {
        $inc: {
          ['data.attempts.' + subjectKey]: 1,
          ...(correct ? { ['data.solves.' + subjectKey]: 1 } : {}),
        },
      },
    ),
    mongo.Attempt.create({
      user: user._id,
      question: question._id,
      bank: isUsabo ? 'usabo' : 'standard',
      subject: subjectKey,
      units: groups,
      correct,
      rated: true,
      mode: mode || 'classic',
      userRatingBefore: oldUserRating,
      userRatingAfter: newUserRating,
      questionRatingBefore: oldQRating,
      questionRatingAfter: newQuestionRating,
      latencyMs: takeServedLatency(session, questionId),
    }),
  ]);
  secondary
    .filter((entry) => entry.status === 'rejected')
    .forEach((entry) =>
      console.error('Answer bookkeeping failed:', entry.reason),
    );

  // keep the in-memory user (used to render the response) consistent
  user.rating[subjectKey] = newUserRating;
  user.stats.toAnswer[subjectKey] = '';
  user.stats.lastAnswered = questionId;
  user.stats.experience = (user.stats.experience || 0) + experience;
  user.stats[correct ? 'correct' : 'wrong'] =
    (user.stats[correct ? 'correct' : 'wrong'] || 0) + 1;
  if (newTags.length > 0)
    user.stats.collectedTags = [...collectedTags, ...newTags];

  return {
    ...outcome,
    rated: true,
    newUserRating,
    newQRating: newQuestionRating,
  };
}

/**
 * Skips the queued question: -8 rating for the user, +1 rating and a recorded
 * failure for the question. Only valid for the question that is actually queued.
 */
async function recordSkip(mongo, { user, questionId, subject, bank }) {
  const isUsabo = bank === 'usabo';
  const subjectKey = isUsabo ? 'usabo' : String(subject).toLowerCase();
  const id = String(questionId);
  const queued =
    user.stats && user.stats.toAnswer && user.stats.toAnswer[subjectKey];
  const current = user.rating ? user.rating[subjectKey] : undefined;
  if (String(queued) !== id || !Number.isFinite(current)) {
    return false;
  }
  const newRating = Math.max(0, current - SKIP_PENALTY);
  const result = await mongo.User.updateOne(
    { _id: user._id, ['stats.toAnswer.' + subjectKey]: id },
    {
      $set: {
        ['rating.' + subjectKey]: newRating,
        ['stats.toAnswer.' + subjectKey]: '',
      },
      $push: {
        ['stats.ratingTracker.' + subjectKey]: {
          $each: [newRating],
          $slice: -20,
        },
      },
    },
  );
  if (result.modifiedCount !== 1) {
    return false;
  }
  const QuestionModel = isUsabo ? mongo.USABOQues : mongo.Ques;
  await QuestionModel.updateOne(
    { _id: id },
    { $inc: { rating: 1, 'stats.fail': 1 } },
  );
  user.rating[subjectKey] = newRating;
  user.stats.toAnswer[subjectKey] = '';
  return true;
}

module.exports = {
  gradeAnswer,
  sameAnswerSet,
  freeResponseMatches,
  earnedAchievements,
  nextUnitStats,
  markServed,
  recordAnswer,
  recordSkip,
  SKIP_PENALTY,
};
