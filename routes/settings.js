// MODULE IMPORTS
const Filter = require('bad-words');
const filter = new Filter();

// FUNCTION IMPORTS
const {
  hashPassword,
  verifyPassword,
  passwordPolicyError,
} = require('../utils/functions/password');
const emailValidation = require('../utils/functions/emailValidation');
const { asString, wrap } = require('../utils/functions/http');
const { authLimiter } = require('../utils/middleware/security');

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
  app.all(
    /^(\/changeProfile|\/changePreferences|\/changeSettings|\/deleteAccount|\/settings).*$/,
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

  // validates one free-text profile field; returns the cleaned value or null (and flashes)
  function profileText(req, value, label, maxLength) {
    const text = asString(value).trim();
    if (text !== filter.clean(text)) {
      req.flash('errorFlash', 'Keep it appropriate.');
      return null;
    }
    if (text.length > maxLength) {
      req.flash(
        'errorFlash',
        `Please keep your ${label} under ${maxLength} characters long.`,
      );
      return null;
    }
    return text;
  }

  // change profile settings
  app.post(
    '/changeProfile',
    wrap(async (req, res) => {
      const profile = {
        yob: req.user.profile.yob,
        location: req.user.profile.location,
        name: req.user.profile.name,
        bio: req.user.profile.bio,
      };
      const yob = asString(req.body.yob);
      const age = new Date().getFullYear() - Number(yob);

      if (!/^\d{4}$/.test(yob)) {
        req.flash('errorFlash', 'Please enter a valid year of birth!');
      } else if (age < 0 || age > 150) {
        req.flash(
          'errorFlash',
          "You've got to be at least 0 and younger than 150 to use Mutorials ;)",
        );
      } else {
        profile.yob = Number(yob);
      }

      const effectiveAge = new Date().getFullYear() - profile.yob;
      if (effectiveAge >= 13) {
        if (req.body.name) {
          const name = profileText(req, req.body.name, 'name', 50);
          if (name !== null) profile.name = name;
        }
        if (req.body.bio !== undefined) {
          const bio = profileText(req, req.body.bio, 'bio', 150);
          if (bio !== null) profile.bio = bio;
        }
        if (req.body.location) {
          const location = profileText(req, req.body.location, 'location', 50);
          if (location !== null) profile.location = location;
        }
      } else {
        // users under 13 cannot publish personal information
        if (req.body.name || req.body.bio || req.body.location) {
          req.flash(
            'errorFlash',
            'You have to be over 13 to give us your name or location or to have a bio.',
          );
        }
        profile.name = '';
        profile.bio = '';
        profile.location = 'Earth';
      }

      await mongo.User.updateOne({ _id: req.user._id }, { $set: { profile } });
      res.redirect('/settings');
    }),
  );

  // change user preferences
  app.post(
    '/changePreferences',
    wrap(async (req, res) => {
      await mongo.User.updateOne(
        { _id: req.user._id },
        {
          $set: {
            'preferences.dark_mode': !!req.body.darkMode,
            'preferences.hideProfile': !!req.body.hideProfile,
          },
        },
      );
      res.redirect('/settings');
    }),
  );

  // change account settings (username, email, password)
  app.post(
    '/changeSettings',
    authLimiter,
    wrap(async (req, res) => {
      const ign = asString(req.body.ign).trim().toLowerCase();
      if (ign && ign != req.user.ign) {
        if (!/^[\w\-\.\~]+$/.test(ign)) {
          req.flash(
            'errorFlash',
            'Allowed username characters: letters, numbers, underscore, hyphen, period, and tilde.',
          );
        } else if (ign.length > 30) {
          req.flash(
            'errorFlash',
            'Please keep your username under 30 characters long.',
          );
        } else if (ign != filter.clean(ign)) {
          req.flash('errorFlash', 'Keep it appropriate.');
        } else {
          try {
            const result = await mongo.User.updateOne(
              { _id: req.user._id },
              { $set: { ign } },
            );
            if (result.modifiedCount === 1) {
              req.flash(
                'successFlash',
                'We successfully changed your username.',
              );
            }
          } catch (err) {
            if (err && err.code === 11000) {
              req.flash('errorFlash', 'Sorry, this username already exists.');
            } else {
              throw err;
            }
          }
        }
      }

      // Changing the email or password requires the current password.
      const email = asString(req.body.username).trim().toLowerCase();
      const wantsEmail = email && email != req.user.username;
      const newpw = asString(req.body.newpw);
      if (wantsEmail || newpw) {
        const currentOk = await verifyPassword(
          asString(req.body.plassword),
          req.user.hash,
          req.user.salt,
        );
        if (!currentOk) {
          req.flash(
            'errorFlash',
            'Your current password must match what you type into the field below for any changes to these settings!',
          );
        } else {
          if (wantsEmail) {
            if (!emailValidation.regexCheck(email)) {
              req.flash('errorFlash', 'The email you entered is not valid.');
            } else {
              try {
                await mongo.User.updateOne(
                  { _id: req.user._id },
                  { $set: { username: email, emailVerified: false } },
                );
                req.flash(
                  'successFlash',
                  'We successfully changed your email.',
                );
              } catch (err) {
                if (err && err.code === 11000) {
                  req.flash(
                    'errorFlash',
                    'We already have an account with that email. Try signing in with that one.',
                  );
                } else {
                  throw err;
                }
              }
            }
          }
          if (newpw) {
            const problem = passwordPolicyError(newpw);
            if (problem) {
              req.flash('errorFlash', 'Password does not meet requirements.');
            } else if (newpw != asString(req.body.confirmnewpw)) {
              req.flash('errorFlash', "Passwords don't match.");
            } else {
              const { salt, hash } = await hashPassword(newpw);
              await mongo.User.updateOne(
                { _id: req.user._id },
                { $set: { salt, hash } },
              );
              req.flash('successFlash', 'Your password has been changed.');
            }
          }
        }
      }
      res.redirect('/settings');
    }),
  );

  app.post(
    '/deleteAccount',
    authLimiter,
    wrap(async (req, res, next) => {
      const valid = await verifyPassword(
        asString(req.body.delassword),
        req.user.hash,
        req.user.salt,
      );
      if (!valid) {
        req.flash('errorFlash', 'Your current password does not match!');
        return res.redirect('/settings');
      }
      const userId = req.user._id;
      await mongo.User.deleteOne({ _id: userId });
      await mongo.Attempt.deleteMany({ user: userId });
      req.logout((err) => {
        if (err) return next(err);
        // the session is regenerated on logout, so the flash goes on the new one
        req.flash('successFlash', 'Goodbye.');
        res.redirect('/');
      });
    }),
  );

  app.get('/settings', (req, res) => {
    res.render(VIEWS + 'private/settings.ejs', {
      user: req.user,
      pageName: 'Settings',
    });
  });
};
