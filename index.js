// MODULE IMPORTS

const bodyParser = require("body-parser");
const passport = require("passport");
const LocalStrategy = require('passport-local').Strategy;
const mongoose = require("mongoose");
const express = require("express");
var flash = require("express-flash-messages");
const session = require("express-session");
const InitiateMongoServer = require("./database/config/db");
const email_validation = require('./utils/functions/email_validation');

// SCHEMA, FUNCTION, AND CONSTANT IMPORTS

const { userSchema } = require("./database/models/user");
const { qSchema } = require("./database/models/question");
const { genPassword, validPassword } = require("./utils/functions/password");
const { calculateRatings, ratingCeilingFloor } = require("./utils/functions/ratings");
const { arraysEqual, parseDelimiter } = require("./utils/functions/general");
const { getQuestion, getQuestions, getRating, setRating, setQRating, updateCounters} = require("./utils/functions/database");
const { subjectUnitDictionary } = require("./utils/constants/subjects");
const { presetUnitOptions } = require("./utils/constants/presets");
const { referenceSheet } = require("./utils/constants/referencesheet");
const { tags } = require("./utils/constants/tags");



// START MONGO SERVER
InitiateMongoServer();
var db = mongoose.connection;
const PORT = process.env.PORT || 3000;
const app = express();

// MONGO SESSION

const MongoStore = require("connect-mongo")(session);

const Ques = db.model('Ques', qSchema, 'questions');
const User = db.model('User', userSchema);

// SESSION COLLECTION

const sessionStore = new MongoStore({ mongooseConnection: db, collection: 'sessions' });
app.use(session({
    secret: "blahblah",
    resave: false,
    saveUninitialized: true,
    store: sessionStore
}));

// PASSPORT CODE
passport.use(new LocalStrategy(
    // called when passport.authenticate is used()
    function (username, password, cb) {
        User.find({ username: username })
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
    }));
passport.serializeUser(function (user, cb) {
    cb(null, user.id);
});
passport.deserializeUser(function (id, cb) {
    User.findById(id, function (err, user) {
        if (err) { return cb(err); }
        cb(null, user);
    });
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash()); // express-flash-messages config

app.use(function (req, res, next) {
    res.locals.success_flash = req.flash('success_flash');
    res.locals.error_flash = req.flash('error_flash');
    next();
});
// POST ROUTES

app.post('/login', passport.authenticate('local', {
    failureRedirect: "/signin",
    successRedirect: '/homepage',
    failureFlash: 'Invalid username or password.',
    successFlash: 'Welcome!'
}),
    (req, res, next) => {
        console.log("Oh hi");
        console.log("req.session");
    });

// `username` is email
// `ign` is username
app.post('/register', (req, res, next) => {
    var register_input_problems_1 = false;
    if (req.body.ign.length < 1) {
        req.flash('error_flash', 'Please enter a username.');
        register_input_problems_1 = true;
    }
    if (req.body.password.length < 7 || !(/\d/.test(req.body.password)) || !(/[a-zA-Z]/.test(req.body.password))) {
        req.flash('error_flash', 'The password you entered does not meet the requirements.');
        register_input_problems_1 = true;
    }
    if (!email_validation.regex_check(req.body.username)) {
        console.log(req.body.username);
        req.flash('error_flash', 'The email you entered is not valid.');
        register_input_problems_1 = true;
    }

    if (register_input_problems_1) {
        res.redirect('/signup');
        return; // to prevent ERR_HTTP_HEADERS_SENT
    }

    const saltHash = genPassword(req.body.password);

    const salt = saltHash.salt;
    const hash = saltHash.hash;
    var confirm_code;
    require('crypto').randomBytes(6, function (ex, buf) {
        confirm_code = buf.toString('hex');
        debugger;
    });
    const newUser = new User({
        username: req.body.username,
        ign: req.body.ign,
        hash: hash,
        salt: salt,
        profile: {
            name: "",
            location: "Earth",
            age: "",
            bio: ""
        },
        // if email_confirm_code == 0, then email is confirmed
        email_confirm_code: confirm_code,
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
    db.collection('users').findOne({ username: req.body.username }).then((user) => {
        if (user) {
            console.log("used");
            var register_input_problems_2 = false;
            if (user.ign == req.body.ign) {
                req.flash('error_flash', 'This username is already taken.');
                register_input_problems_2 = true;
            } else { // has to be matching email
                req.flash('error_flash', 'This email is already in use.');
                register_input_problems_2 = true;
            }
            if (register_input_problems_2) {
                res.redirect('/signup');
                return; // to prevent ERR_HTTP_HEADERS_SENT
            }
        } else {
            console.log("new one");
            newUser.save()
                .then((user) => {
                    //passport.authenticate('local', {failureRedirect: "/signin", successRedirect: '/train'});
                    console.log(user);
                });
            req.flash('success_flash', 'We successfully signed you up!');
        }
        email_validation.email_code_send(req.body.username, confirm_code);
        res.redirect('/signin');
    });
});

app.post('/admin/addquestion', (req, res, next) => {
    //const questionStore =  new MongoStore({mongooseConnection: db, collection: 'questions'});

    if (req.isAuthenticated()) {
        if (req.body.question.length < 1
            || parseDelimiter(req.body.tags).length < 1
            || req.body.rating.length < 1
            || parseDelimiter(req.body.answer)[0].length < 1
            || req.body.answer_ex.length < 1
            || req.body.author.length < 1
            || req.body.type.length < 1
            || req.body.ext_source.length < 1
            || req.body.subject.length < 1
            || req.body.units.length < 1) {
            req.flash('error_flash', 'You\'re forgetting a field.');
            res.redirect('/admin/addedFailure');
            return;
        }

        // append unique unit tags to taglist
        req.body.subject.forEach((subject) => {
            Object.keys(tags[subject]["Units"]).forEach((unitTag) => {
                if (req.body.units.includes(subject + " - " + tags[subject]["Units"][unitTag])) {
                    if(req.body.tags.length >= 1) {
                        req.body.tags = unitTag + "@" + req.body.tags;
                    } else {
                        req.body.tags = unitTag;
                    }
                }
            });
        });

        const newQ = new Ques({
            question: req.body.question,
            choices: parseDelimiter(req.body.choices),
            tags: parseDelimiter(req.body.tags),
            rating: req.body.rating,
            answer: parseDelimiter(req.body.answer),
            answer_ex: req.body.answer_ex,
            author: req.body.author,
            type: req.body.type,
            ext_source: req.body.ext_source,
            subject: req.body.subject,
            units: req.body.units,
            stats: {
                pass: 0,
                fail: 0
            }
        })
        //collection.insertOne({})
        newQ.save();
    }
    else {
        res.redirect("/");
    }
});

app.post('/private/initialRating', (req, res, next) => {
    //initial ratings set proficiency

    //req.params.level, req.params.subject
    if (req.isAuthenticated()) {
        req.user.rating[req.body.subject.toLowerCase()] = req.body.level;
        db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { rating: req.user.rating } });
        res.redirect("/train/" + req.body.subject + "/choose_units");
    }
    else {
        res.redirect("/");
    }
});

app.post('/email_check', (req, res, next) => {
    if (req.isAuthenticated()) {
        const cc = new Promise((resolve, reject) => {
            resolve(email_validation.check_code(req.user.username, "0"));
        });
        cc.then((value) => {
            if (!value) {
                const cccc = new Promise((resolve, reject) => {
                    resolve(email_validation.check_code(req.user.username, req.body.entered_code));
                });
                cccc.then((value1) => {
                    if (value1) {
                        console.log('confirm_code did match');
                        email_validation.clear_confirm_code(req.user.username);
                        req.flash('success_flash', 'We successfully confirmed your email!');
                        res.redirect('/');
                    } else {
                        console.log('confirm_code didn\'t match');
                        req.flash('error_flash', 'That isn\'t the right code. Please try again.');
                        res.redirect('/email_confirmation');
                    }
                });
            } else {
                req.flash('error_flash', 'You\'ve already confirmed your email.');
                res.redirect('/');
            }
        });
    } else {
        res.redirect('/');
    }
});

app.post("/selQ", (req, res, next) => {
    //select question
    //var subj = null;
    var units = null;
    /*
    if (req.body.qNum == 0) {
        subj = req.body.subj;
        res.redirect("/train/" + req.body.subj + "/choose_units");
    }
    */
    if (req.body.qNum == 1) {
        units = req.body.unitChoice;
        if (units) { //nothing happens if units is empty
            res.redirect("/train/" + req.body.subj + "/display_question?units=" + units.toString());
        }
        if(!units){
            res.redirect("/train/" + req.body.subj + "/choose_units"); //maybe flash
        }
        //app.set("questionz", questions);
        //units cannot have commas

    }
});

app.post("/train/checkAnswer", (req, res, next) => {
    if (req.isAuthenticated()) {
        // the page keeps loading if the answer is left blank; this doesn't do any harm per se, but its a bug that needs to be fixed
        if (req.body.type == "mc" && req.body.answerChoice != undefined) {
            var isRight = false;
            const antsy = getQuestion(Ques, req.body.id).then(antsy => {
                // check answer
                if (antsy.answer[0] == req.body.answerChoice) {
                    isRight = true;
                }
                // modify ratings
                oldUserRating = req.user.rating[antsy.subject[0].toLowerCase()];
                oldQRating = antsy.rating;
                setRating(antsy.subject[0], calculateRatings(oldUserRating, oldQRating, isRight).newUserRating, req);
                setQRating(antsy, calculateRatings(oldUserRating, oldQRating, isRight).newQuestionRating);
                // update counters & tag collector
                updateCounters(req, antsy, isRight);
                // render answer page
                res.render(__dirname + '/views/private/' + 'train_answerExplanation.ejs', { units: req.body.units, userAnswer: req.body.answerChoice, userRating: getRating(req.body.subject, req), subject: req.body.subject, newQues: antsy, correct: isRight, oldUserRating: oldUserRating, oldQ: oldQRating, user: req.user });
            });
        }
        else if (req.body.type == "sa" && req.body.saChoice != undefined) {
            var isRight = false;
            const antsy = getQuestion(Ques, req.body.id).then(antsy => {
                // check answer
                isRight = arraysEqual(antsy.answer, req.body.saChoice);
                // modify ratings
                oldUserRating = req.user.rating[antsy.subject[0].toLowerCase()];
                oldQRating = antsy.rating;
                setRating(antsy.subject[0], calculateRatings(oldUserRating, oldQRating, isRight).newUserRating, req);
                setQRating(antsy, calculateRatings(oldUserRating, oldQRating, isRight).newQuestionRating);
                // update counters
                updateCounters(req, antsy, isRight);
                // render answer page
                res.render(__dirname + '/views/private/' + 'train_answerExplanation.ejs', { units: req.body.units, userAnswer: req.body.saChoice, userRating: getRating(req.body.subject, req), subject: req.body.subject, newQues: antsy, correct: isRight, oldUserRating: oldUserRating, oldQ: oldQRating, user: req.user });
            });
        }
        else if (req.body.type == "fr" && req.body.freeAnswer != "") {
            var isRight = false;
            const antsy = getQuestion(Ques, req.body.id).then(antsy => {
                // check answer
                if (antsy.answer[0] == req.body.freeAnswer.trim()) {
                    isRight = true;
                }
                // modify ratings
                oldUserRating = req.user.rating[antsy.subject[0].toLowerCase()];
                oldQRating = antsy.rating;
                setRating(antsy.subject[0], calculateRatings(oldUserRating, oldQRating, isRight).newUserRating, req);
                setQRating(antsy, calculateRatings(oldUserRating, oldQRating, isRight).newQuestionRating);
                // update counters
                updateCounters(req, antsy, isRight);
                // render answer page
                res.render(__dirname + '/views/private/' + 'train_answerExplanation.ejs', { units: req.body.units, userAnswer: req.body.freeAnswer, userRating: getRating(req.body.subject, req), subject: req.body.subject, newQues: antsy, correct: isRight, oldUserRating: oldUserRating, oldQ: oldQRating, user: req.user });
            });
        }
    }
    else {
        res.redirect("/");
    }
});

app.post("/changeInfo", (req, res) => {
    // settings page
    if (req.isAuthenticated()) {

        // change profile settings

        req.user.profile.name = req.body.name;
        req.user.profile.bio = req.body.bio;
        req.user.profile.location = req.body.location;
        req.user.profile.age = req.body.age;

        db.collection("users").findOneAndUpdate({ _id: req.user._id }, { $set: { profile: { age: req.user.profile.age, location: req.user.profile.location, name: req.user.profile.name, bio: req.user.profile.bio } } });

        console.log("Profile has been updated");

        // change account settings

        if (req.body.ign && req.body.ign != req.user.ign) {
            User.count({ ign: req.body.ign }, function (err, count) {
                if (count > 0) {
                    console.log("username exists"); // flash
                } else {
                    console.log("username does not exist");
                    db.collection("users").findOneAndUpdate({ _id: req.user._id }, { $set: { ign: req.body.ign } });
                }
            });
        } else {
            console.log("Empty username or no change");
        }

        if(req.body.username && req.body.username != req.user.username) {
            User.count({ username: req.body.username }, function (err, count) {
                if (count > 0) {
                    console.log("email exists"); // flash
                } else {
                    console.log("email does not exist");
                    db.collection("users").findOneAndUpdate({ _id: req.user._id }, { $set: { username: req.body.username } });
                    console.log("email updated");
                }
            });
        } else {
            console.log("Empty email or no change");
        }

        console.log("log marker 1");

        if(req.body.password) {
            const newPass = genPassword(req.body.password);
            req.user.hash = newPass.hash;
            req.user.salt = newPass.salt;
        }
        db.collection("users").findOneAndUpdate({ _id: req.user._id }, { $set: {  hash: req.user.hash, salt: req.user.salt } });
        //db.collection("users").findOneAndUpdate({ _id: req.user._id }, { $set: {  hash: req.user.hash, salt: req.user.salt, username: req.user.username, ign: req.user.ign} });

        res.redirect("/settings");

    }
    else {
        res.redirect("/");
    }
});

// PUBLIC USER GET ROUTES

app.get("/", (req, res) => {
    if (!req.isAuthenticated()) {
        res.render(__dirname + '/views/public/' + 'index.ejs');
    }
    else {
        res.redirect("/homepage");
    }
});

app.get("/signin", (req, res) => {
    if (!req.isAuthenticated()) {
        res.render(__dirname + '/views/public/' + 'signin.ejs');
    }
    else {
        res.redirect("/homepage");
    }
});

app.get("/signup", (req, res) => {
    if (!req.isAuthenticated()) {
        res.render(__dirname + '/views/public/' + 'signup.ejs');
    }
    else {
        res.redirect("/homepage");
    }
});

app.get("/latex_compiler", (req, res) => {
    res.render(__dirname + '/views/public/' + 'latexcompiler.ejs');
});

// PRIVATE USER GET ROUTES

app.get("/homepage", (req, res) => {
    if (req.isAuthenticated()) {
        if ((req.user.username == "mutorialsproject@gmail.com") || (req.user.username == "s-donnerj@bsd405.org")) {
            res.render(__dirname + '/views/admin/' + 'adminHomepage.ejs');
        } else {
            res.render(__dirname + '/views/private/' + 'homepage.ejs', { user: req.user });
        }
    }
    else {
        res.redirect("/");
    }
});

app.get("/references", (req, res) => {
    if (req.isAuthenticated()) {
        res.render(__dirname + '/views/private/' + 'references.ejs');
    }
    else {
        res.redirect("/");
    }
});

app.get("/references/equations", (req, res) => {
    if (req.isAuthenticated()) {
        res.render(__dirname + '/views/private/' + 'references_equations.ejs', { equations: referenceSheet.equations });
    }
    else {
        res.redirect("/");
    }
});

app.get("/references/constants", (req, res) => {
    if (req.isAuthenticated()) {
        res.render(__dirname + '/views/private/' + 'references_constants.ejs', { constants: referenceSheet.constants });
    }
    else {
        res.redirect("/");
    }
});

app.get("/references/taglist", (req, res) => {
    if (req.isAuthenticated()) {
        res.render(__dirname + '/views/private/' + 'references_taglist.ejs', { tags: tags });
    }
    else {
        res.redirect("/");
    }
});

app.get("/references/about", (req, res) => {
    if (req.isAuthenticated()) {
        res.render(__dirname + '/views/private/' + 'references_about.ejs');
    }
    else {
        res.redirect("/");
    }
});

app.get('/email_confirmation', (req, res) => {
    if (req.isAuthenticated()) {
        debugger;
        const cc = new Promise((resolve, reject) => {
            resolve(email_validation.check_code(req.user.username, "0"));
        });
        cc.then((value) => {
            if (!value) {
                debugger;
                res.render(__dirname + '/views/private/' + 'emailConfirmation.ejs', { email: req.user.username });
            } else {
                req.flash('error_flash', 'You\'ve already confirmed your email.');
                res.redirect('/');
            }
        });
    } else {
        res.redirect('/');
    }
});

app.get("/settings", (req, res) => {
    if (req.isAuthenticated()) {
        res.render(__dirname + '/views/private/' + 'settings.ejs', { user: req.user });
    }
    else {
        res.redirect("/");
    }
});

app.get("/stats", (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect("/stats/" + req.user.ign);
    }
    else {
        res.redirect("/");
    }
});

app.get("/stats/:username", (req, res) => {
    if (req.isAuthenticated()) {
        User.findOne({ ign: req.params.username }, function (err, obj) {
            res.render(__dirname + '/views/private/' + 'stats.ejs', { user: obj, totalTags: tags });
        });
    }
    else {
        res.redirect("/");
    }
});

app.get("/train", (req, res) => {
    if (req.isAuthenticated()) {
        res.render(__dirname + '/views/private/' + 'train.ejs');
    }
    else {
        res.redirect("/");
    }
});

app.get("/train/choose_subject", (req, res) => {
    const qNum = 0;
    if (req.isAuthenticated()) {
        res.render(__dirname + '/views/private/' + 'train_chooseSubject.ejs', { subjects: subjectUnitDictionary, qNum: qNum });
    }
    else {
        res.redirect("/");
    }
})

app.get("/train/:subject/proficiency", (req, res) => {
    // called when rating isn't set for subject
    if (req.isAuthenticated()) {
        if (req.user.rating[req.params.subject.toLowerCase()] == -1) {
            req.user.rating[req.params.subject.toLowerCase()] = 0;
            //req.user.save();
            db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { rating: req.user.rating } });
            res.render(__dirname + '/views/private/' + 'train_onetime_setProficiency.ejs', { subject: req.params.subject });
        }
        else {
            res.redirect("/train");
        }
    }
    else {
        res.redirect("/");
    }
})

app.get("/train/:subject/choose_units", (req, res) => {
    const qNum = 1;
    if (req.isAuthenticated()) {
        if (req.user.rating[req.params.subject.toLowerCase()] == -1) { //check to see if redir needed
            res.redirect("/train/" + req.params.subject + "/proficiency"); //ROUTING FIX
        }

        else {

            res.render(__dirname + '/views/private/' + 'train_chooseUnits.ejs', { subject: req.params.subject, units: subjectUnitDictionary[req.params.subject], qNum: qNum, unitPresets: presetUnitOptions[req.params.subject] });

        }
    }
    else {
        res.redirect("/");
    }
})

app.get("/train/:subject/display_question", (req, res) => {
    var curQ = null;
    if (req.isAuthenticated()) {
        var units = req.query.units.split(",");
        // IMPLEMENT RATING FLOOR AND CEILING IN FUTURE
        ceilingFloor = ratingCeilingFloor(req.user.rating[req.params.subject.toLowerCase()]);
        floor = ceilingFloor.floor;
        ceiling = ceilingFloor.ceiling;
        const qs = getQuestions(Ques, floor, ceiling, req.params.subject, units).then(qs => { //copy exact then format for getquestion(s) for it to work
            curQ = qs[Math.floor(Math.random() * qs.length)];
            res.render(__dirname + '/views/private/' + 'train_displayQuestion.ejs', { units: units, newQues: curQ, subject: req.params.subject, user: req.user });
        });
    }
    else {
        res.redirect("/");
    }
});

app.get("/logout", (req, res) => {
    if (req.isAuthenticated()) {
        req.logout();
    }
    res.redirect("/");
});

//ADMIN GET ROUTES

app.get("/admin/addquestion", (req, res) => {
    if (req.isAuthenticated() && ((req.user.username == "mutorialsproject@gmail.com") || (req.user.username == "s-donnerj@bsd405.org"))) {
        res.render(__dirname + '/views/admin/' + 'train_addQuestion.ejs', { subjectUnitDictionary: subjectUnitDictionary });
    }
    else {
        res.redirect("/");
    }
});

app.get("/admin/addedSuccess", (req, res) => {
    if (req.isAuthenticated() && ((req.user.username == "mutorialsproject@gmail.com") || (req.user.username == "s-donnerj@bsd405.org"))) {
        res.render(__dirname + '/views/admin/' + 'train_addQuestionSuccess.ejs');
    }
    else {
        res.redirect("/");
    }
});

app.get("/admin/addedFailure", (req, res) => {
    if (req.isAuthenticated() && ((req.user.username ==  "mutorialsproject@gmail.com") || (req.user.username == "s-donnerj@bsd405.org"))) {
        res.render(__dirname + '/views/admin/' + 'train_addQuestionFailure.ejs');
    }
    else {
        res.redirect("/");
    }
});


// WILDCARD FOR ALL OTHER ROUTES

app.get("*", (req, res) => {
    res.redirect("/");
});

// START NODE SERVER

app.listen(PORT, (req, res) => {
    console.log(`Server Started at PORT ${PORT}`);
});
