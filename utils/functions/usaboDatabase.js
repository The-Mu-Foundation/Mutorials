const mongoose = require('mongoose');
const db = mongoose.connection;

const { calculateLevel } = require('./siteAlgorithms');

// input a string (the question ID), returns question entry
function getUSABOQuestion(USABOQues, id) {
  return USABOQues.findById(id).exec();
}

// input a rating range (as floor and ceiling values), returns a range of questions
async function getUSABOQuestions(
  USABOQues,
  ratingFloor,
  ratingCeiling,
  categories
) {
  const gotQ = USABOQues.find({
    rating: { $gte: ratingFloor, $lte: ratingCeiling },
  });
  let tempQ = await gotQ.exec();
  for (i = 0; i < tempQ.length; i++) {
    const found = categories.some((r) => tempQ[i].categories.includes(r));
    if (!found) {
      tempQ.splice(i, 1);
      i--;
    }
  }
  return tempQ;
}

function updateUSABOCounters(req, question, correct) {
  // configure general counters
  if (correct) {
    // update counters
    req.user.stats.correct++;
    question.stats.pass++;
  } else if (!correct) {
    req.user.stats.wrong++;
    question.stats.fail++;
  }

  // unit-specific counters
  if (!req.user.stats.categories) {
    req.user.stats.categories = {};
  }
  question.categories.forEach((category) => {
    if (!req.user.stats.categories['' + category]) {
      req.user.stats.categories['' + category] = {
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
    let tempUnit = req.user.stats.categories['' + category];

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

    req.user.stats.categories['' + category] = tempUnit;
  });

  db.collection('users').findOneAndUpdate(
    { username: req.user.username },
    { $set: { stats: req.user.stats } }
  );
  db.collection('usaboQuestions').findOneAndUpdate(
    { _id: question._id },
    {
      $set: { stats: { pass: question.stats.pass, fail: question.stats.fail } },
    }
  );
}

module.exports = {
  getUSABOQuestion,
  getUSABOQuestions,
  updateUSABOCounters,
};
