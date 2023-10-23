const mongoose = require('mongoose');
const db = mongoose.connection;

const { calculateLevel } = require('./siteAlgorithms');

const { updateUSABOCounters } = require('./usaboDatabase');
const mongo = require('./mongo');

// input a string (the question ID), returns question entry
function getQuestion(Ques, id) {
  return Ques.findById(id).exec();
}

// input a rating range (as floor and ceiling values), returns a range of questions
async function getQuestions(Ques, ratingFloor, ratingCeiling, subject, units) {
  const gotQ = Ques.find({
    subject: [subject],
    rating: { $gte: ratingFloor, $lte: ratingCeiling },
  });

  let tempQ = await gotQ.exec();

  console.log(tempQ.length);

  for (i = 0; i < tempQ.length; i++) {
    const found = units.some((r) => tempQ[i].units.includes(r));
    if (!found) {
      tempQ.splice(i, 1);
      i--;
    }
  }
  return tempQ;
}

// return rating of the user logged in right now
function getRating(subject, req) {
  return req.user.rating[subject.toLowerCase()];
}

// set the rating of the user logged in right now
function setRating(subject, newRating, req) {
  req.user.rating[subject.toLowerCase()] = newRating;
  db.collection('users').findOneAndUpdate(
    { username: req.user.username },
    { $set: { rating: req.user.rating } }
  );
}

// modify the correct/wrong counter for users, and the pass/fail counter for questions, as well as tag collector tags

function updateAll(req, question, correct) {
  if (question.subject == 'USABO') {
    updateUSABOCounters(req, question, correct);
  } else {
    updateCounters(req, question, correct);
  }
  updateTracker(req, question);
  updateLastAnswered(req, question);
  addExperience(
    req,
    correct ? question.rating : Math.ceil(question.rating / 2)
  );
}
function updateCounters(req, question, correct) {
  // configure general counters
  if (correct) {
    // update counters
    req.user.stats.correct++;
    question.stats.pass++;
    // update tag collector
    question.tags.forEach((tag) => {
      if (!req.user.stats.collectedTags.includes(tag)) {
        req.user.stats.collectedTags.push(tag);
      }
    });
  } else if (!correct) {
    req.user.stats.wrong++;
    question.stats.fail++;
  }

  // unit-specific counters
  if (!req.user.stats.units) {
    req.user.stats.units = {};
  }
  question.units.forEach((unit) => {
    if (!req.user.stats.units['' + unit]) {
      req.user.stats.units['' + unit] = {
        correct: 0,
        wrong: 0,
        highestQRating: 100,
        highestQCorrectRating: 100,
        pastResults: [],
        pastRatings: [],
        lastTouched: '',
      };
    }

    // temporary tracker
    let tempUnit = req.user.stats.units['' + unit];

    if (question.rating > tempUnit.highestQRating) {
      tempUnit.highestQRating = question.rating;
    }

    if (correct) {
      tempUnit.correct++;
      tempUnit.pastResults.push(1);
      if (question.rating > tempUnit.highestQCorrectRating) {
        tempUnit.highestQCorrectRating = question.rating;
      }
    } else {
      tempUnit.wrong++;
      tempUnit.pastResults.push(-1);
    }

    tempUnit.pastRatings.push(question.rating);

    while (tempUnit.pastRatings.length > 15) {
      tempUnit.pastRatings.shift();
    }
    while (tempUnit.pastResults.length > 15) {
      tempUnit.pastResults.shift();
    }

    tempUnit.lastTouched = new Date().toISOString().split('T')[0];

    req.user.stats.units['' + unit] = tempUnit;
  });

  db.collection('users').findOneAndUpdate(
    { username: req.user.username },
    { $set: { stats: req.user.stats } }
  );
  db.collection('questions').findOneAndUpdate(
    { _id: question._id },
    {
      $set: { stats: { pass: question.stats.pass, fail: question.stats.fail } },
    }
  );
}
function updateTracker(req, question) {
  // update rating tracker
  let tracker;
  if (req.user.stats.ratingTracker === undefined) {
    req.user.stats.ratingTracker = {};
  }
  try {
    // try to update the tracker
    tracker = req.user.stats.ratingTracker[question.subject[0].toLowerCase()];
    tracker.push(req.user.rating[question.subject[0].toLowerCase()]);
    while (tracker.length > 20) {
      tracker.shift();
    }
  } catch (err) {
    // tracker doesn"t exist (yet), so create one!
    tracker = [req.user.rating[question.subject[0].toLowerCase()]];
    req.user.stats.ratingTracker[question.subject[0].toLowerCase()];
  }
  req.user.stats.ratingTracker[question.subject[0].toLowerCase()] = tracker;
  db.collection('users').findOneAndUpdate(
    { username: req.user.username },
    { $set: { stats: req.user.stats } }
  );
}
function updateLastAnswered(req, question) {
  // updated "last answered" field with question ID
  req.user.stats.lastAnswered = question._id;
  db.collection('users').findOneAndUpdate(
    { username: req.user.username },
    { $set: { stats: req.user.stats } }
  );
}
function addExperience(req, amount) {
  // add experience points to user
  if (req.user.stats.experience) {
    req.user.stats.experience += amount;
  } else {
    req.user.stats.experience = amount;
  }
  db.collection('users').findOneAndUpdate(
    { username: req.user.username },
    { $set: { stats: req.user.stats } }
  );
}

async function incrementSolveCounter(SiteData, subject, correct) {
  let data = await SiteData.findOne({ tag: 'QUESTIONS' }).exec();
  let counts = data.data;
  counts.attempts[subject] += 1;
  if (correct) {
    counts.solves[subject] += 1;
  }
  db.collection('sitedatas').findOneAndUpdate(
    { tag: 'QUESTIONS' },
    { $set: { data: counts } }
  );
}

// update "to answer" queue field in user db
function updateQuestionQueue(req, subject, id) {
  req.user.stats.toAnswer[subject.toLowerCase()] = id;
  db.collection('users').findOneAndUpdate(
    { username: req.user.username },
    { $set: { stats: req.user.stats } }
  );
}
function clearQuestionQueue(req, subject) {
  req.user.stats.toAnswer[subject.toLowerCase()] = '';
  db.collection('users').findOneAndUpdate(
    { username: req.user.username },
    { $set: { stats: req.user.stats } }
  );
}

// things to update when skipping question
async function skipQuestionUpdates(Ques, req, subject, id) {
  // deduct 8 rating for skipping
  const originalRating = getRating(subject, req);
  const deduction = originalRating > 8 ? originalRating - 8 : 0;
  setRating(subject, deduction, req);

  // update rating tracker
  let q = await getQuestion(Ques, id);
  updateTracker(req, q);

  // add +1 wrong for question and give question one rating
  q.rating += 1;
  q.stats.fail += 1;
  db.collection('questions').findOneAndUpdate(
    { _id: q._id },
    { $set: { stats: q.stats, rating: q.rating } }
  );
}

// set question rating
function setQRating(antsy, newQRate) {
  antsy.rating = newQRate;
  db.collection('questions').findOneAndUpdate(
    { _id: antsy._id },
    { $set: { rating: antsy.rating } }
  );
}

// generate a leaderboard for a certain subject; count is the number of people on board
async function generateLeaderboard(User, count) {
  // NOTE: change the $gte to a higher number once we get more users
  let physics = await User.find({ 'rating.physics': { $gte: 1000 } })
    .sort({ 'rating.physics': -1 })
    .limit(count)
    .exec();
  let chem = await User.find({ 'rating.chemistry': { $gte: 1000 } })
    .sort({ 'rating.chemistry': -1 })
    .limit(count)
    .exec();
  let bio = await User.find({ 'rating.biology': { $gte: 1000 } })
    .sort({ 'rating.biology': -1 })
    .limit(count)
    .exec();
  let usabo = await User.find({ 'rating.usabo': { $gte: 1000 } })
    .sort({ 'rating.usabo': -1 })
    .limit(count)
    .exec();

  let rush = await User.find({ 'stats.rush.highscore': { $gte: 10 } })
    .sort({ 'stats.rush.highscore': -1 })
    .limit(count)
    .exec();
  let experience = await User.find({ 'stats.experience': { $gte: 10000 } })
    .sort({ 'stats.experience': -1 })
    .limit(count)
    .exec();

  experience = experience.map((user) => {
    return {
      level: calculateLevel(user.stats.experience),
      experience: user.stats.experience,
      ign: user.ign,
    };
  });

  return { physics, chem, bio, usabo, rush, experience };
}

async function getDailyQuestion(Daily, Ques) {
  // attempt to get daily object
  const date = await new Date().toISOString().split('T')[0];
  let question = await Daily.findOne({ date }).exec();

  if (question) {
    // if daily object exists
    let content = await Ques.findById(question.question).exec();

    return content;
  } else {
    // if daily object does not exist, create a new one
    const questions = await Ques.find({
      rating: { $gte: 2500, $lte: 4000 },
    }).exec();
    const selection = await questions[
      Math.floor(Math.random() * questions.length)
    ];

    // Manually set daily question date, maybe the defaults are weird?
    let question = await new Daily({
      question: selection._id,
      date: date,
    });

    await question.save();

    return selection;
  }
}

async function getSiteData(User, Ques, SiteData) {
  let userCount = await User.estimatedDocumentCount({});
  let questionCount = await Ques.estimatedDocumentCount({});
  let usaboQuestionCount = await mongo.db
    .collection('usaboQuestions')
    .estimatedDocumentCount({});
  questionCount += usaboQuestionCount;

  let tagCounter = () => {
    let { tags } = require('../constants/tags');
    let counter = 0;
    Object.entries(tags).forEach((subjEntry) => {
      Object.entries(subjEntry[1]).forEach((typeEntry) => {
        Object.entries(typeEntry[1]).forEach((tagEntry) => {
          counter += 1;
        });
      });
    });
    return counter;
  };

  let tagCount = await tagCounter();
  let proficientCount = await User.countDocuments({
    // any users with at least 3000 rating
    $or: [
      { 'rating.physics': { $gte: 3000 } },
      { 'rating.chemistry': { $gte: 3000 } },
      { 'rating.biology': { $gte: 3000 } },
      { 'rating.usabo': { $gte: 3000 } },
      { 'rating.ess': { $gte: 3000 } },
    ],
  });

  let totalQuestionData = await SiteData.findOne({ tag: 'QUESTIONS' }).exec();
  let totalSolves = totalQuestionData.data.solves;
  let totalAttempts = totalQuestionData.data.attempts;

  let historyMonth = await SiteData.findOne({ tag: 'HISTORY_MONTH' }).exec();
  let historyYear = await SiteData.findOne({ tag: 'HISTORY_YEAR' }).exec();
  let historyData = {
    userbase_month: historyMonth.data.userbase,
    questioncount_month: historyMonth.data.questioncount,
    attempts_month: historyMonth.data.attempts,
    solves_month: historyMonth.data.solves,

    userbase_year: historyYear.data.userbase,
    questioncount_year: historyYear.data.questioncount,
    attempts_year: historyYear.data.attempts,
    solves_year: historyYear.data.solves,
  };

  let siteData = {
    userCount,
    questionCount,
    usaboQuestionCount,
    tagCount,
    proficientCount,
    totalSolves,
    totalAttempts,
    historyData,
  };

  return siteData;
}

// returns 10 most recent announcements
async function getAnnouncements(SiteData, numberToFetch) {
  let announcements = await SiteData.findOne({ tag: 'ANNOUNCEMENTS' }).exec();
  let siteAnnouncements = announcements.data.site;

  let recentAnnouncements = siteAnnouncements.reverse().slice(0, numberToFetch);

  return recentAnnouncements;
}

// updates problem rush stats
async function updateRushStats(user, score) {
  if (!user.stats.rush) {
    user.stats.rush = {
      attempts: 0,
      highscore: 0,
    };
  }

  if (!user.stats.rush.highscore) {
    user.stats.rush.highscore = 0;
  }

  if (!user.stats.rush.attempts) {
    user.stats.rush.attempts = 0;
  }

  user.stats.rush.attempts += 1;

  if (user.stats.rush.highscore < score) {
    user.stats.rush.highscore = score;
  }

  db.collection('users').findOneAndUpdate(
    { username: user.username },
    { $set: { stats: user.stats } }
  );
}

async function querySite(query, User, Ques, SiteData) {
  results = [];
  let { text, units, tags, subjects } = query;
  text = text ? text.trim() : '';
  units = units
    ? units
        .trim()
        .split(',')
        .map((unit) => unit.trim())
    : [];
  tags = tags
    ? tags
        .trim()
        .split(',')
        .map((tag) => tag.trim())
    : [];
  subjects = subjects
    ? subjects
        .trim()
        .split(',')
        .map((subject) => subject.trim().toProperCase())
    : [];

  let possibleID;
  try {
    possibleID = mongoose.Types.ObjectId(text);
  } catch (err) {
    possibleID = mongoose.Types.ObjectId('000000000000000000000000');
  }

  // find matches
  let userMatches = await User.find({
    $or: [
      { _id: possibleID },
      { ign: { $regex: new RegExp(text), $options: 'ix' } },
      { 'profile.name': { $regex: new RegExp(text), $options: 'i' } },
    ],
  }).exec();

  // Put units and tags in an and query
  let andQuery = [];
  if (units.length > 0) {
    andQuery.push({ units: { $all: units } });
  }
  if (tags.length > 0) {
    andQuery.push({ tags: { $all: tags } });
  }
  if (subjects.length > 0) {
    andQuery.push({ subject: { $all: subjects } });
  }

  let questionMatches = await Ques.find({
    $and: [
      {
        $or: [
          { _id: possibleID },
          { question: { $regex: new RegExp(text), $options: 'i' } },
          { choices: { $regex: new RegExp(text), $options: 'i' } },
          { answer_ex: { $regex: new RegExp(text), $options: 'i' } },
          { ext_source: text },
        ],
      },
      ...andQuery,
    ],
  })
    .sort({ rating: -1 })
    .exec();

  // load matches into results
  questionMatches.forEach((question) => {
    if (
      text.toUpperCase() == question.question.toUpperCase() ||
      question.tags.includes(text.toUpperCase()) ||
      question._id.toString() == text
    ) {
      results.unshift({
        exactMatch: true,
        type: 'QUESTION',
        id: question._id,
        title: question.subject[0] + ' (' + question.rating + ' Rated)',
        preview:
          'ID: ' + question._id + ', Relevant Tags: ' + question.tags.join(' '),
      });
    } else {
      results.push({
        exactMatch: false,
        type: 'QUESTION',
        id: question._id,
        title: question.subject[0] + ' (' + question.rating + ' Rated)',
        preview:
          'ID: ' + question._id + ', Relevant Tags: ' + question.tags.join(' '),
      });
    }
  });

  userMatches.forEach((user) => {
    if (
      text.toUpperCase() == user.ign.toUpperCase() ||
      user._id.toString() == text
    ) {
      results.unshift({
        exactMatch: true,
        type: 'USER',
        id: user.ign,
        title:
          user.ign + (user.profile.name ? ' (' + user.profile.name + ')' : ''),
        preview:
          (user.profile.bio ? user.profile.bio + ' ' : '') +
          'Experience: ' +
          user.stats.experience +
          ', ' +
          user.stats.collectedTags.length +
          ' tags collected',
      });
    } else {
      results.push({
        exactMatch: false,
        type: 'USER',
        id: user.ign,
        title:
          user.ign + (user.profile.name ? ' (' + user.profile.name + ')' : ''),
        preview:
          (user.profile.bio ? user.profile.bio + ', ' : '') +
          'Experience: ' +
          user.stats.experience +
          ', ' +
          user.stats.collectedTags.length +
          ' tags collected',
      });
    }
  });

  return results;
}

async function updateTrainAchievements(user, question, correct) {
  if (!user.achievements) {
    user.achievements = {};
  }
  user.achievements['join_mutorials'] = true;

  if (correct) {
    user.achievements['first_' + question.subject[0].toLowerCase()] = true;
  }

  let solves = user.stats.correct;
  if (solves >= 500) {
    user.achievements['solves_500'] = true;
  }
  if (solves >= 300) {
    user.achievements['solves_300'] = true;
  }

  let rating = user.rating[question.subject[0].toLowerCase()];
  if (rating >= 3500) {
    user.achievements['rating_expert'] = true;
  }
  if (rating >= 2750) {
    user.achievements['rating_advanced'] = true;
  }
  if (rating >= 2000) {
    user.achievements['rating_intermediate'] = true;
  }
  if (rating >= 1500) {
    user.achievements['rating_beginner'] = true;
  }

  let tagsCollected = user.stats.collectedTags.length;
  if (tagsCollected >= 180) {
    user.achievements['tags_180'] = true;
  }
  if (tagsCollected >= 100) {
    user.achievements['tags_100'] = true;
  }
  if (tagsCollected >= 50) {
    user.achievements['tags_50'] = true;
  }
  if (tagsCollected >= 20) {
    user.achievements['tags_20'] = true;
  }

  db.collection('users').findOneAndUpdate(
    { username: user.username },
    { $set: { achievements: user.achievements } }
  );
}

async function updateRushAchievements(user, score) {
  if (!user.achievements) {
    user.achievements = {};
  }
  user.achievements['join_mutorials'] = true;

  if (score >= 20) {
    user.achievements['rush_20'] = true;
  }
  if (score >= 10) {
    user.achievements['rush_10'] = true;
  }

  db.collection('users').findOneAndUpdate(
    { username: user.username },
    { $set: { achievements: user.achievements } }
  );
}

async function updateFields() {
  //replace the parameters as needed for different purposes
  db.collection('users').updateMany(
    { age: { $exists: true } },
    { $rename: { age: 'yob' } }
  );
}

module.exports = {
  getQuestion,
  getQuestions,
  getRating,
  setRating,
  setQRating,
  updateCounters,
  updateTracker,
  updateLastAnswered,
  updateAll,
  updateQuestionQueue,
  addExperience,
  clearQuestionQueue,
  skipQuestionUpdates,
  generateLeaderboard,
  getDailyQuestion,
  getSiteData,
  incrementSolveCounter,
  getAnnouncements,
  updateRushStats,
  querySite,
  updateTrainAchievements,
  updateRushAchievements,
  updateFields,
};
