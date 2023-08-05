// MODULE IMPORTS
const passport = require('passport');
const Filter = require('bad-words');

const expressLayouts = require('express-ejs-layouts');

const filter = new Filter();

// FUNCTION IMPORTS
const emailValidation = require('../utils/functions/emailValidation');
const { genPassword } = require('../utils/functions/password');
const {
  getSiteData,
  getDailyQuestion,
} = require('../utils/functions/database');
const { calculateLevel } = require('../utils/functions/siteAlgorithms');
const { sendDiscordWebhook } = require('../utils/functions/webhook.js');

const VIEWS = '../views/';

module.exports = (app, mongo) => {
  // PUBLIC GET
  // `username` is email
  // `ign` is username
  app.get('/', expressLayouts, (req, res) => {
    res.render(VIEWS + 'public/indexV2.ejs', { layout: 'layouts/base.ejs' });
  });

  app.get('/signin', expressLayouts, (req, res) => {
    if (!req.isAuthenticated()) {
      res.render(VIEWS + 'public/signinV2.ejs', {
        pageName: 'Sign-in to Mutorials',
        layout: 'layouts/base.ejs',
      });
    } else {
      res.redirect('/homepage');
    }
  });

  app.get('/signup', expressLayouts, (req, res) => {
    if (!req.isAuthenticated()) {
      res.render(VIEWS + 'public/signupV2.ejs', {
        pageName: 'Sign-up to Mutorials',
        layout: 'layouts/base.ejs',
      });
    } else {
      res.redirect('/homepage');
    }
  });

  app.get('/latexCompiler', (req, res) => {
    res.render(VIEWS + 'public/latexcompiler.ejs', {
      pageName: 'LaTeX Compiler',
    });
  });

  app.get('/whoWeAre', (req, res) => {
    if (req.isAuthenticated()) {
      res.render(VIEWS + 'public/whoWeAre.ejs', {
        pageName: 'About Mutorials',
        authenticated: true,
      });
    } else {
      res.render(VIEWS + 'public/whoWeAre.ejs', {
        pageName: 'About Mutorials',
        authenticated: false,
      });
    }
  });

  app.get('/termsOfService', (req, res) => {
    res.render(VIEWS + 'public/termsOfService.ejs', {
      pageName: 'Mutorials TOS',
    });
  });

  app.get('/robots.txt', (req, res) => {
    res.render(VIEWS + 'public/robots.ejs', { pageName: 'robots.txt' });
  });

  // PUBLIC POST
  app.post('/register', (req, res, next) => {
    req.body.username = req.body.username.toLowerCase();
    req.body.ign = req.body.ign.toLowerCase();
    let registerInputProblems1 = false;

    if (req.body.ign.length > 30) {
      req.flash('errorFlash', 'Your username is too long.');
      registerInputProblems1 = true;
    }
    if (req.body.ign.length < 1) {
      req.flash('errorFlash', 'Please enter a username.');
      registerInputProblems1 = true;
    }

    if (!/^[\w\-\.\~]+$/.test(req.body.ign)) {
      req.flash(
        'errorFlash',
        'Allowed username characters: letters, numbers, underscore, hyphen, period, and tilde.'
      );
      registerInputProblems1 = true;
    }
    if (req.body.ign && req.body.ign != filter.clean(req.body.ign)) {
      req.flash('errorFlash', 'Keep it appropriate.');
      registerInputProblems1 = true;
    }
    if (
      req.body.password &&
      (req.body.password.length < 7 ||
        !/\d/.test(req.body.password) ||
        !/[a-zA-Z]/.test(req.body.password))
    ) {
      req.flash(
        'errorFlash',
        'The password you entered does not meet the requirements.'
      );
      registerInputProblems1 = true;
    }
    if (req.body.password != req.body.confirmPassword) {
      req.flash('errorFlash', 'The passwords did not match. Please try again.');
      registerInputProblems1 = true;
    }
    if (!emailValidation.regexCheck(req.body.username)) {
      console.log(req.body.username);
      req.flash('errorFlash', 'The email you entered is not valid.');
      registerInputProblems1 = true;
    }
    if (!req.body.agreeTOS) {
      req.flash(
        'errorFlash',
        'You must agree to the Terms of Service and Privacy Policy to register an account with us.'
      );
      registerInputProblems1 = true;
    }
    if (!req.body.agreeAge) {
      req.flash(
        'errorFlash',
        'You must be at least 13 years old, or have permission from your parent, guardian, teacher, or school to use Mutorials.'
      );
      registerInputProblems1 = true;
    }

    if (
      !/^(19|20)\d{2}$/.test(req.body.yob) ||
      req.body.yob.length != 4 ||
      req.body.yob > new Date().getFullYear()
    ) {
      req.flash('errorFlash', 'Please enter a valid year of birth!');
      registerInputProblems1 = true;
    }
    if (registerInputProblems1) {
      res.redirect('/signup');
      return; // to prevent ERRHTTPHEADERSSENT
    }

    const saltHash = genPassword(req.body.password);

    const salt = saltHash.salt;
    const hash = saltHash.hash;
    let thisYob = req.body.yob;
    if (!thisYob) {
      thisYob = new Date().getFullYear();
    }
    const newUser = new mongo.User({
      username: req.body.username,
      ign: req.body.ign,
      hash: hash,
      salt: salt,
      profile: {
        name: req.body.ign,
        location: 'Earth',
        yob: thisYob,
        bio: '',
      },
      // if emailConfirmCode == 0, then email is confirmed
      stats: {
        experience: 0,
        correct: 0,
        wrong: 0,
        collectedTags: [],
      },
      rating: {
        physics: -1,
        chemistry: -1,
        biology: -1,
        usabo: -1,
        ess: -1,
      },
      preferences: {
        hideProfile: new Date().getFullYear() - thisYob < 13 ? true : false,
      },
      achievements: {
        join_mutorials: true,
      },
    });

    // check for duplicate username AND email
    mongo.db
      .collection('users')
      .findOne({
        $or: [{ ign: req.body.ign }, { username: req.body.username }],
      })
      .then((user) => {
        if (user) {
          console.log('used');
          let registerInputProblems2 = false;
          if (user.ign == req.body.ign) {
            req.flash('errorFlash', 'This username is already taken.');
            registerInputProblems2 = true;
          } else {
            // has to be matching email
            req.flash('errorFlash', 'This email is already in use.');
            registerInputProblems2 = true;
          }
          if (registerInputProblems2) {
            res.redirect('/signup');
            return; // to prevent ERRHTTPHEADERSSENT
          }
        } else {
          console.log('new one');
          newUser.save().then((user) => {
            //passport.authenticate('local', {failureRedirect: '/signin', successRedirect: '/train'});
            console.log(user);
          });
          req.flash('successFlash', 'We successfully signed you up!');
          // var confirmCode;
          // require('crypto').randomBytes(6, function (ex, buf) {
          //     confirmCode = buf.toString('hex');
          //     mongo.db.collection('users').findOneAndUpdate({ username: req.body.username }, { $set: { emailConfirmCode: confirmCode } });
          //     emailValidation.emailCodeSend(req.body.username, confirmCode);
          //     req.flash('errorFlash', 'You need to confirm your email. Please check your email for instructions.');
          // });
        }
        res.redirect('/signin');
      });
  });

  app.post(
    '/login',
    passport.authenticate('local', {
      failureRedirect: '/signin',
      successRedirect: '/homepage',
      failureFlash: 'Invalid username or password.',
      successFlash: 'Welcome!',
    }),
    (req, res, next) => {
      console.log('Oh hi');
      console.log('req.session');
    }
  );

  app.post('/forgotPassword', (req, res) => {
    console.log(req.body.forgotEmail);
    if (req.body.forgotEmail) {
      mongo.db
        .collection('users')
        .findOne({ username: req.body.forgotEmail })
        .then((user) => {
          if (user) {
            require('crypto').randomBytes(6, function (ex, buf) {
              mongo.db
                .collection('users')
                .findOneAndUpdate(
                  { username: req.body.forgotEmail },
                  { $set: { email_confirm_code: buf.toString('hex') } }
                )
                .then((success) => {
                  emailValidation.emailCodeSend(
                    req.body.forgotEmail,
                    buf.toString('hex')
                  );
                  req.flash(
                    'successFlash',
                    "You've been emailed a confirmation code."
                  );
                  res.locals.forgotPassUser = req.body.forgotEmail;
                  res.render(VIEWS + 'public/forgotPassword.ejs', {
                    pageName: 'Forgot Password',
                  });
                });
            });
          } else {
            req.flash('errorFlash', "That email isn't registered with us.");
            res.redirect('/signin');
          }
        });
    } else if (req.body.newpw) {
      mongo.db
        .collection('users')
        .findOne({
          username: req.body.username,
          email_confirm_code: req.body.enteredCode,
        })
        .then((user) => {
          if (user) {
            if (
              req.body.newpw.length < 7 ||
              !/\d/.test(req.body.newpw) ||
              !/[a-zA-Z]/.test(req.body.newpw)
            ) {
              req.flash(
                'errorFlash',
                'The password you entered does not meet the requirements.'
              );
              res.locals.forgotPassUser = req.body.username;
              res.render(VIEWS + 'public/forgotPassword.ejs', {
                pageName: 'Forgot Password',
              });
            } else if (req.body.newpw != req.body.confirmnewpw) {
              req.flash('errorFlash', "The passwords don't match.");
              res.locals.forgotPassUser = req.body.username;
              res.render(VIEWS + 'public/forgotPassword.ejs', {
                pageName: 'Forgot Password',
              });
            } else {
              const saltHash = genPassword(req.body.newpw);
              const salt = saltHash.salt;
              const hash = saltHash.hash;
              mongo.db
                .collection('users')
                .findOneAndUpdate(
                  { username: req.body.username },
                  { $set: { email_confirm_code: '', salt: salt, hash: hash } }
                )
                .then((success) => {
                  req.flash('successFlash', 'Your password has been changed.');
                  res.redirect('/signin');
                });
            }
          } else {
            req.flash('errorFlash', "That isn't the right code.");
            res.locals.forgotPassUser = req.body.username;
            res.render(VIEWS + 'public/forgotPassword.ejs', {
              pageName: 'Forgot Password',
            });
          }
        });
    } else {
      res.flash('errorFlash', 'Error 404: Page not found.');
      res.redirect('/');
    }
  });

  app.post('/contact', (req, res) => {
    req.isAuthenticated()
      ? sendDiscordWebhook(
          req.body.comment,
          req.user.username,
          req.user.ign,
          req.body.questionId
        )
      : sendDiscordWebhook(
          req.body.comment,
          'N/A',
          'User not signed in.',
          req.body.questionId
        );
    req.flash('successFlash', 'Thanks for your feedback!');
    if (req.body.redirect) {
      res.redirect(req.body.redirect);
    } else {
      res.redirect('/');
    }
  });
};
