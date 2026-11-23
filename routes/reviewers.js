// FUNCTION IMPORTS
const {
  subjectUnitDictionary,
  subjects,
} = require('../utils/constants/subjects');
const { isAdmin } = require('../utils/constants/sitesettings');
const {
  parseQuestionForm,
  parseUsaboForm,
} = require('../utils/functions/questionInput');
const { skippedIds, promoteReviewed } = require('../utils/functions/review');
const { toObjectId } = require('../utils/functions/ids');
const { asString, redirectBack, wrap } = require('../utils/functions/http');

const VIEWS = '../views/';

// Bank-specific wiring so the standard and USABO flows share one implementation.
const BANKS = {
  standard: {
    pending: 'pendingQuestions',
    live: 'questions',
    parse: (body) =>
      parseQuestionForm(body, { requireAuthor: true, requireTags: true }),
    reviewView: VIEWS + 'admin/train/editQuestion.ejs',
    listView: VIEWS + 'admin/train/reviewHomepage.ejs',
    empty: '/homepage',
    pageName: 'ADMIN Review Question',
    withDictionary: true,
  },
  usabo: {
    pending: 'usaboPendingQuestions',
    live: 'usaboQuestions',
    parse: (body) => parseUsaboForm(body, { requireAuthor: true }),
    reviewView: VIEWS + 'usabo/train/editQuestion.ejs',
    listView: VIEWS + 'usabo/train/reviewHomepage.ejs',
    empty: '/usaboHomepage',
    pageName: 'ADMIN Review USABO Question',
    withDictionary: false,
  },
};

// A refactor multiplier scales the estimated hours credited for a question.
function parseHours(body) {
  const current = Number(body.curFactor);
  const multiplier = Number(body.multiplier);
  const value = current * multiplier;
  return Number.isFinite(value) && value > 0 && value < 1000 ? value : null;
}

module.exports = (app, mongo) => {
  app.all(/^(\/reviewer).*$/, (req, res, next) => {
    if (
      req.isAuthenticated() &&
      (isAdmin(req.user) || req.user.reviewer === true)
    ) {
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

  /**
   * Saves a reviewer's edit. `reviewerID` is either the reviewer's own
   * contributor id (a review of a pending question, which counts toward
   * publication) or the literal 'isEdit' (an edit of an already live question).
   */
  const editHandler = (bank) =>
    wrap(async (req, res) => {
      const reviewerID = asString(req.body.reviewerID);
      const isEdit = reviewerID === 'isEdit';
      const isReview =
        Boolean(req.user.contributor) && reviewerID === req.user.contributor;
      const questionID = toObjectId(req.body.questionID);
      const { data } = bank.parse(req.body);
      if (!data || !questionID || (!isEdit && !isReview)) {
        return res.json({ success: false });
      }

      const collection = mongo.db.collection(isEdit ? bank.live : bank.pending);
      const filter = { _id: questionID };
      // authors may not review their own questions
      if (isReview) filter.author = { $ne: reviewerID };

      const update = { $set: data };
      if (isReview) update.$addToSet = { reviewers: reviewerID };

      const updated = await collection.findOneAndUpdate(filter, update, {
        returnDocument: 'after',
      });
      if (!updated) {
        return res.json({ success: false });
      }
      if (isReview) {
        await promoteReviewed(mongo, bank.pending, bank.live);
      }
      res.json({ success: true });
    });

  app.post('/reviewer/editQuestion', editHandler(BANKS.standard));
  app.post('/reviewer/editUSABOQuestion', editHandler(BANKS.usabo));

  const hourHandler = (collections) =>
    wrap(async (req, res) => {
      const questionID = toObjectId(req.body.questionID);
      const hours = parseHours(req.body);
      if (questionID && hours !== null) {
        await Promise.all(
          collections.map((name) =>
            mongo.db
              .collection(name)
              .updateOne(
                { _id: questionID },
                { $set: { hourRefactor: hours } },
              ),
          ),
        );
      }
      redirectBack(req, res, '/homepage');
    });

  app.post(
    '/reviewer/hourRefactor',
    hourHandler(['questions', 'pendingQuestions']),
  );
  app.post(
    '/reviewer/usaboHourRefactor',
    hourHandler(['usaboQuestions', 'usaboPendingQuestions']),
  );

  const reviewOneHandler = (bank) =>
    wrap(async (req, res) => {
      const id = toObjectId(req.query.id);
      const question =
        id &&
        (await mongo.db.collection(bank.pending).findOne({
          _id: { $eq: id, $nin: skippedIds(req) },
          reviewers: { $ne: req.user.contributor },
        }));
      if (!question) {
        req.flash('errorFlash', 'No questions to review');
        return res.redirect(bank.empty);
      }
      res.render(bank.reviewView, {
        isReview: true,
        ...(bank.withDictionary ? { subjectUnitDictionary } : {}),
        question,
        pageName: bank.pageName,
      });
    });

  app.get('/reviewer/reviewQuestion', reviewOneHandler(BANKS.standard));
  app.get('/reviewer/reviewUSABOQuestion', reviewOneHandler(BANKS.usabo));

  app.get(
    '/reviewer/reviewQuestions',
    wrap(async (req, res) => {
      await promoteReviewed(mongo, BANKS.standard.pending, BANKS.standard.live);
      const questions = await mongo.db
        .collection(BANKS.standard.pending)
        .find()
        .toArray();
      res.render(BANKS.standard.listView, { questions, subjects });
    }),
  );

  app.get(
    '/reviewer/reviewQuestions/:subject',
    wrap(async (req, res) => {
      const questions = await mongo.db
        .collection(BANKS.standard.pending)
        .find()
        .toArray();
      res.render(VIEWS + 'admin/train/reviewSubjects.ejs', {
        questions,
        subject: req.params.subject,
      });
    }),
  );

  app.get(
    '/reviewer/reviewUSABOQuestions',
    wrap(async (req, res) => {
      await promoteReviewed(mongo, BANKS.usabo.pending, BANKS.usabo.live);
      const questions = await mongo.db
        .collection(BANKS.usabo.pending)
        .find()
        .toArray();
      res.render(BANKS.usabo.listView, { questions });
    }),
  );
};
