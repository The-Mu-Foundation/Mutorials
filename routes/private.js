// FUNCTION IMPORTS
const {
  calculateLevel,
  analyze,
} = require('../utils/functions/siteAlgorithms');
const { isAdmin } = require('../utils/constants/sitesettings');
const {
  generateLeaderboard,
  getDailyQuestion,
  getSiteData,
  getAnnouncements,
  querySite,
} = require('../utils/functions/database');
const { tags } = require('../utils/constants/tags.js');
const { toObjectId } = require('../utils/functions/ids');
const { wrap } = require('../utils/functions/http');

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
  app.all(
    /^(\/announcements|\/homepage|\/question|\/search).*$/,
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

  app.get('/announcements', async (req, res) => {
    let announcements = await getAnnouncements(mongo.SiteData, 20);
    res.render(VIEWS + 'private/announcements.ejs', {
      announcements,
      pageName: 'Announcements',
    });
  });

  app.get('/homepage', async (req, res) => {
    let siteData = await getSiteData(mongo.User, mongo.Ques, mongo.SiteData);
    let experienceStats = await calculateLevel(req.user.stats.experience);
    const question = await getDailyQuestion(mongo.Daily, mongo.Ques);
    let announcements = await getAnnouncements(mongo.SiteData, 3);
    res.render(VIEWS + 'private/homepage.ejs', {
      user: req.user,
      siteStats: siteData,
      admin: isAdmin(req.user),
      experienceStats,
      question,
      announcements,
      subjectTags: tags,
    });
  });

  app.get(
    '/question/:id',
    wrap(async (req, res) => {
      const question =
        toObjectId(req.params.id) &&
        (await mongo.Ques.findById(req.params.id).exec());
      if (question) {
        res.render(VIEWS + 'private/question.ejs', {
          question,
          pageName: 'Question ' + question._id,
        });
      } else {
        req.flash(
          'errorFlash',
          "Error 404: File Not Found. That question doesn't exist.",
        );
        res.redirect('/');
      }
    }),
  );

  app.get('/search', async (req, res) => {
    let query = req.query;

    if (query) {
      let results = await querySite(query, mongo.User, mongo.Ques);
      res.render(VIEWS + 'private/search.ejs', {
        results,
        query,
        pageName: 'Search',
        subjectTags: tags,
      });
    } else {
      res.render(VIEWS + 'private/search.ejs', {
        results: [],
        query,
        pageName: 'Search',
        subjectTags: tags,
      });
    }
  });

  app.get('/logout', (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.redirect('/');
    }
    req.logout((err) => {
      if (err) return next(err);
      res.redirect('/');
    });
  });
};
