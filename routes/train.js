// FUNCTION IMPORTS
const {
  calculateRatings,
  ratingCeilingFloor,
  calculateLevel,
} = require('../utils/functions/siteAlgorithms');
const { presetUnitOptions } = require('../utils/constants/presets');
const { subjectUnitDictionary } = require('../utils/constants/subjects');
const { referenceSheet } = require('../utils/constants/referencesheet');
const { genPassword, validPassword } = require('../utils/functions/password');
const { arraysEqual } = require('../utils/functions/general');
const {
  getQuestion,
  getQuestions,
  getRating,
  setRating,
  setQRating,
  updateTracker,
  updateCounters,
  updateAll,
  updateQuestionQueue,
  addExperience,
  clearQuestionQueue,
  skipQuestionUpdates,
  getDailyQuestion,
  incrementSolveCounter,
  updateRushStats,
  updateTrainAchievements,
  updateRushAchievements,
} = require('../utils/functions/database');
const mongoose = require('mongoose');
const db = mongoose.connection;

// LIBRARY IMPORTS
let pluralize = require('pluralize');

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
  app.all(/^(\/private|\/selQ|\/train).*$/, (req, res, next) => {
    if (req.isAuthenticated()) {
      next();
    } else {
      req.flash(
        'errorFlash',
        'Error 401: Unauthorized. You need to login to see this page.'
      );
      res.redirect('/');
    }
  });

  app.post('/private/initialRating', (req, res, next) => {
    req.user.rating[req.body.subject.toLowerCase()] = req.body.level;
    mongo.db
      .collection('users')
      .findOneAndUpdate(
        { username: req.user.username },
        { $set: { rating: req.user.rating } }
      );
    res.redirect('/' /* + req.body.subject + '/chooseUnits'*/);
  });

  app.post('/selQ', (req, res, next) => {
    let units = null;
    if (req.body.qNum == 1) {
      units = req.body.unitChoice;
      if (!units) {
        req.flash('errorFlash', 'Please choose at least one unit.');
        res.redirect('/train/' + req.body.subj + '/chooseUnits');
      }
      if (units) {
        res.redirect(
          '/train/' +
            req.body.subj +
            '/displayQuestion?units=' +
            units.toString()
        );
      }
    }
  });

  app.post('/train/checkAnswer', (req, res, next) => {
    if (req.body.type == 'mc' && req.body.answerChoice != undefined) {
      let isRight = false;
      const antsy = getQuestion(mongo.Ques, req.body.id).then(async (antsy) => {
        // clear pending question
        clearQuestionQueue(req, antsy.subject[0]);

        // check answer
        if (antsy.answer[0] == req.body.answerChoice) {
          isRight = true;
        }

        // modify ratings
        const oldUserRating = req.user.rating[antsy.subject[0].toLowerCase()];
        const oldQRating = antsy.rating;
        // update stats
        if (req.user.stats.lastAnswered != antsy._id) {
          setRating(
            antsy.subject[0],
            calculateRatings(oldUserRating, oldQRating, isRight).newUserRating,
            req
          );
          setQRating(
            antsy,
            calculateRatings(oldUserRating, oldQRating, isRight)
              .newQuestionRating
          );

          // update counters & tag collector
          updateAll(req, antsy, isRight);

          // update site data
          incrementSolveCounter(
            mongo.SiteData,
            antsy.subject[0].toLowerCase(),
            isRight
          );
        } else {
          // update tracker
          updateTracker(req, antsy);
          addExperience(req, Math.ceil(antsy.rating / 20));
        }

        // update achievements
        updateTrainAchievements(req.user, antsy, isRight);

        // render answer page
        let experienceStats = await calculateLevel(req.user.stats.experience);
        res.render(VIEWS + 'private/train/answerExplanation.ejs', {
          units: req.body.units,
          userAnswer: req.body.answerChoice,
          userRating: getRating(req.body.subject, req),
          subject: req.body.subject,
          newQues: antsy,
          correct: isRight,
          oldUserRating: oldUserRating,
          oldQ: oldQRating,
          user: req.user,
          experienceStats,
          pageName: 'Answer Explanation',
        });
      });
    } else if (req.body.type == 'sa' && req.body.saChoice != undefined) {
      let isRight = false;
      const antsy = getQuestion(mongo.Ques, req.body.id).then(async (antsy) => {
        // clear pending question
        clearQuestionQueue(req, antsy.subject[0]);

        // check answer
        isRight = arraysEqual(antsy.answer, req.body.saChoice);

        // modify ratings
        const oldUserRating = req.user.rating[antsy.subject[0].toLowerCase()];
        const oldQRating = antsy.rating;
        // update stats
        if (req.user.stats.lastAnswered != antsy._id) {
          setRating(
            antsy.subject[0],
            calculateRatings(oldUserRating, oldQRating, isRight).newUserRating,
            req
          );
          setQRating(
            antsy,
            calculateRatings(oldUserRating, oldQRating, isRight)
              .newQuestionRating
          );

          // update counters & tag collector
          updateAll(req, antsy, isRight);

          // update site data
          incrementSolveCounter(
            mongo.SiteData,
            antsy.subject[0].toLowerCase(),
            isRight
          );
        } else {
          // update tracker
          updateTracker(req, antsy);
          addExperience(req, Math.ceil(antsy.rating / 20));
        }

        // update achievements
        updateTrainAchievements(req.user, antsy, isRight);

        // render answer page
        let experienceStats = await calculateLevel(req.user.stats.experience);
        res.render(VIEWS + 'private/train/answerExplanation.ejs', {
          units: req.body.units,
          userAnswer: req.body.saChoice,
          userRating: getRating(req.body.subject, req),
          subject: req.body.subject,
          newQues: antsy,
          correct: isRight,
          oldUserRating: oldUserRating,
          oldQ: oldQRating,
          user: req.user,
          experienceStats,
          pageName: 'Answer Explanation',
        });
      });
    } else if (req.body.type == 'fr' && req.body.freeAnswer != '') {
      let isRight = false;
      const antsy = getQuestion(mongo.Ques, req.body.id).then(async (antsy) => {
        // clear pending question
        clearQuestionQueue(req, antsy.subject[0]);

        // check answer
        for (let j = 0; j < antsy.answer.length; j++) {
          if (
            antsy.answer[j].toLowerCase() ==
            req.body.freeAnswer.trim().toLowerCase()
          ) {
            isRight = true;
            break;
          } else if (
            Number(antsy.answer[j].toLowerCase()) ==
            Number(req.body.freeAnswer.trim())
          ) {
            isRight = true;
            break;
          } else if (
            pluralize(antsy.answer[j].toLowerCase(), 1) ==
            pluralize(req.body.freeAnswer.trim().toLowerCase(), 1)
          ) {
            isRight = true;
            break;
          }
        }
        // modify ratings
        const oldUserRating = req.user.rating[antsy.subject[0].toLowerCase()];
        const oldQRating = antsy.rating;

        // update stats
        if (req.user.stats.lastAnswered != antsy._id) {
          setRating(
            antsy.subject[0],
            calculateRatings(oldUserRating, oldQRating, isRight).newUserRating,
            req
          );
          setQRating(
            antsy,
            calculateRatings(oldUserRating, oldQRating, isRight)
              .newQuestionRating
          );

          // update counters & tag collector
          updateAll(req, antsy, isRight);

          // update site data
          incrementSolveCounter(
            mongo.SiteData,
            antsy.subject[0].toLowerCase(),
            isRight
          );
        } else {
          // update tracker
          updateTracker(req, antsy);
          addExperience(req, Math.ceil(antsy.rating / 20));
        }

        // update achievements
        updateTrainAchievements(req.user, antsy, isRight);

        // render answer page
        let experienceStats = await calculateLevel(req.user.stats.experience);
        res.render(VIEWS + 'private/train/answerExplanation.ejs', {
          units: req.body.units,
          userAnswer: req.body.freeAnswer,
          userRating: getRating(req.body.subject, req),
          subject: req.body.subject,
          newQues: antsy,
          correct: isRight,
          oldUserRating: oldUserRating,
          oldQ: oldQRating,
          user: req.user,
          experienceStats,
          pageName: 'Answer Explanation',
        });
      });
    } else {
      req.flash(
        'errorFlash',
        'Please choose an answer next time... We treated that as a skip (-8 rating).'
      );
      skipQuestionUpdates(mongo.Ques, req, req.body.subject, req.body.id);
      clearQuestionQueue(req, req.body.subject);
      res.redirect(req.body.redirect);
    }
  });

  app.post('/train/skipQuestion', async (req, res, next) => {
    const { subject, id, redirect } = req.body;
    skipQuestionUpdates(mongo.Ques, req, subject, id);
    clearQuestionQueue(req, subject);
    res.redirect(redirect);
  });

  app.get('/train', (req, res) => {
    res.render(VIEWS + 'private/train/train.ejs', { pageName: 'Train' });
  });

  app.get('/train/chooseSubject', (req, res) => {
    const qNum = 0;
    res.render(VIEWS + 'private/train/chooseSubject.ejs', {
      subjects: subjectUnitDictionary,
      qNum: qNum,
      pageName: 'Train Subject',
    });
  });

  app.get('/train/daily', async (req, res) => {
    const date = await new Date().toISOString().split('T')[0];
    const question = await getDailyQuestion(mongo.Daily, mongo.Ques);
    res.render(VIEWS + 'private/train/dailyQuestion.ejs', {
      question,
      pageName: date + ' Challenge',
    });
  });

  //this stores data about the user
  let userProblemRushData = new Map();

  app.get('/train/rush', async (req, res) => {
    res.render(VIEWS + 'private/train/rush.ejs', { pageName: 'Problem Rush' });
  });

  app.get('/train/rush/loadQuestion', async (req, res) => {
    try {
      let score = parseInt(req.query.score);

      //if the score is -1 (as a flag)
      if (score == -1) {
        userProblemRushData.set(req.user._id.toString(), {
          start: Date.now(),
          score: 0,
          wrong: 0,
          submitted: false,
        });
        score++;
      } else {
        score = userProblemRushData.get(req.user._id.toString()).score;
      }
      let lowerBound = 500 + score * 100;
      let upperBound = 500 + (score + 1) * 100 - 1;
      if (score == 0) {
        lowerBound = 0;
      }

      let selection = undefined;
      while (!selection) {
        let questions = await mongo.Ques.find({
          type: 'mc',
          rating: { $gte: lowerBound, $lte: upperBound },
        }).exec();
        selection = questions[Math.floor(questions.length * Math.random())];
        lowerBound -= 50;
        upperBound += 50;
      }
      userProblemRushData.get(req.user._id.toString()).questionID =
        selection._id;
      userProblemRushData.get(req.user._id.toString()).freshQuestion = true;
      res.json({
        status: 'Success',
        id: selection._id,
        subject: selection.subject[0],
        rating: selection.rating,
        statement: selection.question,
        choices: selection.choices,
      });
    } catch (err) {
      res.json({
        status: 'Error',
      });
    }
  });

  app.get('/train/rush/checkAnswer', async (req, res) => {
    try {
      let choice = req.query.index;
      let id = req.query.id;

      //if user has: not clicked "start"/(300000 ms) 5 minutes is over/trying a different question than the one they got/3 or more wrong/already answered the question, stop them from getting a response
      if (
        userProblemRushData.has(req.user._id.toString()) &&
        Date.now() - userProblemRushData.get(req.user._id.toString()).start <
          300000 &&
        userProblemRushData.get(req.user._id.toString()).questionID == id &&
        userProblemRushData.get(req.user._id.toString()).wrong < 3 &&
        userProblemRushData.get(req.user._id.toString()).freshQuestion
      ) {
        let question = await mongo.Ques.findOne({ _id: id }).exec();

        let correct = question.answer[0] == choice;

        //prevent them from getting credit from the same question 2 times
        userProblemRushData.get(req.user._id.toString()).freshQuestion = false;

        //increase score if it is correct
        if (correct) {
          userProblemRushData.get(req.user._id.toString()).score++;
        } else {
          userProblemRushData.get(req.user._id.toString()).wrong++;
        }
        // backend site data updates
        incrementSolveCounter(
          mongo.SiteData,
          question.subject[0].toLowerCase(),
          correct
        );
        addExperience(req, correct ? question.rating / 2 : question.rating / 4);
        updateCounters(req, question, correct);
        setQRating(
          question,
          correct ? Math.max(0, question.rating - 1) : question.rating + 1
        );

        res.json({
          status: 'Success',
          correct,
        });
      } else {
        res.status(403).json({
          status: 'Forbidden',
        });
      }
    } catch (err) {
      res.json({
        status: 'Error',
      });
    }
  });

  app.get('/train/rush/results', async (req, res) => {
    try {
      //if they already submited then return
      if (!userProblemRushData.get(req.user._id.toString()).submitted) {
        userProblemRushData.get(req.user._id.toString()).submitted = true;
        //use the server side data to get the score
        let score = userProblemRushData.get(req.user._id.toString()).score;
        await updateRushStats(req.user, score);
        updateRushAchievements(req.user, score);
        let user = await mongo.User.findOne({ _id: req.user._id }).exec();
        let highscore = user.stats.rush.highscore;
        res.json({
          status: 'Success',
          highscore,
        });
      } else {
        res.status(403).json({
          status: 'Forbidden',
        });
      }
    } catch (err) {
      res.json({
        status: 'Error',
      });
    }
  });

  app.get('/train/:subject/proficiency', (req, res) => {
    res.render(VIEWS + 'private/train/setProficiency.ejs', {
      subject: req.params.subject,
      pageName: req.params.subject + ' Proficiency',
    });
  });

  app.get('/train/:subject/chooseUnits', (req, res) => {
    const qNum = 1;
    if (req.user.rating[req.params.subject.toLowerCase()] == -1) {
      //check to see if redir needed
      res.redirect('/train/' + req.params.subject + '/proficiency'); //ROUTING FIX
    } else {
      res.render(VIEWS + 'private/train/chooseUnits.ejs', {
        subject: req.params.subject,
        units: subjectUnitDictionary[req.params.subject],
        qNum: qNum,
        unitPresets: presetUnitOptions[req.params.subject],
        pageName: 'Train Units',
      });
    }
  });

  app.get('/train/:subject/displayQuestion', async (req, res) => {
    let curQ = null;
    // no cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    // define units and attempt to get queued question
    const units = req.query.units.split(',');
    let q = '';
    if (req.user.stats.toAnswer[req.params.subject.toLowerCase()]) {
      q = await getQuestion(
        mongo.Ques,
        req.user.stats.toAnswer[req.params.subject.toLowerCase()]
      );
    }
    // get experience stats
    let experienceStats = await calculateLevel(req.user.stats.experience);
    // Test if they have a question pending to answer which is valid for their units selected
    if (q && units.some((r) => q.units.includes(r))) {
      res.render(VIEWS + 'private/train/displayQuestion.ejs', {
        units: units,
        newQues: q,
        subject: req.params.subject,
        user: req.user,
        experienceStats,
        pageName: 'Classic Trainer',
        referenceSheet
      });
    } else {
      // deduct 8 rating if previously queued question was skipped
      if (q) {
        skipQuestionUpdates(
          mongo.Ques,
          req,
          req.params.subject.toLowerCase(),
          q._id
        );
      }
      // get parameters set up
      if (req.user.rating['usabo'] === undefined) {
        setRating('USABO', -1, req);
      }

      if (req.user.rating['ess'] === undefined) {
        setRating('ESS', -1, req);
      }

      let ceilingFloor = ratingCeilingFloor(
        req.user.rating[req.params.subject.toLowerCase()]
      );
      const floor = ceilingFloor.floor;
      const ceiling = ceilingFloor.ceiling;
      // get question
      getQuestions(mongo.Ques, floor, ceiling, req.params.subject, units).then(
        (qs) => {
          // select random question
          curQ = qs[Math.floor(Math.random() * qs.length)];
          console.log(curQ);
          if (!curQ) {
            req.flash(
              'errorFlash',
              "We couldn't find any questions for your rating in the units you selected."
            );
            res.redirect('/train/' + req.params.subject + '/chooseUnits');
            return;
          }
          // update pending question field
          updateQuestionQueue(req, req.params.subject, curQ._id);
          // push to frontend
          res.render(VIEWS + 'private/train/displayQuestion.ejs', {
            units: units,
            newQues: curQ,
            subject: req.params.subject,
            user: req.user,
            experienceStats,
            pageName: 'Classic Trainer',
            referenceSheet
          });
        }
      );
    }
  });

  app.get('/train/displayQuestion/:id', async (req, res) => {
    let experienceStats = await calculateLevel(req.user.stats.experience);
    mongo.db
      .collection('questions')
      .findOne({ _id: mongoose.Types.ObjectId(req.params.id) })
      .then((question, err) => {
        if (!err) {
          res.render(VIEWS + 'private/train/displayQuestion.ejs', {
            units: question.units,
            newQues: question,
            subject: question.subject[0],
            user: req.user,
            experienceStats,
            pageName: 'Classic Trainer',
            disabled: true,
            referenceSheet
          });
        }
      });
  });
};
