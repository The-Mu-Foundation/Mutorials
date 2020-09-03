const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bodyParser = require('body-parser');
const mongo = require('./mongo.js');
const { genPassword, validPassword } = require('./password.js');

module.exports = (app, mongo) => {
    passport.use(new LocalStrategy(
        // called when passport.authenticate is used()
        function (username, password, cb) {
            username = username.toLowerCase();
            mongo.User.find({ username: username })
                .then((user) => {
                    if (!user[0]) { return cb(null, false); }

                    const isValid = validPassword(password, user[0].hash, user[0].salt);

                    if (isValid) {
                        return cb(null, user[0]);
                    } else {

                        return cb(null, false);
                    }

                })
                .catch((err) => {
                    cb(err);
                });
        }
    ));
    passport.serializeUser(function (user, cb) {
        cb(null, user.id);
    });
    passport.deserializeUser(function (id, cb) {
        mongo.User.findById(id, function (err, user) {
            if (err) { return cb(err); }
            cb(null, user);
        });
    });

    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(passport.initialize());
    app.use(passport.session());
}
