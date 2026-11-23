// MODULE IMPORTS
const passport = require('passport');
const Filter = require('bad-words');

const expressLayouts = require('express-ejs-layouts');

const filter = new Filter();

// FUNCTION IMPORTS
const emailValidation = require('../utils/functions/emailValidation');
const {
  hashPassword,
  passwordPolicyError,
} = require('../utils/functions/password');
const { asString, safeLocalPath, wrap } = require('../utils/functions/http');
const {
  authLimiter,
  passwordResetLimiter,
  contactLimiter,
} = require('../utils/middleware/security');
const crypto = require('crypto');
const {
  getSiteData,
  getDailyQuestion,
} = require('../utils/functions/database');
const { calculateLevel } = require('../utils/functions/siteAlgorithms');
const { sendDiscordWebhook } = require('../utils/functions/webhook.js');
const { User, Ques, SiteData } = require('../utils/functions/mongo');

const VIEWS = '../views/';

module.exports = (app, mongo) => {
  // PUBLIC GET
  app.get('/', expressLayouts, async (req, res) => {
    // Site data
    let userCount, questionCount, tagCount, usaboQuestionCount, totalSolves;
    const siteDataQuery = getSiteData(User, Ques, SiteData).then((data) => {
      ({ userCount, questionCount, tagCount, usaboQuestionCount, totalSolves } =
        data);
    });

    // Daily question
    let question;
    const dailyQuestionQuery = getDailyQuestion(mongo.Daily, mongo.Ques).then(
      (data) => {
        question = data;
      },
    );

    // Leaderboard
    let leaderboard;
    const leaderboardQuery = mongo.User.find({
      'stats.experience': { $gte: 10000 },
    })
      .sort({ 'stats.experience': -1 })
      .limit(10)
      .exec()
      .then((data) => {
        leaderboard = data.map((user) => {
          return {
            level: calculateLevel(user.stats.experience),
            experience: user.stats.experience,
            ign: user.ign,
          };
        });
      });

    // Wait for all queries to finish
    await Promise.all([siteDataQuery, dailyQuestionQuery, leaderboardQuery]);

    res.render(VIEWS + 'public/indexV2.ejs', {
      user: req.user,
      layout: 'layouts/base.ejs',
      userCount,
      questionCount: questionCount + usaboQuestionCount,
      tagCount,
      totalSolves: Array.from(Object.values(totalSolves)).reduce(
        (a, b) => a + (b || 0), // Catch if b is NaN
        0,
      ),
      question,
      leaderboard,
    });
  });

  app.get('/index2', async (req, res) => {
    if (!req.isAuthenticated()) {
      const siteData = await getSiteData(
        mongo.User,
        mongo.Ques,
        mongo.SiteData,
      );
      const question = await getDailyQuestion(mongo.Daily, mongo.Ques);

      let experience = await mongo.User.find({
        'stats.experience': { $gte: 10000 },
      })
        .sort({ 'stats.experience': -1 })
        .limit(10)
        .exec();

      experience = experience.map((user) => {
        return {
          level: calculateLevel(user.stats.experience),
          experience: user.stats.experience,
          ign: user.ign,
        };
      });

      res.render(VIEWS + 'public/index.ejs', {
        siteStats: siteData,
        question,
        experience,
      });
    } else {
      res.redirect('/homepage');
    }
  });

  app.get('/signin', expressLayouts, (req, res) => {
    if (!req.isAuthenticated()) {
      res.render(VIEWS + 'public/signinV2.ejs', {
        pageName: 'Sign in',
        layout: 'layouts/base.ejs',
      });
    } else {
      res.redirect('/homepage');
    }
  });

  app.get('/signup', expressLayouts, (req, res) => {
    if (!req.isAuthenticated()) {
      res.render(VIEWS + 'public/signupV2.ejs', {
        pageName: 'Sign up',
        layout: 'layouts/base.ejs',
      });
    } else {
      res.redirect('/homepage');
    }
  });

  app.get('/latexCompiler', (req, res) => {
    res.render(VIEWS + 'public/latexcompiler.ejs', {
      user: req.user,
      pageName: 'LaTeX Compiler',
    });
  });

  app.get('/whoWeAre', expressLayouts, (req, res) => {
    res.render(VIEWS + 'public/teamV2', {
      user: req.user,
      pageName: 'About Mutorials',
      layout: 'layouts/base.ejs',
    });
  });

  app.get('/termsOfService', (req, res) => {
    res.render(VIEWS + 'public/termsOfService.ejs', {
      user: req.user,
      pageName: 'Mutorials TOS',
    });
  });

  app.get('/robots.txt', (req, res) => {
    res.render(VIEWS + 'public/robots.ejs', { pageName: 'robots.txt' });
  });

  app.get('/zetamac', (req, res) => {
    res.render(VIEWS + 'public/zetamac.ejs', {
      isAuthenticated: req.isAuthenticated(),
    });
  });

  // PUBLIC POST
  app.post(
    '/register',
    authLimiter,
    wrap(async (req, res) => {
      const username = asString(req.body.username).trim().toLowerCase();
      const ign = asString(req.body.ign).trim().toLowerCase();
      const password = asString(req.body.password);
      const confirmPassword = asString(req.body.confirmPassword);
      const yob = asString(req.body.yob);
      const problems = [];

      if (ign.length > 30) problems.push('Your username is too long.');
      if (ign.length < 1) problems.push('Please enter a username.');
      if (ign && !/^[\w.~-]+$/.test(ign)) {
        problems.push(
          'Allowed username characters: letters, numbers, underscore, hyphen, period, and tilde.',
        );
      }
      if (ign && ign != filter.clean(ign))
        problems.push('Keep it appropriate.');
      const passwordProblem = passwordPolicyError(password);
      if (passwordProblem) problems.push(passwordProblem);
      if (password != confirmPassword) {
        problems.push('The passwords did not match. Please try again.');
      }
      if (!emailValidation.regexCheck(username)) {
        problems.push('The email you entered is not valid.');
      }
      if (!req.body.agreeTOS) {
        problems.push(
          'You must agree to the Terms of Service and Privacy Policy to register an account with us.',
        );
      }
      if (
        !/^(19|20)\d{2}$/.test(yob) ||
        Number(yob) < 1900 ||
        Number(yob) > new Date().getFullYear()
      ) {
        problems.push('Please enter a valid year of birth!');
      }
      if (problems.length > 0) {
        problems.forEach((message) => req.flash('errorFlash', message));
        return res.redirect('/signup');
      }

      const existing = await mongo.User.findOne({
        $or: [{ ign }, { username }],
      }).lean();
      if (existing) {
        req.flash(
          'errorFlash',
          existing.ign == ign
            ? 'This username is already taken.'
            : 'This email is already in use.',
        );
        return res.redirect('/signup');
      }

      const { salt, hash } = await hashPassword(password);
      const thisYob = Number(yob);
      try {
        await new mongo.User({
          username,
          ign,
          hash,
          salt,
          profile: { name: ign, location: 'Earth', yob: thisYob, bio: '' },
          stats: { experience: 0, correct: 0, wrong: 0, collectedTags: [] },
          rating: {
            physics: -1,
            chemistry: -1,
            biology: -1,
            usabo: -1,
            ess: -1,
          },
          preferences: {
            hideProfile: new Date().getFullYear() - thisYob < 13,
            dark_mode: true,
          },
          achievements: { join_mutorials: true },
          emailVerified: false,
        }).save();
      } catch (err) {
        if (err && err.code === 11000) {
          // lost a race against a concurrent registration
          req.flash('errorFlash', 'This username or email is already in use.');
          return res.redirect('/signup');
        }
        throw err;
      }
      req.flash('successFlash', 'We successfully signed you up!');
      res.redirect('/signin');
    }),
  );

  app.post(
    '/login',
    authLimiter,
    passport.authenticate('local', {
      failureRedirect: '/signin',
      successRedirect: '/homepage',
      failureFlash: {
        type: 'errorFlash',
        message: 'Invalid username or password.',
      },
      successFlash: 'Welcome!',
    }),
  );

  const RESET_CODE_TTL_MS = 15 * 60 * 1000;
  const RESET_MAX_ATTEMPTS = 5;
  const hashResetCode = (code) =>
    crypto.createHash('sha256').update(code).digest('hex');
  // 10 characters from an unambiguous alphabet (~50 bits of entropy)
  const generateResetCode = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 10; i++) {
      code += alphabet[crypto.randomInt(alphabet.length)];
    }
    return code;
  };

  app.post(
    '/forgotPassword',
    passwordResetLimiter,
    wrap(async (req, res) => {
      const renderReset = (email) => {
        res.locals.forgotPassUser = email;
        res.render(VIEWS + 'public/forgotPassword.ejs', {
          pageName: 'Forgot Password',
        });
      };

      // step 1: request a code. The response never reveals whether the email exists.
      if (req.body.forgotEmail !== undefined) {
        const email = asString(req.body.forgotEmail).trim().toLowerCase();
        if (!emailValidation.regexCheck(email)) {
          req.flash('errorFlash', 'The email you entered is not valid.');
          return res.redirect('/signin');
        }
        const user = await mongo.User.findOne({ username: email });
        if (user) {
          const code = generateResetCode();
          await mongo.User.updateOne(
            { _id: user._id },
            {
              $set: {
                passwordReset: {
                  codeHash: hashResetCode(code),
                  expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
                  attempts: 0,
                },
              },
            },
          );
          await emailValidation.emailCodeSend(email, code);
        }
        req.flash(
          'successFlash',
          "If that email is registered, we've sent it a confirmation code.",
        );
        return renderReset(email);
      }

      // step 2: submit the code with a new password
      if (req.body.newpw !== undefined) {
        const email = asString(req.body.username).trim().toLowerCase();
        const enteredCode = asString(req.body.enteredCode).trim().toUpperCase();
        const newpw = asString(req.body.newpw);
        const genericFailure = () => {
          req.flash('errorFlash', "That isn't the right code.");
          return renderReset(email);
        };

        const user = email
          ? await mongo.User.findOne({ username: email })
          : null;
        const reset = user && user.passwordReset;
        if (
          !reset ||
          !reset.codeHash ||
          !reset.expiresAt ||
          reset.expiresAt < new Date() ||
          reset.attempts >= RESET_MAX_ATTEMPTS
        ) {
          return genericFailure();
        }

        const codeMatches =
          enteredCode.length > 0 &&
          crypto.timingSafeEqual(
            Buffer.from(hashResetCode(enteredCode)),
            Buffer.from(reset.codeHash),
          );
        if (!codeMatches) {
          await mongo.User.updateOne(
            { _id: user._id },
            { $inc: { 'passwordReset.attempts': 1 } },
          );
          return genericFailure();
        }

        const passwordProblem = passwordPolicyError(newpw);
        if (passwordProblem) {
          req.flash('errorFlash', passwordProblem);
          return renderReset(email);
        }
        if (newpw != asString(req.body.confirmnewpw)) {
          req.flash('errorFlash', "The passwords don't match.");
          return renderReset(email);
        }

        const { salt, hash } = await hashPassword(newpw);
        await mongo.User.updateOne(
          { _id: user._id },
          {
            $set: { salt, hash, emailVerified: true },
            $unset: { passwordReset: '' },
          },
        );
        req.flash('successFlash', 'Your password has been changed.');
        return res.redirect('/signin');
      }

      req.flash('errorFlash', 'Error 404: Page not found.');
      res.redirect('/');
    }),
  );

  app.post(
    '/contact',
    contactLimiter,
    wrap(async (req, res) => {
      const comment = asString(req.body.comment).trim();
      if (!comment) {
        req.flash('errorFlash', 'Please write a message before sending.');
        return res.redirect(safeLocalPath(req.body.redirect));
      }
      const questionId = asString(req.body.questionId);
      if (req.isAuthenticated()) {
        await sendDiscordWebhook(
          comment,
          req.user.username,
          req.user.ign,
          questionId,
        );
      } else {
        await sendDiscordWebhook(
          comment,
          'N/A',
          'User not signed in.',
          questionId,
        );
      }
      req.flash('successFlash', 'Thanks for your feedback!');
      res.redirect(safeLocalPath(req.body.redirect));
    }),
  );
};
