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
const {
  getUSABOQuestion,
  getUSABOQuestions,
} = require('../utils/functions/usaboDatabase');

// LIBRARY IMPORTS
let pluralize = require('pluralize');

const VIEWS = __dirname + '/../views/';
const CATEGORIES = [
  'Animal Anatomy and Physiology',
  'Plant Anatomy and Physiology',
  'Cell Biology',
  'Genetics and Evolution',
  'Ecology',
  'Ethology',
  'Biosystematics',
];
const ROUNDS = ['open', 'semis'];

module.exports = (app, mongo) => {
  app.all(/^(\/private|\/usaboselQ|\/usaboTrain).*$/, (req, res, next) => {
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

  app.post('/private/initialUSABORating', (req, res, next) => {
    if (req.user.rating['usabo'] == -1) {
      req.user.rating['usabo'] = req.body.level;
      mongo.db
        .collection('users')
        .findOneAndUpdate(
          { username: req.user.username },
          { $set: { rating: req.user.rating } }
        );
    } else {
      req.flash(
        'errorFlash',
        "You've already set your proficiency for that subject"
      );
    }
    res.redirect('/train/' + 'usabo' + '/chooseCategories');
  });

  app.post('/usaboselQ', (req, res, next) => {
    let categories = null;
    if (req.body.qNum == 1) {
      categories = req.body.categoryChoice;
      if (!categories) {
        req.flash('errorFlash', 'Please choose at least one category.');
        res.redirect('/train/usabo/chooseCategories');
      }
      if (categories) {
        res.redirect(
          '/train/usabo/displayUSABOQuestion?categories=' +
            categories.toString()
        );
      }
    }
  });

  app.post('/train/checkUSABOAnswer', (req, res, next) => {
    if (req.body.type == 'mc' && req.body.answerChoice != undefined) {
      let isRight = false;
      const antsy = getQuestion(mongo.USABOQues, req.body.id).then(
        async (antsy) => {
          // clear pending question
          clearQuestionQueue(req, antsy.subject[0]);

          // check answer
          if (antsy.answer[0] == req.body.answerChoice) {
            isRight = true;
          }

          // modify ratings
          const oldUserRating = req.user.rating['usabo'];
          const oldQRating = antsy.rating;
          // update stats
          if (req.user.stats.lastAnswered != antsy._id) {
            setRating(
              'usabo',
              calculateRatings(oldUserRating, oldQRating, isRight)
                .newUserRating,
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
            incrementSolveCounter(mongo.SiteData, 'usabo', isRight);
          } else {
            // update tracker
            updateTracker(req, antsy);
            addExperience(req, Math.ceil(antsy.rating / 20));
          }

          // update achievements
          updateTrainAchievements(req.user, antsy, isRight);

          // render answer page
          let experienceStats = await calculateLevel(req.user.stats.experience);
          res.render(VIEWS + 'usabo/train/answerExplanation.ejs', {
            categories: req.body.categories,
            userAnswer: req.body.answerChoice,
            userRating: getRating('USABO', req),
            subject: 'USABO',
            newQues: antsy,
            correct: isRight,
            oldUserRating: oldUserRating,
            oldQ: oldQRating,
            user: req.user,
            experienceStats,
            pageName: 'USABO Answer Explanation',
          });
        }
      );
    } else if (req.body.type == 'sa' && req.body.saChoice != undefined) {
      let isRight = false;
      const antsy = getQuestion(mongo.USABOQues, req.body.id).then(
        async (antsy) => {
          // clear pending question
          clearQuestionQueue(req, antsy.subject[0]);

          // check answer
          isRight = arraysEqual(antsy.answer, req.body.saChoice);

          // modify ratings
          const oldUserRating = req.user.rating['USABO'];
          const oldQRating = antsy.rating;
          // update stats
          if (req.user.stats.lastAnswered != antsy._id) {
            setRating(
              'USABO',
              calculateRatings(oldUserRating, oldQRating, isRight)
                .newUserRating,
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
            incrementSolveCounter(mongo.SiteData, 'USABO', isRight);
          } else {
            // update tracker
            updateTracker(req, antsy);
            addExperience(req, Math.ceil(antsy.rating / 20));
          }

          // update achievements
          updateTrainAchievements(req.user, antsy, isRight);

          // render answer page
          let experienceStats = await calculateLevel(req.user.stats.experience);
          res.render(VIEWS + 'usabo/train/answerExplanation.ejs', {
            categories: req.body.categories,
            userAnswer: req.body.saChoice,
            userRating: getRating('usabo', req),
            subject: 'USABO',
            newQues: antsy,
            correct: isRight,
            oldUserRating: oldUserRating,
            oldQ: oldQRating,
            user: req.user,
            experienceStats,
            pageName: ' USABO Answer Explanation',
          });
        }
      );
    } else if (req.body.type == 'fr' && req.body.freeAnswer != '') {
      let isRight = false;
      const antsy = getQuestion(mongo.USABOQues, req.body.id).then(
        async (antsy) => {
          // clear pending question
          clearQuestionQueue(req, 'USABO');

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
              'usabo',
              calculateRatings(oldUserRating, oldQRating, isRight)
                .newUserRating,
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
            incrementSolveCounter(mongo.SiteData, 'usabo', isRight);
          } else {
            // update tracker
            updateTracker(req, antsy);
            addExperience(req, Math.ceil(antsy.rating / 20));
          }

          // update achievements
          updateTrainAchievements(req.user, antsy, isRight);

          // render answer page
          let experienceStats = await calculateLevel(req.user.stats.experience);
          res.render(VIEWS + 'usabo/train/answerExplanation.ejs', {
            categories: req.body.categories,
            userAnswer: req.body.freeAnswer,
            userRating: getRating('USABO', req),
            subject: 'USABO',
            newQues: antsy,
            correct: isRight,
            oldUserRating: oldUserRating,
            oldQ: oldQRating,
            user: req.user,
            experienceStats,
            pageName: 'USABO Answer Explanation',
          });
        }
      );
    } else {
      req.flash(
        'errorFlash',
        'Please choose an answer next time... We treated that as a skip (-8 rating).'
      );
      skipQuestionUpdates(mongo.USABOQues, req, 'USABO', req.body.id);
      clearQuestionQueue(req, 'USABO');
      res.redirect(req.body.redirect);
    }
  });

  app.get('/trainUSABO', (req, res) => {
    res.render(VIEWS + 'usabo/train/train.ejs', { pageName: 'Train USABO' });
  });

  app.get('/train/usabo/proficiency', (req, res) => {
    if (req.user.rating[req.params.round.toLowerCase()] == -1) {
      res.render(VIEWS + 'usabo/train/setProficiency.ejs', {
        subject: 'USABO',
        pageName: 'USABO Proficiency',
      });
    } else {
      res.redirect('/trainUSABO');
    }
  });

  app.get('/train/usabo/chooseCategories', (req, res) => {
    const qNum = 1;
    if (req.user.rating[req.params.round] == -1) {
      //check to see if redir needed
      res.redirect('/train/' + 'usabo' + '/proficiency'); //ROUTING FIX
    } else {
      res.render(VIEWS + 'usabo/train/chooseCategories.ejs', {
        round: req.params.round,
        categories: CATEGORIES,
        qNum: qNum,
        unitPresets: presetUnitOptions[req.params.round],
        pageName: 'Train Categories',
      });
    }
  });

  app.get('/train/usabo/displayUSABOQuestion', async (req, res) => {
    let curQ = null;
    // no cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    // define units and attempt to get queued question
    const categories = req.query.categories.split(',');
    let q = '';
    if (req.user.stats.toAnswer['usabo']) {
      q = await getUSABOQuestion(
        mongo.USABOQues,
        req.user.stats.toAnswer['usabo']
      );
    }
    // get experience stats
    let experienceStats = await calculateLevel(req.user.stats.experience);
    // Test if they have a question pending to answer which is valid for their units selected
    if (q && categories.some((r) => q.categories.includes(r))) {
      res.render(VIEWS + 'usabo/train/displayQuestion.ejs', {
        categories: categories,
        newQues: q,
        subject: 'USABO',
        user: req.user,
        experienceStats,
        pageName: 'USABO Trainer',
        referenceSheet
      });
    } else {
      // deduct 8 rating if previously queued question was skipped
      if (q) {
        skipQuestionUpdates(mongo.USABOQues, req, 'USABO', q._id);
      }
      // get parameters set up
      let ceilingFloor = ratingCeilingFloor(req.user.rating['usabo']);
      const floor = ceilingFloor.floor;
      const ceiling = ceilingFloor.ceiling;
      // get question
      getUSABOQuestions(mongo.USABOQues, floor, ceiling, categories).then(
        (qs) => {
          // select random question
          curQ = qs[Math.floor(Math.random() * qs.length)];
          console.log(curQ);
          if (!curQ) {
            req.flash(
              'errorFlash',
              "We couldn't find any questions for your rating in the categories you selected."
            );
            res.redirect('/train/' + 'usabo' + '/chooseCategories');
            return;
          }
          // update pending question field
          updateQuestionQueue(req, 'usabo', curQ._id);
          // push to frontend
          res.render(VIEWS + 'usabo/train/displayQuestion.ejs', {
            categories: categories,
            newQues: curQ,
            subject: 'USABO',
            user: req.user,
            experienceStats,
            pageName: 'USABO Trainer',
            referenceSheet
          });
        }
      );
    }
  });
};
