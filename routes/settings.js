// FUNCTION IMPORTS
const { genPassword, validPassword } = require('../utils/functions/password');
const emailValidation = require('../utils/functions/emailValidation');

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
          'Error 401: Unauthorized. You need to login to see this page.'
        );
        res.redirect('/');
      }
    }
  );

  // change profile settings
  app.post('/changeProfile', (req, res) => {
    const date = new Date().getFullYear();
    const age = date - req.body.yob;
    if (!/^\d+$/.test(age)) {
      req.flash('errorFlash', 'Please enter a valid year of birth!');
    }

    if (age < 0 || age > 150) {
      req.flash(
        'errorFlash',
        "You've got to be at least 0 and younger than 150 to use Mutorials ;)"
      );
    } else {
      req.user.profile.yob = req.body.yob; //entered age is adjusted in settings.ejs
    }

    if (age > 13) {
      if (req.body.name) {
        if (req.body.name == filter.clean(req.body.name)) {
          if (req.body.name.length <= 50) {
            req.user.profile.name = req.body.name;
          } else {
            req.flash(
              'errorFlash',
              'Please keep your name under 50 characters long.'
            );
          }
        } else {
          req.flash('errorFlash', 'Keep it appropriate.');
        }
      }
      if (req.body.bio || req.body.bio == '') {
        if (!req.body.bio == '') {
          if (req.body.bio == filter.clean(req.body.bio)) {
            if (req.body.bio.length <= 150) {
              req.user.profile.bio = req.body.bio;
            } else {
              req.flash(
                'errorFlash',
                'Please keep your bio under 150 characters long.'
              );
            }
          } else {
            req.flash('errorFlash', 'Keep it appropriate.');
          }
        } else {
          req.user.profile.bio = req.body.bio;
        }
      }
      if (req.body.location) {
        if (req.body.location == filter.clean(req.body.location)) {
          if (req.body.location.length <= 50) {
            req.user.profile.location = req.body.location;
          } else {
            req.flash(
              'errorFlash',
              'Please keep your location under 50 characters long.'
            );
          }
        } else {
          req.flash('errorFlash', 'Keep it appropriate.');
        }
      }
    } else {
      req.user.profile.name = '';
      req.user.profile.bio = '';
      req.user.profile.location = 'Earth';
    }
    if (
      age < 13 &&
      (req.user.profile.name != req.body.name ||
        req.user.profile.bio != req.body.bio ||
        req.user.profile.location != req.body.location)
    ) {
      req.flash(
        'errorFlash',
        'You have to be over 13 to give us your name or location or to have a bio.'
      );
    }
    mongo.db.collection('users').findOneAndUpdate(
      { _id: req.user._id },
      {
        $set: {
          profile: {
            yob: req.user.profile.yob,
            location: req.user.profile.location,
            name: req.user.profile.name,
            bio: req.user.profile.bio,
          },
        },
      },
      { upsert: true }
    );
    console.log(req.user);

    res.redirect('/settings');
    console.log('Profile has been updated');
  });

  // change user preferences
  app.post('/changePreferences', (req, res) => {
    req.user.preferences.dark_mode = !!req.body.darkMode;
    req.user.preferences.hideProfile = !!req.body.hideProfile;

    mongo.db.collection('users').findOneAndUpdate(
      { _id: req.user._id },
      {
        $set: {
          preferences: {
            dark_mode: req.user.preferences.dark_mode,
            hideProfile: req.user.preferences.hideProfile,
          },
        },
      },
      { upsert: true }
    );

    console.log('Updated preferences');

    res.redirect('/settings');
  });

  // change account settings
  app.post('/changeSettings', (req, res) => {
    if (req.body.ign && req.body.ign != req.user.ign) {
      if (!/^[\w\-\.\~]+$/.test(req.body.ign)) {
        req.flash(
          'errorFlash',
          'Allowed username characters: letters, numbers, underscore, hyphen, period, and tilde.'
        );
      } else if (req.body.ign.length > 30) {
        req.flash(
          'errorFlash',
          'Please keep your username under 30 characters long.'
        );
      } else {
        mongo.User.countDocuments({ ign: req.body.ign }, function (err, count) {
          if (count > 0) {
            console.log('username exists');
            req.flash('errorFlash', 'Sorry, this username already exists.');
          } else {
            console.log('username does not exist');
            mongo.db
              .collection('users')
              .findOneAndUpdate(
                { _id: req.user._id },
                { $set: { ign: req.body.ign } }
              );
            req.flash('successFlash', 'We successfully changed your username.');
          }
        });
      }
    } else {
      console.log('Empty username or no change');
    }

    if (req.body.username && req.body.username != req.user.username) {
      if (!emailValidation.regexCheck(req.body.username)) {
        req.flash('errorFlash', 'The email you entered is not valid.');
      } else {
        mongo.User.countDocuments(
          { username: req.body.username },
          function (err, count) {
            if (count > 0) {
              console.log('email exists');
              req.flash(
                'errorFlash',
                'We already have an account with that email. Try signing in with that one.'
              );
            } else {
              console.log('email does not exist');
              let confirmCode;
              require('crypto').randomBytes(6, function (ex, buf) {
                confirmCode = buf.toString('hex');
                mongo.db
                  .collection('users')
                  .findOneAndUpdate(
                    { username: req.body.username },
                    { $set: { emailConfirmCode: confirmCode } }
                  );
              });
              req.flash(
                'successFlash',
                'You need to confirm your email. Please check your email to confirm it.'
              );
              mongo.db
                .collection('users')
                .findOneAndUpdate(
                  { _id: req.user._id },
                  { $set: { username: req.body.username } }
                );
              console.log('email updated');
            }
          }
        );
      }
    } else {
      console.log('Empty email or no change');
    }

    if (req.body.newpw) {
      if (req.body.plassword) {
        const isValid = validPassword(
          req.body.plassword,
          req.user.hash,
          req.user.salt
        );
        if (
          /\d/.test(req.body.newpw) &&
          /[a-zA-Z]/.test(req.body.newpw) &&
          req.body.newpw.length >= 7
        ) {
          if (req.body.newpw == req.body.confirmnewpw) {
            if (isValid) {
              const newPass = genPassword(req.body.newpw);
              req.user.hash = newPass.hash;
              req.user.salt = newPass.salt;
              mongo.db
                .collection('users')
                .findOneAndUpdate(
                  { _id: req.user._id },
                  { $set: { hash: req.user.hash, salt: req.user.salt } }
                );
            } else {
              req.flash(
                'errorFlash',
                'Your current password must match what you type into the field below for any changes to these settings!'
              );
            }
          } else {
            req.flash('errorFlash', "Passwords don't match.");
          }
        } else {
          req.flash('errorFlash', 'Password does not meet requirements.');
        }
      } else {
        req.flash(
          'errorFlash',
          'To change your password you must enter your current password first!'
        );
      }
    }
    //mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: {  hash: req.user.hash, salt: req.user.salt, username: req.user.username, ign: req.user.ign} });

    res.redirect('/settings');
  });

  app.post('/deleteAccount', async (req, res) => {
    const isValid = validPassword(
      req.body.delassword,
      req.user.hash,
      req.user.salt
    );
    if (isValid) {
      mongo.db.collection('users').deleteOne({ _id: req.user._id });
      req.logout();
      console.log('Deleted Account');
      req.flash('successFlash', 'Goodbye.');
      res.redirect('/');
    } else {
      req.flash('errorFlash', 'Your current password does not match!');
      res.redirect('/settings');
    }
  });

  app.get('/settings', (req, res) => {
    res.render(VIEWS + 'private/settings.ejs', {
      user: req.user,
      pageName: 'Settings',
    });
  });
};
