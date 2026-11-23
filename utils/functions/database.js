const mongoose = require('mongoose');

const { calculateLevel } = require('./siteAlgorithms');
const mongo = require('./mongo');

// default SiteData documents the application expects to exist
const SITE_DATA_DEFAULTS = {
  QUESTIONS: {
    attempts: { physics: 0, chemistry: 0, biology: 0, usabo: 0, ess: 0 },
    solves: { physics: 0, chemistry: 0, biology: 0, usabo: 0, ess: 0 },
  },
  HISTORY_MONTH: { userbase: [], questioncount: [], attempts: [], solves: [] },
  HISTORY_YEAR: { userbase: [], questioncount: [], attempts: [], solves: [] },
  ANNOUNCEMENTS: { site: [] },
};

// creates any missing SiteData documents (safe to run on every start)
async function ensureSiteData(SiteData) {
  await Promise.all(
    Object.entries(SITE_DATA_DEFAULTS).map(([tag, data]) =>
      SiteData.updateOne(
        { tag },
        { $setOnInsert: { tag, data } },
        { upsert: true },
      ),
    ),
  );
}

// input a string (the question ID), returns question entry
function getQuestion(Ques, id) {
  return Ques.findById(id).exec();
}

/**
 * Picks one random question whose rating lies in [floor, ceiling] and which
 * belongs to at least one of the given units. Filtering happens in MongoDB and
 * only ids are transferred before the single chosen document is loaded.
 */
async function pickQuestion(
  Ques,
  { floor, ceiling, subject, units, excludeIds = [] },
) {
  const query = {
    subject: [subject],
    rating: { $gte: floor, $lte: ceiling },
    units: { $in: units },
  };
  if (excludeIds.length > 0) {
    query._id = {
      $nin: excludeIds.filter((id) => mongoose.isValidObjectId(id)),
    };
  }
  const [picked] = await Ques.aggregate([
    { $match: query },
    { $sample: { size: 1 } },
    { $project: { _id: 1 } },
  ]);
  return picked ? Ques.findById(picked._id).exec() : null;
}

// return rating of the user logged in right now
function getRating(subject, req) {
  return req.user.rating[subject.toLowerCase()];
}

// update "to answer" queue field in user db (atomic, touches only this field)
async function updateQuestionQueue(req, subject, id) {
  const key = subject.toLowerCase();
  await mongo.User.updateOne(
    { _id: req.user._id },
    { $set: { ['stats.toAnswer.' + key]: String(id) } },
  );
  req.user.stats.toAnswer[key] = String(id);
}

async function clearQuestionQueue(req, subject) {
  const key = subject.toLowerCase();
  await mongo.User.updateOne(
    { _id: req.user._id },
    { $set: { ['stats.toAnswer.' + key]: '' } },
  );
  req.user.stats.toAnswer[key] = '';
}

// atomically sets one subject rating without touching any other user field
async function setRating(subject, newRating, req) {
  const key = subject.toLowerCase();
  await mongo.User.updateOne(
    { _id: req.user._id },
    { $set: { ['rating.' + key]: newRating } },
  );
  req.user.rating[key] = newRating;
}

// adds experience points to the signed-in user atomically
async function addExperience(req, amount) {
  const gained = Math.round(amount);
  await mongo.User.updateOne(
    { _id: req.user._id },
    { $inc: { 'stats.experience': gained } },
  );
  req.user.stats.experience = (req.user.stats.experience || 0) + gained;
}

// bumps the site-wide attempt/solve counters atomically
async function incrementSolveCounter(SiteData, subject, correct) {
  const key = subject.toLowerCase();
  await SiteData.updateOne(
    { tag: 'QUESTIONS' },
    {
      $inc: {
        ['data.attempts.' + key]: 1,
        ...(correct ? { ['data.solves.' + key]: 1 } : {}),
      },
    },
    { upsert: true },
  );
}

// top users per category; count is the number of people on each board
async function generateLeaderboard(User, count) {
  const top = (field, min) =>
    User.find({ [field]: { $gte: min } })
      .sort({ [field]: -1 })
      .limit(count)
      .exec();
  const [physics, chem, bio, usabo, rush, experienceUsers] = await Promise.all([
    top('rating.physics', 1000),
    top('rating.chemistry', 1000),
    top('rating.biology', 1000),
    top('rating.usabo', 1000),
    top('stats.rush.highscore', 10),
    top('stats.experience', 10000),
  ]);
  const experience = experienceUsers.map((user) => ({
    level: calculateLevel(user.stats.experience),
    experience: user.stats.experience,
    ign: user.ign,
  }));
  return { physics, chem, bio, usabo, rush, experience };
}

// today's challenge question; created once per day even under concurrent requests
async function getDailyQuestion(Daily, Ques) {
  const date = new Date().toISOString().split('T')[0];
  const existing = await Daily.findOne({ date }).exec();
  if (existing) {
    return Ques.findById(existing.question).exec();
  }

  let [selection] = await Ques.aggregate([
    { $match: { rating: { $gte: 2500, $lte: 4000 } } },
    { $sample: { size: 1 } },
  ]);
  if (!selection) {
    [selection] = await Ques.aggregate([{ $sample: { size: 1 } }]);
  }
  if (!selection) {
    return null;
  }

  // another request may have created today's entry first; whichever won is the answer
  const daily = await Daily.findOneAndUpdate(
    { date },
    { $setOnInsert: { date, question: selection._id } },
    { upsert: true, returnDocument: 'after' },
  ).exec();
  return Ques.findById(daily.question).exec();
}

const countTags = () => {
  const { tags } = require('../constants/tags');
  let counter = 0;
  Object.values(tags).forEach((subject) =>
    Object.values(subject).forEach((type) => {
      counter += Object.keys(type).length;
    }),
  );
  return counter;
};

async function getSiteData(User, Ques, SiteData) {
  const [
    userCount,
    standardQuestionCount,
    usaboQuestionCount,
    proficientCount,
    totalQuestionData,
    historyMonth,
    historyYear,
  ] = await Promise.all([
    User.estimatedDocumentCount(),
    Ques.estimatedDocumentCount(),
    mongo.db.collection('usaboQuestions').estimatedDocumentCount(),
    User.countDocuments({
      // any users with at least 3000 rating
      $or: ['physics', 'chemistry', 'biology', 'usabo', 'ess'].map(
        (subject) => ({
          ['rating.' + subject]: { $gte: 3000 },
        }),
      ),
    }),
    SiteData.findOne({ tag: 'QUESTIONS' }).exec(),
    SiteData.findOne({ tag: 'HISTORY_MONTH' }).exec(),
    SiteData.findOne({ tag: 'HISTORY_YEAR' }).exec(),
  ]);

  const questions =
    (totalQuestionData && totalQuestionData.data) ||
    SITE_DATA_DEFAULTS.QUESTIONS;
  const month =
    (historyMonth && historyMonth.data) || SITE_DATA_DEFAULTS.HISTORY_MONTH;
  const year =
    (historyYear && historyYear.data) || SITE_DATA_DEFAULTS.HISTORY_YEAR;

  return {
    userCount,
    questionCount: standardQuestionCount + usaboQuestionCount,
    usaboQuestionCount,
    tagCount: countTags(),
    proficientCount,
    totalSolves: questions.solves,
    totalAttempts: questions.attempts,
    historyData: {
      userbase_month: month.userbase,
      questioncount_month: month.questioncount,
      attempts_month: month.attempts,
      solves_month: month.solves,

      userbase_year: year.userbase,
      questioncount_year: year.questioncount,
      attempts_year: year.attempts,
      solves_year: year.solves,
    },
  };
}

// returns the most recent announcements, newest first
async function getAnnouncements(SiteData, numberToFetch) {
  const announcements = await SiteData.findOne({ tag: 'ANNOUNCEMENTS' }).exec();
  const siteAnnouncements =
    (announcements && announcements.data && announcements.data.site) || [];
  return [...siteAnnouncements].reverse().slice(0, numberToFetch);
}

// updates problem rush stats atomically
async function updateRushStats(user, score) {
  await mongo.User.updateOne(
    { _id: user._id },
    { $inc: { 'stats.rush.attempts': 1 } },
  );
  await mongo.User.updateOne(
    { _id: user._id },
    { $max: { 'stats.rush.highscore': score } },
  );
}

async function updateRushAchievements(user, score) {
  const set = { 'achievements.join_mutorials': true };
  if (score >= 20) set['achievements.rush_20'] = true;
  if (score >= 10) set['achievements.rush_10'] = true;
  await mongo.User.updateOne({ _id: user._id }, { $set: set });
}

// escapes user input so it is matched literally inside a RegExp
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// site-wide search over users and questions
async function querySite(query, User, Ques) {
  const results = [];
  const clean = (value) => (typeof value === 'string' ? value.trim() : '');
  const list = (value) =>
    clean(value)
      ? clean(value)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  const text = clean(query.text).slice(0, 100);
  const units = list(query.units);
  const tags = list(query.tags);
  const subjects = list(query.subjects);

  const possibleID =
    mongoose.isValidObjectId(text) && text.length === 24
      ? new mongoose.Types.ObjectId(text)
      : null;
  const pattern = new RegExp(escapeRegex(text), 'i');

  const idMatch = possibleID ? [{ _id: possibleID }] : [];
  const userMatches = await User.find({
    $or: [...idMatch, { ign: pattern }, { 'profile.name': pattern }],
  })
    .limit(50)
    .exec();

  const andQuery = [];
  if (units.length > 0) andQuery.push({ units: { $all: units } });
  if (tags.length > 0) andQuery.push({ tags: { $all: tags } });
  if (subjects.length > 0) andQuery.push({ subject: { $all: subjects } });

  const questionMatches = await Ques.find({
    $and: [
      {
        $or: [
          ...idMatch,
          { question: pattern },
          { choices: pattern },
          { answer_ex: pattern },
          { ext_source: text },
        ],
      },
      ...andQuery,
    ],
  })
    .sort({ rating: -1 })
    .limit(100)
    .exec();

  questionMatches.forEach((question) => {
    const exactMatch =
      text.toUpperCase() == question.question.toUpperCase() ||
      question.tags.includes(text.toUpperCase()) ||
      question._id.toString() == text;
    const entry = {
      exactMatch,
      type: 'QUESTION',
      id: question._id,
      title: question.subject[0] + ' (' + question.rating + ' Rated)',
      preview:
        'ID: ' + question._id + ', Relevant Tags: ' + question.tags.join(' '),
    };
    exactMatch ? results.unshift(entry) : results.push(entry);
  });

  userMatches.forEach((user) => {
    const exactMatch =
      text.toUpperCase() == user.ign.toUpperCase() ||
      user._id.toString() == text;
    const entry = {
      exactMatch,
      type: 'USER',
      id: user.ign,
      title:
        user.ign + (user.profile.name ? ' (' + user.profile.name + ')' : ''),
      preview:
        (user.profile.bio ? user.profile.bio + (exactMatch ? ' ' : ', ') : '') +
        'Experience: ' +
        user.stats.experience +
        ', ' +
        user.stats.collectedTags.length +
        ' tags collected',
    };
    exactMatch ? results.unshift(entry) : results.push(entry);
  });

  return results;
}

module.exports = {
  ensureSiteData,
  getQuestion,
  pickQuestion,
  getRating,
  setRating,
  updateQuestionQueue,
  addExperience,
  clearQuestionQueue,
  generateLeaderboard,
  getDailyQuestion,
  getSiteData,
  incrementSolveCounter,
  getAnnouncements,
  updateRushStats,
  updateRushAchievements,
  querySite,
};
