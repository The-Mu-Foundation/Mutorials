// FUNCTION IMPORTS
const { calculateLevel } = require('../utils/functions/siteAlgorithms');
const { isAdmin } = require('../utils/constants/sitesettings');
const {
  getDailyQuestion,
  getSiteData,
  getAnnouncements,
} = require('../utils/functions/database');
const { wrap } = require('../utils/functions/http');

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
  app.all(
    /^(\/announcements|\/homepage|\/usaboHomepage|\/search).*$/,
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

  app.get(
    '/usaboHomepage',
    wrap(async (req, res) => {
      const [siteStats, experienceStats, question, announcements] =
        await Promise.all([
          getSiteData(mongo.User, mongo.Ques, mongo.SiteData),
          calculateLevel(req.user.stats.experience),
          getDailyQuestion(mongo.Daily, mongo.Ques),
          getAnnouncements(mongo.SiteData, 3),
        ]);
      res.render(VIEWS + 'usabo/homepage.ejs', {
        user: req.user,
        siteStats,
        admin: isAdmin(req.user),
        experienceStats,
        question,
        announcements,
      });
    }),
  );
};
