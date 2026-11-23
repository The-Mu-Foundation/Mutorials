// FUNCTION IMPORTS
const {
  subjectUnitDictionary,
  subjects,
} = require('../utils/constants/subjects');
const { isAdmin } = require('../utils/constants/sitesettings');
const {
  getSiteData,
  getAnnouncements,
} = require('../utils/functions/database');
const { getAdminData, queryContributor } = require('../utils/functions/admin');
const { parseQuestionForm } = require('../utils/functions/questionInput');
const { skippedIds } = require('../utils/functions/review');
const { toObjectId } = require('../utils/functions/ids');
const { asString, redirectBack, wrap } = require('../utils/functions/http');

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

  app.post(
    '/admin/addAnnouncement',
    wrap(async (req, res) => {
      const title = asString(req.body.title).trim();
      const text = asString(req.body.text).trim();
      if (!title || !text) {
        return res.json({ status: 'Error' });
      }
      await mongo.SiteData.updateOne(
        { tag: 'ANNOUNCEMENTS' },
        {
          $push: {
            'data.site': {
              date: new Date().toISOString(),
              author: asString(req.body.author).trim(),
              title,
              text,
            },
          },
        },
        { upsert: true },
      );
      res.json({ status: 'Success' });
    }),
  );

  app.post(
    '/admin/addquestion',
    wrap(async (req, res) => {
      const { data } = parseQuestionForm(req.body, {
        requireAuthor: true,
        requireTags: true,
      });
      if (!data) {
        return res.json({ success: false });
      }
      await new mongo.Ques({
        ...data,
        hourRefactor: 1,
        stats: { pass: 0, fail: 0 },
      }).save();
      res.json({ success: true });
    }),
  );

  app.post(
    '/admin/deleteQuestion',
    wrap(async (req, res) => {
      const questionID = toObjectId(req.body.questionID);
      const deleted =
        questionID && (await mongo.Ques.deleteOne({ _id: questionID }));
      if (!deleted || deleted.deletedCount !== 1) {
        req.flash('errorFlash', 'Question not found.');
      } else {
        req.flash('successFlash', 'Question deleted successfully.');
      }
      res.redirect('/admin/allQuestions');
    }),
  );

  app.post(
    '/admin/addContributor',
    wrap(async (req, res) => {
      const result = await mongo.User.updateOne(
        { ign: asString(req.body.contributorUsername) },
        { $set: { contributor: asString(req.body.contributorID) } },
      );
      result.matchedCount === 0
        ? req.flash('errorFlash', 'Contributor not found.')
        : req.flash('successFlash', 'Contributor successfully added!');
      res.redirect('/homepage');
    }),
  );

  app.post(
    '/admin/promoteContributor',
    wrap(async (req, res) => {
      const contributorID = asString(req.body.contributorID);
      const result = contributorID
        ? await mongo.User.updateOne(
            { contributor: contributorID },
            { $set: { reviewer: true } },
          )
        : { matchedCount: 0 };
      result.matchedCount === 0
        ? req.flash('errorFlash', 'Contributor not found.')
        : req.flash('successFlash', 'Contributor successfully promoted!');
      redirectBack(req, res, '/homepage');
    }),
  );

  app.post('/admin/skipQuestion', (req, res) => {
    const id = toObjectId(req.body.questionID);
    const skipped = skippedIds(req).map(String);
    if (id) skipped.push(String(id));
    res
      .cookie('skipQuestions', skipped.slice(-200), {
        httpOnly: true,
        sameSite: 'lax',
      })
      .json({ success: true });
  });

  //ADMIN GET ROUTES

  app.get(
    '/admin/adminHomepage',
    wrap(async (req, res) => {
      const pending = mongo.db.collection('pendingQuestions');
      const [numUser, numAll] = await Promise.all([
        pending.countDocuments({
          $and: [
            { reviewers: { $ne: req.user.contributor } },
            { _id: { $nin: skippedIds(req) } },
          ],
        }),
        pending.countDocuments({}),
      ]);
      res.render(VIEWS + 'admin/adminHomepage.ejs', { numUser, numAll });
    }),
  );

  app.get('/admin/addquestion', (_, res) => {
    res.render(VIEWS + 'admin/train/addQuestion.ejs', {
      subjectUnitDictionary,
      pageName: 'ADMIN Add Question',
    });
  });

  app.get('/admin/addedSuccess', (_, res) => {
    res.render(VIEWS + 'admin/train/addQuestionSuccess.ejs', {
      pageName: 'ADMIN AddQ Success',
    });
  });

  app.get('/admin/addedFailure', (_, res) => {
    res.render(VIEWS + 'admin/train/addQuestionFailure.ejs', {
      pageName: 'ADMIN AddQ Fail',
    });
  });

  app.get(
    '/admin/analytics',
    wrap(async (_, res) => {
      const [siteData, adminData] = await Promise.all([
        getSiteData(mongo.User, mongo.Ques, mongo.SiteData),
        getAdminData(mongo.User, mongo.Ques, mongo.SiteData),
      ]);
      res.render(VIEWS + 'admin/analytics.ejs', {
        siteData,
        adminData,
        pageName: 'ADMIN Analytics',
      });
    }),
  );

  app.get(
    '/admin/announcements',
    wrap(async (_, res) => {
      const announcements = await getAnnouncements(mongo.SiteData, 10);
      res.render(VIEWS + 'admin/announcements.ejs', {
        announcements,
        pageName: 'ADMIN Announcements',
      });
    }),
  );

  app.get('/admin/contributorStats', (_, res) => {
    res.render(VIEWS + 'admin/contributorStats.ejs', {
      pageName: 'ADMIN Contributor Stats',
    });
  });

  app.get(
    '/admin/getContributorStats',
    wrap(async (req, res) => {
      res.json(
        await queryContributor(
          asString(req.query.id),
          mongo.Ques,
          mongo.PendingQues,
        ),
      );
    }),
  );

  // Master list of questions
  app.get(
    '/admin/allQuestions',
    wrap(async (req, res) => {
      const allQuestions = await mongo.Ques.find().lean().exec();
      res.render(VIEWS + 'admin/train/allQuestions.ejs', {
        questions: allQuestions,
        subjects,
      });
    }),
  );

  app.get(
    '/admin/editQuestion',
    wrap(async (req, res) => {
      const id = toObjectId(req.query.id);
      const question = id && (await mongo.Ques.findById(id).lean().exec());
      if (!question) {
        req.flash('errorFlash', 'Question not found.');
        return res.redirect('/homepage');
      }
      res.render(VIEWS + 'admin/train/editQuestion.ejs', {
        isReview: false,
        subjectUnitDictionary,
        question,
        pageName: 'ADMIN Edit Question',
      });
    }),
  );

  app.get(
    '/admin/allQuestions/:subject',
    wrap(async (req, res) => {
      const allQuestions = await mongo.Ques.find().lean().exec();
      res.render(VIEWS + 'admin/train/subjectQuestions.ejs', {
        questions: allQuestions,
        subject: req.params.subject,
      });
    }),
  );
};
