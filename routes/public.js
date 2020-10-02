// MODULE IMPORTS
const passport = require('passport');

// FUNCTION IMPORTS
const emailValidation = require('../utils/functions/emailValidation');
const { genPassword, validPassword } = require('../utils/functions/password');

const VIEWS = "../views/"

module.exports = (app, mongo) => {
    // PUBLIC GET

    // `username` is email
    // `ign` is username
    app.get('/', (req, res) => {
        if (!req.isAuthenticated()) {
            //var userCount = 0;
            //var questionCount = 0;
            mongo.User.estimatedDocumentCount({}, function(err, result) {
                var userCount = result;
                mongo.Ques.estimatedDocumentCount({}, function(err, result) {
                    var questionCount = result;
                    res.render(VIEWS + 'public/index.ejs', { userCount: userCount, questionCount: questionCount });
                });
            });
        }
        else {
            res.redirect('/homepage');
        }
    });

    app.get('/signin', (req, res) => {
        if (!req.isAuthenticated()) {
            res.render(VIEWS + 'public/signin.ejs');
        }
        else {
            res.redirect('/homepage');
        }
    });

    app.get('/signup', (req, res) => {
        if (!req.isAuthenticated()) {
            res.render(VIEWS + 'public/signup.ejs');
        }
        else {
            res.redirect('/homepage');
        }
    });

    app.get('/latexCompiler', (req, res) => {
        res.render(VIEWS + 'public/latexcompiler.ejs');
    });

    app.get('/forgotPassword', (req, res) => {
        if (req.isAuthenticated()) {
            req.flash('errorFlash', 'You\'ll need to change your password here.');
            res.redirect('/settings');
        } else {
            res.render(VIEWS + 'public/forgotPassword.ejs');
        }
    });

    app.get('/whoWeAre', (req, res)  => {
        res.render(VIEWS + 'public/whoWeAre.ejs');
    });

    // PUBLIC POST

    app.post('/register', (req, res, next) => {
        req.body.username = req.body.username.toLowerCase();
        req.body.ign = req.body.ign.toLowerCase();
        var registerInputProblems1 = false;
        if (req.body.ign.length < 1) {
            req.flash('errorFlash', 'Please enter a username.');
            registerInputProblems1 = true;
        }
        if (req.body.password.length < 7 || !(/\d/.test(req.body.password)) || !(/[a-zA-Z]/.test(req.body.password))) {
            req.flash('errorFlash', 'The password you entered does not meet the requirements.');
            registerInputProblems1 = true;
        }
        if (!emailValidation.regexCheck(req.body.username)) {
            console.log(req.body.username);
            req.flash('errorFlash', 'The email you entered is not valid.');
            registerInputProblems1 = true;
        }

        if (registerInputProblems1) {
            res.redirect('/signup');
            return; // to prevent ERRHTTPHEADERSSENT
        }

        const saltHash = genPassword(req.body.password);

        const salt = saltHash.salt;
        const hash = saltHash.hash;
        const newUser = new mongo.User({
            username: req.body.username,
            ign: req.body.ign,
            hash: hash,
            salt: salt,
            profile: {
                name: '',
                location: 'Earth',
                age: '',
                bio: ''
            },
            // if emailConfirmCode == 0, then email is confirmed
            stats: {
                correct: 0,
                wrong: 0,
                collectedTags: []
            },
            rating: {
                physics: -1,
                chemistry: -1,
                biology: -1
            }
        });
        // check for duplicate user
        mongo.db.collection('users').findOne({ username: req.body.username }).then((user) => {
            if (user) {
                console.log('used');
                var registerInputProblems2 = false;
                if (user.ign == req.body.ign) {
                    req.flash('errorFlash', 'This username is already taken.');
                    registerInputProblems2 = true;
                } else { // has to be matching email
                    req.flash('errorFlash', 'This email is already in use.');
                    registerInputProblems2 = true;
                }
                if (registerInputProblems2) {
                    res.redirect('/signup');
                    return; // to prevent ERRHTTPHEADERSSENT
                }
            } else {
                console.log('new one');
                newUser.save()
                    .then((user) => {
                        //passport.authenticate('local', {failureRedirect: '/signin', successRedirect: '/train'});
                        console.log(user);
                    });
                req.flash('successFlash', 'We successfully signed you up!');
                var confirmCode;
                require('crypto').randomBytes(6, function (ex, buf) {
                    confirmCode = buf.toString('hex');
                    mongo.db.collection('users').findOneAndUpdate({ username: req.body.username }, { $set: { emailConfirmCode: confirmCode } });
                    emailValidation.emailCodeSend(req.body.username, confirmCode);
                    req.flash('errorFlash', 'You need to confirm your email. Please check your email for instructions.');
                });
            }
            res.redirect('/signin');
        });
    });
    app.post('/login', passport.authenticate('local', {
        failureRedirect: '/signin',
        successRedirect: '/homepage',
        failureFlash: 'Invalid username or password.',
        successFlash: 'Welcome!'
    }),
        (req, res, next) => {
            console.log('Oh hi');
            console.log('req.session');
        });

    app.post('/forgotPasswordCheck', (req, res, next) => {
        if (req.isAuthenticated()) {
            req.flash('errorFlash', 'You\'ll need to change your password here.');
            res.redirect('/settings')
        } else {
            if (!req.body.enteredCode) {
                mongo.User.countDocuments({ username: req.body.username }, function (err, count) {
                    if (count > 0) {
                        req.flash('successFlash', 'Check your email for the code.');
                        req.flash('forgotPassUser', req.body.username);
                        var confirmCode;
                        require('crypto').randomBytes(6, function (ex, buf) {
                            confirmCode = buf.toString('hex');
                            mongo.db.collection('users').findOneAndUpdate({ username: req.body.username }, { $set: { emailConfirmCode: confirmCode } });
                            debugger;
                            emailValidation.emailCodeSend(req.body.username, confirmCode);
                        });
                        res.redirect('/forgotPassword');
                        return;
                    } else {
                        req.flash('errorFlash', 'That email isn\'t registered with us.');
                        res.redirect('/signin');
                    }
                });
            } else {
                mongo.User.findOne({ username: req.body.username }).then((user) => {
                    if (user) {
                        if (user.emailConfirmCode != '0') {
                            if (emailValidation.checkCode(user.username, req.body.enteredCode)) {
                                if (req.body.newpw == req.body.confirmnewpw) {
                                    if((/\d/.test(req.body.newpw)) && (/[a-zA-Z]/.test(req.body.newpw))) {
                                        const newPass = genPassword(req.body.newpw);
                                        mongo.db.collection('users').findOneAndUpdate({ username: user.username }, { $set: { hash: newPass.hash, salt: newPass.salt } });
                                        emailValidation.clearConfirmCode(user.username);
                                        req.flash('successFlash', 'We successfully reset your password');
                                        res.redirect('/signin');
                                    } else {
                                        req.flash('errorFlash', 'The password doesn\'t fit the requirements.');
                                        req.flash('forgotPassUser', req.body.username);
                                        res.redirect('/forgotPassword');
                                    }
                                } else {
                                    req.flash('errorFlash', 'The passwords don\'t match. Please try again.');
                                    req.flash('forgotPassUser', req.body.username);
                                    res.redirect('/forgotPassword');
                                }
                            } else {
                                req.flash('errorFlash', 'The code is wrong. Please try again.');
                                req.flash('forgotPassUser', req.body.username);
                                res.redirect('/forgotPassword');
                            }
                        } else {
                            req.flash('errorFlash', 'Please try resetting your password again.');
                            res.redirect('/signin');
                        }
                    } else {
                        req.flash('errorFlash', 'The email is incorrect, please try again.');
                        req.flash('forgotPassUser', req.body.username);
                        res.redirect('/forgotPassword');
                    }
                });
            }
        }
    });
}
