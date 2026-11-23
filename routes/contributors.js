const { subjectUnitDictionary } = require('../utils/constants/subjects');
const { isAdmin } = require('../utils/constants/sitesettings');
const { queryContributor } = require('../utils/functions/admin');
const {
  parseQuestionForm,
  parseUsaboForm,
} = require('../utils/functions/questionInput');
const { asString, wrap } = require('../utils/functions/http');

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
  app.all(/^(\/contributor).*$/, (req, res, next) => {
    if (req.isAuthenticated() && req.user.contributor) {
      next();
    } else {
      req.flash(
        'errorFlash',
        "Error 404: File Not Found. That page doesn't exist.",
      );
      res.redirect('/');
    }
  });

  app.post(
    '/contributors/addQuestion',
    wrap(async (req, res) => {
      const { data } = parseQuestionForm(req.body);
      if (!data) {
        return res.json({ success: false });
      }
      await new mongo.PendingQues({
        ...data,
        author: req.user.contributor, // never trust a client-supplied author
        reviewers: [],
      }).save();
      res.json({ success: true });
    }),
  );

  app.post(
    '/contributors/addUSABOQuestion',
    wrap(async (req, res) => {
      const { data } = parseUsaboForm(req.body);
      if (!data) {
        return res.json({ success: false });
      }
      await new mongo.USABOPendingQues({
        ...data,
        author: req.user.contributor,
        reviewers: [],
        stats: { pass: 0, fail: 0 },
      }).save();
      res.json({ success: true });
    }),
  );

  app.get('/contributors/addUSABOQuestion', (req, res) => {
    res.render(VIEWS + 'usabo/contributorAddQuestion.ejs', {
      pageName: 'CONTRIBUTOR Add USABO Question',
    });
  });

  app.get('/contributors/addQuestion', (req, res) => {
    res.render(VIEWS + 'contributors/contributorAddQuestion.ejs', {
      subjectUnitDictionary,
      pageName: 'CONTRIBUTOR Add Question',
    });
  });

  // Contributors may only query their own statistics; admins may query anyone.
  app.get(
    '/contributors/getContributorStats',
    wrap(async (req, res) => {
      const id = isAdmin(req.user)
        ? asString(req.query.id)
        : req.user.contributor;
      res.json(await queryContributor(id, mongo.Ques, mongo.PendingQues));
    }),
  );

  app.get('/contributors/stats', (req, res) => {
    res.render(VIEWS + 'contributors/contributorStats.ejs', {
      isAdmin: isAdmin(req.user),
      user: req.user,
      contributorID: req.user.contributor,
      pageName: 'CONTRIBUTOR Stats',
    });
  });
};
