// FUNCTION IMPORTS
const {
  calculateLevel,
  analyze,
} = require('../utils/functions/siteAlgorithms');
const { tags } = require('../utils/constants/tags');
const { achievementDescriptions } = require('../utils/constants/achievements');
const { generateLeaderboard } = require('../utils/functions/database');
const { wrap } = require('../utils/functions/http');

// strips credentials and reset state before a user document reaches a template
const publicUser = (doc) => {
  const plain = doc.toObject ? doc.toObject() : { ...doc };
  delete plain.hash;
  delete plain.salt;
  delete plain.passwordReset;
  delete plain.email_confirm_code;
  return plain;
};

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
  app.all(/^(\/leaderboard|\/profile|\/stats).*$/, (req, res, next) => {
    if (req.isAuthenticated()) {
      next();
    } else {
      req.flash(
        'errorFlash',
        'Error 401: Unauthorized. You need to login to see this page.',
      );
      res.redirect('/');
    }
  });

  app.get('/leaderboard', async (req, res) => {
    const leaderboard = await generateLeaderboard(mongo.User, 10);
    res.render(VIEWS + 'private/leaderboard.ejs', {
      rankings: leaderboard,
      pageName: 'Leaderboard',
    });
  });

  app.get('/profile', (req, res) => {
    res.redirect('/profile/' + req.user.ign);
  });

  app.get(
    '/profile/:username',
    wrap(async (req, res) => {
      const obj = await mongo.User.findOne({
        ign: String(req.params.username),
      }).exec();
      if (!obj) {
        req.flash(
          'errorFlash',
          "Error 404: File Not Found. That username doesn't exist.",
        );
        return res.redirect('/');
      }
      if (obj.preferences.hideProfile && req.user.ign != req.params.username) {
        req.flash('errorFlash', 'This user has made their profile private.');
        return res.redirect('/homepage');
      }
      let thisAge = 0;
      if (req.user.profile.yob && obj.profile.yob != 2020) {
        thisAge = new Date().getFullYear() - obj.profile.yob;
      }
      res.render(VIEWS + 'private/profile.ejs', {
        age: thisAge,
        user: publicUser(obj),
        totalTags: tags,
        pageName: obj.ign + "'s Profile",
        experienceStats: calculateLevel(
          obj.stats.experience ? obj.stats.experience : 0,
        ),
        allAchievements: achievementDescriptions,
      });
    }),
  );

  app.get('/stats', (req, res) => {
    res.redirect('/stats/' + req.user.ign);
  });

  app.get('/statsAdditional', async (req, res) => {
    try {
      const {
        physicsRating,
        chemistryRating,
        biologyRating,
        experience,
        rushHighscore,
      } = req.query;

      const globalPhysicsRank =
        (await mongo.User.countDocuments({
          'rating.physics': { $gt: physicsRating },
        })) + 1;
      const globalChemistryRank =
        (await mongo.User.countDocuments({
          'rating.chemistry': { $gt: chemistryRating },
        })) + 1;
      const globalBiologyRank =
        (await mongo.User.countDocuments({
          'rating.biology': { $gt: biologyRating },
        })) + 1;
      const globalExperienceRank =
        (await mongo.User.countDocuments({
          'stats.experience': { $gt: experience },
        })) + 1;
      const globalRushRank =
        (await mongo.User.countDocuments({
          'stats.rush.highscore': { $gt: rushHighscore },
        })) + 1;

      res.json({
        status: 'Success',
        globalRank: {
          physics: globalPhysicsRank,
          chemistry: globalChemistryRank,
          biology: globalBiologyRank,
          experience: globalExperienceRank,
          rush: globalRushRank,
        },
      });
    } catch (err) {
      res.json({
        status: 'Error',
      });
    }
  });

  app.get(
    '/stats/:username',
    wrap(async (req, res) => {
      const obj = await mongo.User.findOne({
        ign: String(req.params.username),
      }).exec();
      if (!obj) {
        req.flash(
          'errorFlash',
          "Error 404: File Not Found. That username doesn't exist.",
        );
        return res.redirect('/');
      }
      if (obj.preferences.hideProfile && req.user.ign != req.params.username) {
        // private stats are visible only to a teacher of one of the user's classes
        const teacher = await mongo.User.findOne({
          $and: [
            { teachingClasses: { $in: obj.classes } },
            { ign: req.user.ign },
          ],
        }).exec();
        if (!teacher) {
          req.flash('errorFlash', 'This user has made their stats private.');
          return res.redirect('/homepage');
        }
      }
      res.render(VIEWS + 'private/stats.ejs', {
        user: publicUser(obj),
        totalTags: tags,
        userLevel: calculateLevel(
          obj.stats.experience ? obj.stats.experience : 0,
        ),
        analytics: analyze(obj.stats.units ? obj.stats.units : {}),
        pageName: obj.ign + "'s Stats",
      });
    }),
  );
};
