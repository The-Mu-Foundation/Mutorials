// FUNCTION IMPORTS
const {
  ratingCeilingFloor,
  calculateLevel,
} = require('../utils/functions/siteAlgorithms');
const { referenceSheet } = require('../utils/constants/referencesheet');
const { updateQuestionQueue } = require('../utils/functions/database');
const {
  getUSABOQuestion,
  pickUSABOQuestion,
} = require('../utils/functions/usaboDatabase');
const {
  gradeAnswer,
  markServed,
  recordAnswer,
  recordSkip,
} = require('../utils/functions/answers');
const { toObjectId } = require('../utils/functions/ids');
const { asString, safeLocalPath, wrap } = require('../utils/functions/http');

const VIEWS = __dirname + '/../views/';
const PROFICIENCY_LEVELS = [600, 1200, 2400];
const CATEGORIES = [
  'Animal Anatomy and Physiology',
  'Plant Anatomy and Physiology',
  'Cell Biology',
  'Genetics and Evolution',
  'Ecology',
  'Ethology',
  'Biosystematics',
];

module.exports = (app, mongo) => {
  app.all(
    /^(\/private|\/usaboselQ|\/usaboTrain|\/trainUSABO).*$/,
    (req, res, next) => {
      if (req.isAuthenticated()) {
        next();
      } else {
        req.flash(
          'errorFlash',
          'Error 401: Unauthorized. You need to login to see this page.',
        );
        res.redirect('/');
      }
    },
  );

  app.post(
    '/private/initialUSABORating',
    wrap(async (req, res) => {
      const level = Number(req.body.level);
      if (!PROFICIENCY_LEVELS.includes(level)) {
        req.flash('errorFlash', 'Please choose a valid proficiency.');
        return res.redirect('/train/usabo/proficiency');
      }
      const result = await mongo.User.updateOne(
        {
          _id: req.user._id,
          $or: [{ 'rating.usabo': -1 }, { 'rating.usabo': { $exists: false } }],
        },
        { $set: { 'rating.usabo': level } },
      );
      if (result.modifiedCount !== 1) {
        req.flash(
          'errorFlash',
          "You've already set your proficiency for that subject",
        );
      }
      res.redirect('/train/usabo/chooseCategories');
    }),
  );

  app.post('/usaboselQ', (req, res) => {
    const requested = [].concat(req.body.categoryChoice || []);
    const categories = requested.filter((category) =>
      CATEGORIES.includes(category),
    );
    if (categories.length === 0) {
      req.flash('errorFlash', 'Please choose at least one category.');
      return res.redirect('/train/usabo/chooseCategories');
    }
    res.redirect(
      '/train/usabo/displayUSABOQuestion?categories=' +
        encodeURIComponent(categories.join(',')),
    );
  });

  app.post(
    '/train/checkUSABOAnswer',
    wrap(async (req, res) => {
      const question =
        toObjectId(req.body.id) &&
        (await getUSABOQuestion(mongo.USABOQues, req.body.id));
      if (!question) {
        req.flash('errorFlash', "That question doesn't exist.");
        return res.redirect('/trainUSABO');
      }

      const graded = gradeAnswer(question, req.body);
      if (!graded) {
        await recordSkip(mongo, {
          user: req.user,
          questionId: question._id,
          subject: 'USABO',
          bank: 'usabo',
        });
        req.flash(
          'errorFlash',
          'Please choose an answer next time... We treated that as a skip (-8 rating).',
        );
        return res.redirect(safeLocalPath(req.body.redirect, '/trainUSABO'));
      }

      const outcome = await recordAnswer(mongo, {
        user: req.user,
        question,
        correct: graded.correct,
        bank: 'usabo',
        mode: 'usabo',
        session: req.session,
      });

      res.render(VIEWS + 'usabo/train/answerExplanation.ejs', {
        categories: asString(req.body.categories),
        userAnswer: graded.userAnswer,
        userRating: req.user.rating.usabo,
        subject: 'USABO',
        newQues: question,
        correct: graded.correct,
        oldUserRating: outcome.oldUserRating,
        oldQ: outcome.oldQRating,
        user: req.user,
        experienceStats: calculateLevel(req.user.stats.experience),
        pageName: 'USABO Answer Explanation',
      });
    }),
  );

  app.get('/trainUSABO', (req, res) => {
    res.render(VIEWS + 'usabo/train/train.ejs', { pageName: 'Train USABO' });
  });

  app.get('/train/usabo/proficiency', (req, res) => {
    if (req.user.rating.usabo == -1 || req.user.rating.usabo === undefined) {
      res.render(VIEWS + 'usabo/train/setProficiency.ejs', {
        subject: 'USABO',
        pageName: 'USABO Proficiency',
      });
    } else {
      res.redirect('/trainUSABO');
    }
  });

  app.get('/train/usabo/chooseCategories', (req, res) => {
    if (req.user.rating.usabo == -1 || req.user.rating.usabo === undefined) {
      return res.redirect('/train/usabo/proficiency');
    }
    res.render(VIEWS + 'usabo/train/chooseCategories.ejs', {
      round: undefined,
      categories: CATEGORIES,
      qNum: 1,
      unitPresets: undefined,
      pageName: 'Train Categories',
    });
  });

  app.get(
    '/train/usabo/displayUSABOQuestion',
    wrap(async (req, res) => {
      // no cache
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const categories = asString(req.query.categories)
        .split(',')
        .filter((category) => CATEGORIES.includes(category));
      if (categories.length === 0) {
        req.flash('errorFlash', 'Please choose at least one category.');
        return res.redirect('/train/usabo/chooseCategories');
      }
      if (req.user.rating.usabo == -1 || req.user.rating.usabo === undefined) {
        return res.redirect('/train/usabo/proficiency');
      }

      let queued = null;
      const queuedId = req.user.stats.toAnswer.usabo;
      if (queuedId) {
        queued = await getUSABOQuestion(mongo.USABOQues, queuedId);
      }
      const experienceStats = calculateLevel(req.user.stats.experience);
      const render = (question) => {
        markServed(req.session, question._id);
        res.render(VIEWS + 'usabo/train/displayQuestion.ejs', {
          categories,
          newQues: question,
          subject: 'USABO',
          user: req.user,
          experienceStats,
          pageName: 'USABO Trainer',
          referenceSheet,
        });
      };

      // a pending question that matches the chosen categories is simply shown again
      if (
        queued &&
        categories.some((category) => queued.categories.includes(category))
      ) {
        return render(queued);
      }
      // a queued question outside the chosen categories counts as skipped
      if (queued) {
        await recordSkip(mongo, {
          user: req.user,
          questionId: queued._id,
          subject: 'USABO',
          bank: 'usabo',
        });
      }

      const { floor, ceiling } = ratingCeilingFloor(req.user.rating.usabo);
      const selected = await pickUSABOQuestion(mongo.USABOQues, {
        floor,
        ceiling,
        categories,
      });
      if (!selected) {
        req.flash(
          'errorFlash',
          "We couldn't find any questions for your rating in the categories you selected.",
        );
        return res.redirect('/train/usabo/chooseCategories');
      }
      await updateQuestionQueue(req, 'usabo', selected._id);
      render(selected);
    }),
  );
};
