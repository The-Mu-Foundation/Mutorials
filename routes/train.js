// FUNCTION IMPORTS
const {
  ratingCeilingFloor,
  calculateLevel,
} = require('../utils/functions/siteAlgorithms');
const { presetUnitOptions } = require('../utils/constants/presets');
const { subjectUnitDictionary } = require('../utils/constants/subjects');
const { referenceSheet } = require('../utils/constants/referencesheet');
const {
  getQuestion,
  pickQuestion,
  getDailyQuestion,
  updateQuestionQueue,
  updateRushStats,
  updateRushAchievements,
} = require('../utils/functions/database');
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
const RUSH_DURATION_MS = 300000;

// maps any casing of a subject name onto its canonical key, or null
function canonicalSubject(value) {
  const wanted = asString(value).toLowerCase();
  return (
    Object.keys(subjectUnitDictionary).find(
      (name) => name.toLowerCase() === wanted,
    ) || null
  );
}

// keeps only units that exist for the subject
function validUnits(subject, requested) {
  const known = subjectUnitDictionary[subject] || [];
  return (Array.isArray(requested) ? requested : [requested]).filter(
    (unit) => typeof unit === 'string' && known.includes(unit),
  );
}

module.exports = (app, mongo) => {
  app.all(/^(\/private|\/selQ|\/train).*$/, (req, res, next) => {
    if (req.isAuthenticated()) {
      next();
    } else {
      req.flash(
        'errorFlash',
        'Error 401: Unauthorized. You need to login to see this page.',
      );
      res.redirect('/signin');
    }
  });

  // initial proficiency; only settable while the subject is still unrated
  app.post(
    '/private/initialRating',
    wrap(async (req, res) => {
      const subject = canonicalSubject(req.body.subject);
      const level = Number(req.body.level);
      if (
        !subject ||
        subject === 'USABO' ||
        !PROFICIENCY_LEVELS.includes(level)
      ) {
        req.flash(
          'errorFlash',
          'Please choose a valid subject and proficiency.',
        );
        return res.redirect('/homepage');
      }
      const field = 'rating.' + subject.toLowerCase();
      await mongo.User.updateOne(
        {
          _id: req.user._id,
          $or: [{ [field]: -1 }, { [field]: { $exists: false } }],
        },
        { $set: { [field]: level } },
      );
      res.redirect('/homepage');
    }),
  );

  app.post('/selQ', (req, res) => {
    const subject = canonicalSubject(req.body.subj);
    if (!subject) {
      req.flash('errorFlash', 'Please choose a subject.');
      return res.redirect('/train/chooseSubject');
    }
    const units = validUnits(subject, req.body.unitChoice);
    if (units.length === 0) {
      req.flash('errorFlash', 'Please choose at least one unit.');
      return res.redirect('/train/' + subject + '/chooseUnits');
    }
    res.redirect(
      '/train/' +
        subject +
        '/displayQuestion?units=' +
        encodeURIComponent(units.join(',')),
    );
  });

  app.post(
    '/train/checkAnswer',
    wrap(async (req, res) => {
      const question =
        toObjectId(req.body.id) && (await getQuestion(mongo.Ques, req.body.id));
      if (!question) {
        req.flash('errorFlash', "That question doesn't exist.");
        return res.redirect('/train');
      }
      const subjectName = question.subject[0];
      const subjectKey = subjectName.toLowerCase();

      const graded = gradeAnswer(question, req.body);
      if (!graded) {
        await recordSkip(mongo, {
          user: req.user,
          questionId: question._id,
          subject: subjectName,
        });
        req.flash(
          'errorFlash',
          'Please choose an answer next time... We treated that as a skip (-8 rating).',
        );
        return res.redirect(safeLocalPath(req.body.redirect, '/train'));
      }

      // mark as seen for the current session (prevents in-session repeats)
      req.session.seenQuestions = req.session.seenQuestions || {};
      const seen = (req.session.seenQuestions[subjectKey] =
        req.session.seenQuestions[subjectKey] || []);
      if (!seen.includes(String(question._id))) {
        seen.push(String(question._id));
      }

      const outcome = await recordAnswer(mongo, {
        user: req.user,
        question,
        correct: graded.correct,
        mode: 'classic',
        session: req.session,
      });

      const experienceStats = calculateLevel(req.user.stats.experience);
      res.render(VIEWS + 'private/train/answerExplanation.ejs', {
        units: asString(req.body.units),
        userAnswer: graded.userAnswer,
        userRating: req.user.rating[subjectKey],
        subject: subjectName,
        newQues: question,
        correct: graded.correct,
        oldUserRating: outcome.oldUserRating,
        oldQ: outcome.oldQRating,
        user: req.user,
        experienceStats,
        pageName: 'Answer Explanation',
      });
    }),
  );

  app.post(
    '/train/skipQuestion',
    wrap(async (req, res) => {
      const subject = canonicalSubject(req.body.subject);
      if (subject && toObjectId(req.body.id)) {
        await recordSkip(mongo, {
          user: req.user,
          questionId: req.body.id,
          subject,
        });
      }
      res.redirect(safeLocalPath(req.body.redirect, '/train'));
    }),
  );

  app.get('/train', (req, res) => {
    res.render(VIEWS + 'private/train/train.ejs', { pageName: 'Train' });
  });

  app.get('/train/chooseSubject', (req, res) => {
    res.render(VIEWS + 'private/train/chooseSubject.ejs', {
      subjects: subjectUnitDictionary,
      qNum: 0,
      pageName: 'Train Subject',
    });
  });

  app.get(
    '/train/daily',
    wrap(async (req, res) => {
      const date = new Date().toISOString().split('T')[0];
      const question = await getDailyQuestion(mongo.Daily, mongo.Ques);
      res.render(VIEWS + 'private/train/dailyQuestion.ejs', {
        question,
        pageName: date + ' Challenge',
      });
    }),
  );

  // ---- Problem Rush: state lives in the session, so it survives restarts and
  // works across multiple server instances.
  app.get('/train/rush', (req, res) => {
    res.render(VIEWS + 'private/train/rush.ejs', { pageName: 'Problem Rush' });
  });

  app.get(
    '/train/rush/loadQuestion',
    wrap(async (req, res) => {
      try {
        if (parseInt(req.query.score) === -1 || !req.session.rush) {
          req.session.rush = {
            start: Date.now(),
            score: 0,
            wrong: 0,
            submitted: false,
          };
        }
        const rush = req.session.rush;
        const score = rush.score;
        let lowerBound = score === 0 ? 0 : 500 + score * 100;
        let upperBound = 500 + (score + 1) * 100 - 1;

        let selection = null;
        // widen the rating window a bounded number of times instead of looping forever
        for (let attempt = 0; attempt < 40 && !selection; attempt++) {
          const [picked] = await mongo.Ques.aggregate([
            {
              $match: {
                type: 'mc',
                rating: { $gte: lowerBound, $lte: upperBound },
              },
            },
            { $sample: { size: 1 } },
          ]);
          selection = picked;
          lowerBound -= 50;
          upperBound += 50;
        }
        if (!selection) {
          return res.json({ status: 'Error' });
        }
        rush.questionID = String(selection._id);
        rush.freshQuestion = true;
        res.json({
          status: 'Success',
          id: selection._id,
          subject: selection.subject[0],
          rating: selection.rating,
          statement: selection.question,
          choices: selection.choices,
        });
      } catch (err) {
        console.error('rush loadQuestion failed:', err);
        res.json({ status: 'Error' });
      }
    }),
  );

  app.get(
    '/train/rush/checkAnswer',
    wrap(async (req, res) => {
      try {
        const rush = req.session.rush;
        const id = asString(req.query.id);
        // not started / time is up / different question / 3 wrong / already answered
        if (
          !rush ||
          Date.now() - rush.start >= RUSH_DURATION_MS ||
          rush.questionID !== id ||
          rush.wrong >= 3 ||
          !rush.freshQuestion
        ) {
          return res.status(403).json({ status: 'Forbidden' });
        }
        const question = await mongo.Ques.findById(id).exec();
        if (!question) {
          return res.status(403).json({ status: 'Forbidden' });
        }
        const correct = String(question.answer[0]) === String(req.query.index);

        // prevent credit from the same question twice
        rush.freshQuestion = false;
        if (correct) {
          rush.score++;
        } else {
          rush.wrong++;
        }

        const subjectKey = question.subject[0].toLowerCase();
        const xp = Math.round(
          correct ? question.rating / 2 : question.rating / 4,
        );
        const solved = correct ? 'stats.correct' : 'stats.wrong';
        await Promise.all([
          mongo.SiteData.updateOne(
            { tag: 'QUESTIONS' },
            {
              $inc: {
                ['data.attempts.' + subjectKey]: 1,
                ...(correct ? { ['data.solves.' + subjectKey]: 1 } : {}),
              },
            },
          ),
          mongo.User.updateOne(
            { _id: req.user._id },
            { $inc: { 'stats.experience': xp, [solved]: 1 } },
          ),
          mongo.Ques.updateOne(
            { _id: question._id },
            {
              $inc: { [correct ? 'stats.pass' : 'stats.fail']: 1 },
              $set: {
                rating: correct
                  ? Math.max(0, question.rating - 1)
                  : question.rating + 1,
              },
            },
          ),
        ]);
        res.json({ status: 'Success', correct });
      } catch (err) {
        console.error('rush checkAnswer failed:', err);
        res.json({ status: 'Error' });
      }
    }),
  );

  app.get(
    '/train/rush/results',
    wrap(async (req, res) => {
      try {
        const rush = req.session.rush;
        if (!rush || rush.submitted) {
          return res.status(403).json({ status: 'Forbidden' });
        }
        rush.submitted = true;
        // the server-side score is the only one trusted
        await updateRushStats(req.user, rush.score);
        await updateRushAchievements(req.user, rush.score);
        const user = await mongo.User.findById(req.user._id).exec();
        res.json({ status: 'Success', highscore: user.stats.rush.highscore });
      } catch (err) {
        console.error('rush results failed:', err);
        res.json({ status: 'Error' });
      }
    }),
  );

  app.get('/train/:subject/proficiency', (req, res) => {
    const subject = canonicalSubject(req.params.subject);
    if (!subject) return res.redirect('/train/chooseSubject');
    res.render(VIEWS + 'private/train/setProficiency.ejs', {
      subject,
      pageName: subject + ' Proficiency',
    });
  });

  app.get('/train/:subject/chooseUnits', (req, res) => {
    const subject = canonicalSubject(req.params.subject);
    if (!subject) return res.redirect('/train/chooseSubject');
    if (req.user.rating[subject.toLowerCase()] == -1) {
      // proficiency has to be chosen first
      return res.redirect('/train/' + subject + '/proficiency');
    }
    res.render(VIEWS + 'private/train/chooseUnits.ejs', {
      subject,
      units: subjectUnitDictionary[subject],
      qNum: 1,
      unitPresets: presetUnitOptions[subject],
      pageName: 'Train Units',
    });
  });

  app.get(
    '/train/:subject/displayQuestion',
    wrap(async (req, res) => {
      const subject = canonicalSubject(req.params.subject);
      if (!subject) return res.redirect('/train/chooseSubject');
      const subjectKey = subject.toLowerCase();

      // no cache
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const units = validUnits(subject, asString(req.query.units).split(','));
      if (units.length === 0) {
        req.flash('errorFlash', 'Please choose at least one unit.');
        return res.redirect('/train/' + subject + '/chooseUnits');
      }
      if (
        req.user.rating[subjectKey] === undefined ||
        req.user.rating[subjectKey] === -1
      ) {
        return res.redirect('/train/' + subject + '/proficiency');
      }

      // session-scoped seen-question tracker (prevents in-session repeats)
      req.session.seenQuestions = req.session.seenQuestions || {};
      const seenIds = (req.session.seenQuestions[subjectKey] =
        req.session.seenQuestions[subjectKey] || []);

      let queued = null;
      const queuedId = req.user.stats.toAnswer[subjectKey];
      if (queuedId) {
        // a question already answered this session is dropped without penalty
        if (seenIds.includes(String(queuedId))) {
          await mongo.User.updateOne(
            { _id: req.user._id },
            { $set: { ['stats.toAnswer.' + subjectKey]: '' } },
          );
          req.user.stats.toAnswer[subjectKey] = '';
        } else {
          queued = await getQuestion(mongo.Ques, queuedId);
        }
      }

      const experienceStats = calculateLevel(req.user.stats.experience);
      const render = (question) => {
        markServed(req.session, question._id);
        res.render(VIEWS + 'private/train/displayQuestion.ejs', {
          units,
          newQues: question,
          subject,
          user: req.user,
          experienceStats,
          pageName: 'Classic Trainer',
          referenceSheet,
        });
      };

      // a pending question that matches the chosen units is simply shown again
      if (queued && units.some((unit) => queued.units.includes(unit))) {
        return render(queued);
      }

      // a queued question outside the chosen units counts as skipped
      if (queued) {
        await recordSkip(mongo, {
          user: req.user,
          questionId: queued._id,
          subject,
        });
      }

      const { floor, ceiling } = ratingCeilingFloor(
        req.user.rating[subjectKey],
      );
      // retry-and-widen: push ceiling up until unseen questions appear
      let selected = null;
      let currentCeiling = ceiling;
      for (let i = 0; i < 5 && !selected; i++) {
        selected = await pickQuestion(mongo.Ques, {
          floor,
          ceiling: currentCeiling,
          subject,
          units,
          excludeIds: seenIds,
        });
        currentCeiling += 200;
      }
      // the user has exhausted the unseen pool: allow a repeat rather than erroring
      if (!selected) {
        selected = await pickQuestion(mongo.Ques, {
          floor,
          ceiling: currentCeiling,
          subject,
          units,
        });
      }
      if (!selected) {
        req.flash(
          'errorFlash',
          "We couldn't find any questions for your rating in the units you selected.",
        );
        return res.redirect('/train/' + subject + '/chooseUnits');
      }

      await updateQuestionQueue(req, subject, selected._id);
      render(selected);
    }),
  );

  app.get(
    '/train/displayQuestion/:id',
    wrap(async (req, res) => {
      const question =
        toObjectId(req.params.id) &&
        (await getQuestion(mongo.Ques, req.params.id));
      if (!question) {
        req.flash(
          'errorFlash',
          "Error 404: File Not Found. That question doesn't exist.",
        );
        return res.redirect('/');
      }
      res.render(VIEWS + 'private/train/displayQuestion.ejs', {
        units: question.units,
        newQues: question,
        subject: question.subject[0],
        user: req.user,
        experienceStats: calculateLevel(req.user.stats.experience),
        pageName: 'Classic Trainer',
        disabled: true,
        referenceSheet,
      });
    }),
  );
};
