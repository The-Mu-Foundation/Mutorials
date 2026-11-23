// FUNCTION IMPORTS
const { isAdmin } = require('../utils/constants/sitesettings');
const { skippedIds } = require('../utils/functions/review');
const { toObjectId } = require('../utils/functions/ids');
const { wrap } = require('../utils/functions/http');

const VIEWS = '../views/';

module.exports = (app, mongo) => {
  app.all(/^(\/admin).*$/, (req, res, next) => {
    if (req.isAuthenticated() && isAdmin(req.user)) {
      next();
    } else if (req.isAuthenticated()) {
      req.flash(
        'errorFlash',
        "Error 403: You don't have permission to access this resource.",
      );
      res.redirect('/');
    } else {
      req.flash(
        'errorFlash',
        "Error 404: File Not Found. That page doesn't exist.",
      );
      res.redirect('/');
    }
  });

  // ADMIN GET ROUTES
  app.get(
    '/admin/usaboAdminHomepage',
    wrap(async (req, res) => {
      const pending = mongo.db.collection('usaboPendingQuestions');
      const [numUser, numAll] = await Promise.all([
        pending.countDocuments({
          $and: [
            { reviewers: { $ne: req.user.contributor } },
            { _id: { $nin: skippedIds(req) } },
          ],
        }),
        pending.countDocuments({}),
      ]);
      res.render(VIEWS + 'usabo/adminHomepage.ejs', { numUser, numAll });
    }),
  );

  app.get('/admin/addUSABOquestion', (_, res) => {
    res.render(VIEWS + 'usabo/contributorAddQuestion.ejs', {
      pageName: 'ADMIN Add USABO Question',
    });
  });

  app.post(
    '/admin/deleteUSABOQuestion',
    wrap(async (req, res) => {
      const questionID = toObjectId(req.body.questionID);
      const result =
        questionID &&
        (await mongo.db
          .collection('usaboQuestions')
          .deleteOne({ _id: questionID }));
      if (!result || result.deletedCount !== 1) {
        req.flash('errorFlash', 'Question not found.');
      } else {
        req.flash('successFlash', 'Question deleted successfully.');
      }
      res.redirect('/admin/allUSABOQuestions');
    }),
  );

  // DATA ROUTE: Get USABO question stats
  app.get(
    '/admin/usaboQuestionStats',
    wrap(async (req, res) => {
      const allQuestions = await mongo.db
        .collection('usaboQuestions')
        .find()
        .toArray();
      const yearDist = {}; // distribution of questions across years
      for (const { year, round } of allQuestions) {
        if (!yearDist[year]) yearDist[year] = { semis: 0, open: 0 };
        for (const r of [].concat(round)) {
          if (r in yearDist[year]) yearDist[year][r]++;
        }
      }
      res.json({ yearDist: Object.entries(yearDist) });
    }),
  );

  // Master list of questions
  app.get(
    '/admin/allUSABOQuestions',
    wrap(async (req, res) => {
      const [leftToTransfer, questions] = await Promise.all([
        mongo.db.collection('questions').countDocuments({ subject: 'USABO' }),
        mongo.db.collection('usaboQuestions').find().toArray(),
      ]);
      res.render(VIEWS + 'usabo/train/allQuestions.ejs', {
        questions,
        leftToTransfer,
      });
    }),
  );

  app.get(
    '/admin/editUSABOQuestion',
    wrap(async (req, res) => {
      const id = toObjectId(req.query.id);
      const question =
        id &&
        (await mongo.db.collection('usaboQuestions').findOne({ _id: id }));
      if (!question) {
        req.flash('errorFlash', 'Question not found.');
        return res.redirect('/usaboHomepage');
      }
      res.render(VIEWS + 'usabo/train/editQuestion.ejs', {
        isReview: false,
        question,
        pageName: 'ADMIN Edit Question',
      });
    }),
  );

  // Legacy migration of USABO questions out of the generic bank. It mutates data,
  // so it is a POST (was a GET, which a cross-site <img> could trigger).
  app.post(
    '/admin/transfer',
    wrap(async (req, res) => {
      const tempQuestions = await mongo.db
        .collection('questions')
        .find({ subject: ['USABO'] })
        .toArray();
      for (let i = 0; i < Math.min(20, tempQuestions.length); i++) {
        let question = tempQuestions[i];

        // Extract units from "USABO - " format
        question.units = question.units.map((unit) => {
          const unitMatch = unit.match(/USABO - (.+)/);
          return unitMatch ? unitMatch[1] : unit;
        });

        // Grab necessary USABO attributes--more robust
        let year, problemNumber;
        let yearIdx;
        question.tags.forEach((tag, i) => {
          // Match year?
          if (tag.match(/\d{4}/)) {
            year = parseInt(tag);
            yearIdx = i;
          }

          // Match problem number?
          const problemNumberMatch = tag.match(/Problem: (\d+)/);
          if (problemNumberMatch) problemNumber = problemNumberMatch[1];
        });

        let newQ = new mongo.USABOQues({
          question: question.question,
          choices: question.choices,
          rating: question.rating,
          answer: question.answer,
          answer_ex: question.answer_ex,
          author: question.author,
          type: question.type,
          categories: question.units,
          year,
          problemNumber,
          round: question.tags[yearIdx + 2],
          stats: question.stats,
          writtenDate: question.writtenDate,
          subject: ['USABO'],
          reviewers: question.reviewers,
          hourRefactor: question.hourRefactor,
        });

        // delete the source only once the copy is safely stored
        await newQ.save();
        await mongo.db.collection('questions').deleteOne({ _id: question._id });
      }
      res.redirect('/admin/allUSABOQuestions');
    }),
  );
};
