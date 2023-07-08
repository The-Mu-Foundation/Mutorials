const mongo = require('./utils/functions/mongo.js');

// Record daily and weekly user growth

async function collectData() {
  let currentUsers = await mongo.db.collection('users').countDocuments({});
  let currentQuestions =
    (await mongo.db.collection('questions').countDocuments({})) +
    (await mongo.db.collection('usaboQuestions').countDocuments({}));
  let sitedata = await mongo.SiteData.findOne({ tag: 'QUESTIONS' }).exec();
  let currentAttempts = 0;
  Object.keys(sitedata.data.attempts).forEach(
    (element) => (currentAttempts += sitedata.data.attempts[element])
  );
  let currentSolves = 0;
  Object.keys(sitedata.data.solves).forEach(
    (element) => (currentSolves += sitedata.data.solves[element])
  );
  return { currentUsers, currentQuestions, currentAttempts, currentSolves };
}

async function collectDailyData() {
  let collectedData = await collectData();
  let history = await mongo.SiteData.findOne({ tag: 'HISTORY_MONTH' }).exec();
  history.data.userbase.push(collectedData.currentUsers);
  history.data.questioncount.push(collectedData.currentQuestions);
  history.data.attempts.push(collectedData.currentAttempts);
  history.data.solves.push(collectedData.currentSolves);
  Object.keys(history.data).forEach((element) => {
    if (history.data[element].length > 30) {
      history.data[element].shift();
    }
  });
  await mongo.SiteData.updateOne(
    { tag: 'HISTORY_MONTH' },
    { $set: { data: history.data } }
  ).exec();
  triggerAnalytics();
}

async function collectWeeklyData() {
  let collectedData = await collectData();
  let history = await mongo.SiteData.findOne({ tag: 'HISTORY_YEAR' }).exec();
  history.data.userbase.push(collectedData.currentUsers);
  history.data.questioncount.push(collectedData.currentQuestions);
  history.data.attempts.push(collectedData.currentAttempts);
  history.data.solves.push(collectedData.currentSolves);
  Object.keys(history.data).forEach((element) => {
    if (history.data[element].length > 52) {
      history.data[element].shift();
    }
  });
  await mongo.SiteData.updateOne(
    { tag: 'HISTORY_YEAR' },
    { $set: { data: history.data } }
  ).exec();
  initializeAnalytics();
}

function initializeAnalytics() {
  let time = Date.now(),
    day = 24 * 60 * 60 * 1000,
    week = 7 * 24 * 60 * 60 * 1000;
  if (week - (time % week) == day - (time % day)) {
    setTimeout(collectWeeklyData, week - (time % week));
  } else {
    setTimeout(collectDailyData, day - (time % day));
  }
}

module.exports = {
  initializeAnalytics,
};
