const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const {
  verifyPassword,
  hashPassword,
  needsRehash,
  MAX_PASSWORD_LENGTH,
} = require('./password.js');

// verified against when no account matches, so response time does not reveal
// whether an identifier exists
const DUMMY_SALT = '00000000000000000000000000000000';
const DUMMY_HASH = `scrypt$15$8$3$${'00'.repeat(64)}`;

// returns the matching user document, or false on any failure
async function authenticateUser(User, identifier, password) {
  if (
    typeof identifier !== 'string' ||
    typeof password !== 'string' ||
    identifier.length === 0 ||
    identifier.length > 254 ||
    password.length > MAX_PASSWORD_LENGTH * 4
  ) {
    return false;
  }
  const lookup = identifier.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ ign: lookup }, { username: lookup }],
  });
  if (!user) {
    await verifyPassword(password, DUMMY_HASH, DUMMY_SALT);
    return false;
  }
  if (!(await verifyPassword(password, user.hash, user.salt))) {
    return false;
  }
  // transparently upgrade legacy PBKDF2 hashes to scrypt on successful login
  if (needsRehash(user.hash)) {
    const upgraded = await hashPassword(password);
    await User.updateOne(
      { _id: user._id },
      { $set: { hash: upgraded.hash, salt: upgraded.salt } },
    );
  }
  return user;
}

module.exports = (app, mongo) => {
  passport.use(
    new LocalStrategy((username, password, cb) => {
      authenticateUser(mongo.User, username, password)
        .then((user) => cb(null, user))
        .catch((err) => cb(err));
    }),
  );
  passport.serializeUser((user, cb) => cb(null, user.id));
  passport.deserializeUser((id, cb) => {
    mongo.User.findById(id)
      .then((user) => cb(null, user || false))
      .catch((err) => cb(err));
  });

  app.use(passport.initialize());
  app.use(passport.session());
};

module.exports.authenticateUser = authenticateUser;
