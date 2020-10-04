// FUNCTION IMPORTS
const { calculateRatings, ratingCeilingFloor } = require('../utils/functions/ratings');
const { presetUnitOptions } = require('../utils/constants/presets');
const { tags } = require('../utils/constants/tags');
const { referenceSheet } = require('../utils/constants/referencesheet');
const { subjectUnitDictionary } = require('../utils/constants/subjects');
const { adminList, contributorList } = require('../utils/constants/sitesettings');
const { arraysEqual } = require('../utils/functions/general');
const { getQuestion, getQuestions, getRating, setRating, setQRating, updateTracker, updateAll, updateQuestionQueue,
    clearQuestionQueue, skipQuestionUpdates, generateLeaderboard, getDailyQuestion, getSiteData } = require('../utils/functions/database');


const VIEWS = __dirname + '/../views/'

module.exports = (app, mongo) => {
    app.post('/private/initialRating', (req, res, next) => {
        // initial ratings set proficiency

        if (req.isAuthenticated()) {
            req.user.rating[req.body.subject.toLowerCase()] = req.body.level;
            mongo.db.collection('users').findOneAndUpdate({ username: req.user.username }, { $set: { rating: req.user.rating } });
            res.redirect('/train/' + req.body.subject + '/chooseUnits');
        }
        else {
            res.redirect('/');
        }
    });

    app.post('/selQ', (req, res, next) => {
        //select question
        //var subj = null;
        var units = null;
        /*
        if (req.body.qNum == 0) {
            subj = req.body.subj;
            res.redirect('/train/' + req.body.subj + '/chooseUnits');
        }
        */
        if(req.isAuthenticated()){
            var units = null;
            /*
            if (req.body.qNum == 0) {
                subj = req.body.subj;
                res.redirect('/train/' + req.body.subj + '/chooseUnits');
            }
            */
            if (req.body.qNum == 1) {
                units = req.body.unitChoice;
                if (!units) {
                    req.flash('errorFlash', 'Please choose at least one unit.');
                    res.redirect('/train/' + req.body.subj + '/chooseUnits');
                }
                if (units) { //nothing happens if units is empty
                    res.redirect('/train/' + req.body.subj + '/displayQuestion?units=' + units.toString());
                }
                //app.set('questionz', questions);
                //units cannot have commas

            }
        }
    });

    app.post('/train/checkAnswer', (req, res, next) => {
        if (req.isAuthenticated()) {

            if (req.body.type == 'mc' && req.body.answerChoice != undefined) {
                var isRight = false;
                const antsy = getQuestion(mongo.Ques, req.body.id).then(antsy => {

                    // clear pending question
                    clearQuestionQueue(req, antsy.subject[0]);

                    // check answer
                    if (antsy.answer[0] == req.body.answerChoice) {
                        isRight = true;
                    }

                    // modify ratings
                    var oldUserRating = req.user.rating[antsy.subject[0].toLowerCase()];
                    var oldQRating = antsy.rating;
                    // update stats
                    if(req.user.stats.lastAnswered != antsy._id) {
                        setRating(antsy.subject[0], calculateRatings(oldUserRating, oldQRating, isRight).newUserRating, req);
                        setQRating(antsy, calculateRatings(oldUserRating, oldQRating, isRight).newQuestionRating);

                        // update counters & tag collector
                        updateAll(req, antsy, isRight);
                    } else {

                        // update tracker
                        updateTracker(req, antsy);
                    }
                    // render answer page
                    res.render(VIEWS + 'private/train/answerExplanation.ejs', { units: req.body.units, userAnswer: req.body.answerChoice, userRating: getRating(req.body.subject, req), subject: req.body.subject,
                        newQues: antsy, correct: isRight, oldUserRating: oldUserRating, oldQ: oldQRating, user: req.user, pageName: "Answer Explanation" });
                });
            }
            else if (req.body.type == 'sa' && req.body.saChoice != undefined) {
                var isRight = false;
                const antsy = getQuestion(mongo.Ques, req.body.id).then(antsy => {

                    // clear pending question
                    clearQuestionQueue(req, antsy.subject[0]);

                    // check answer
                    isRight = arraysEqual(antsy.answer, req.body.saChoice);

                    // modify ratings
                    var oldUserRating = req.user.rating[antsy.subject[0].toLowerCase()];
                    var oldQRating = antsy.rating;
                    // update stats
                    if(req.user.stats.lastAnswered != antsy._id) {
                        setRating(antsy.subject[0], calculateRatings(oldUserRating, oldQRating, isRight).newUserRating, req);
                        setQRating(antsy, calculateRatings(oldUserRating, oldQRating, isRight).newQuestionRating);

                        // update counters & tag collector
                        updateAll(req, antsy, isRight);
                    } else {

                        // update tracker
                        updateTracker(req, antsy);
                    }
                    // render answer page
                    res.render(VIEWS + 'private/train/answerExplanation.ejs', { units: req.body.units, userAnswer: req.body.saChoice, userRating: getRating(req.body.subject, req), subject: req.body.subject,
                        newQues: antsy, correct: isRight, oldUserRating: oldUserRating, oldQ: oldQRating, user: req.user, pageName: "Answer Explanation" });
                });
            }
            else if (req.body.type == 'fr' && req.body.freeAnswer != '') {
                var isRight = false;
                const antsy = getQuestion(mongo.Ques, req.body.id).then(antsy => {

                    // clear pending question
                    clearQuestionQueue(req, antsy.subject[0]);

                    // check answer
                    if (antsy.answer[0].toLowerCase() == req.body.freeAnswer.trim().toLowerCase()) {
                        isRight = true;
                    }

                    // modify ratings
                    var oldUserRating = req.user.rating[antsy.subject[0].toLowerCase()];
                    var oldQRating = antsy.rating;

                    // update stats
                    if(req.user.stats.lastAnswered != antsy._id) {
                        setRating(antsy.subject[0], calculateRatings(oldUserRating, oldQRating, isRight).newUserRating, req);
                        setQRating(antsy, calculateRatings(oldUserRating, oldQRating, isRight).newQuestionRating);

                        // update counters & tag collector
                        updateAll(req, antsy, isRight);
                    } else {

                        // update tracker
                        updateTracker(req, antsy);
                    }
                    // render answer page
                    res.render(VIEWS + 'private/train/answerExplanation.ejs', { units: req.body.units, userAnswer: req.body.freeAnswer, userRating: getRating(req.body.subject, req), subject: req.body.subject,
                        newQues: antsy, correct: isRight, oldUserRating: oldUserRating, oldQ: oldQRating, user: req.user, pageName: "Answer Explanation" });
                });
            }
        } else {
            res.redirect('/');
        }
    });

    app.post('/train/skipQuestion', async (req, res, next) => {
        if (req.isAuthenticated()) {

            const { subject, id, redirect } = req.body;


            // updates when skipping question
            skipQuestionUpdates(mongo.Ques, req, subject, id);

            // clear pending question
            clearQuestionQueue(req, subject);

            // redirect
            res.redirect(redirect);

        }
        else {
            res.redirect('/');
        }
    });

    app.post('/changeInfo', (req, res) => {
        // settings page
        if (req.isAuthenticated()) {

            // change profile settings
            if (!(/^\d+$/.test(req.body.age))) {
                req.flash('errorFlash', 'Please enter a valid age!');
            }
            req.user.profile.age = req.body.age;

            console.log(!!req.body.darkMode);
            req.user.preferences.dark_mode = !!req.body.darkMode;
            if (req.user.profile.age > 13) {
                if (req.body.name == filter.clean(req.body.name)) {
                    req.user.profile.name = req.body.name;
                } else {
                    req.flash('Please don\'t use bad words :)');
                }
                if (req.body.bio == filter.clean(req.body.name)) {
                    req.user.profile.bio = req.body.bio;
                } else {
                    req.flash('Please don\'t use bad words :)');
                }
                if (req.body.location == filter.clean(req.body.location)) {
                    req.user.profile.location = req.body.location;
                } else {
                    req.flash('Please don\'t use bad words :)');
                }
                console.log('Profile has been updated');
            } else {
                req.user.profile.name = "";
                req.user.profile.bio = "";
                req.user.profile.location = "Earth";
            }
            if (req.user.profile.name < 13 &&
                ( req.user.profile.name != req.body.name ||
                req.user.profile.bio != req.body.bio ||
                req.user.profile.location != req.body.location)) {
                req.flash('errorFlash', 'You have to be over 13 to give us your name or location or to have a bio.');
            }
            mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: { profile: { age: req.user.profile.age, location: req.user.profile.location, name: req.user.profile.name, bio: req.user.profile.bio }, preferences: { dark_mode: req.user.preferences.dark_mode } } }, {upsert: true});

            console.log('Profile has been updated');

            // change account settings

            if (req.body.ign && req.body.ign != req.user.ign) {
                mongo.User.countDocuments({ ign: req.body.ign }, function (err, count) {
                    if (count > 0) {
                        console.log('username exists');
                        req.flash('errorFlash', 'Sorry, this username already exists.');
                    } else {
                        console.log('username does not exist');
                        mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: { ign: req.body.ign } });
                        req.flash('successFlash', 'We successfully changed your username.');
                    }
                });
            } else {
                console.log('Empty username or no change');
            }

            if(req.body.username && req.body.username != req.user.username) {
                mongo.User.countDocuments({ username: req.body.username }, function (err, count) {
                    if (count > 0) {
                        console.log('email exists'); // flash
                        req.flash('errorFlash', 'We already have an account with that email. Try signing in with that one.');
                    } else {
                        console.log('email does not exist');
                        var confirmCode;
                        require('crypto').randomBytes(6, function (ex, buf) {
                            confirmCode = buf.toString('hex');
                            mongo.db.collection('users').findOneAndUpdate({ username: req.body.username }, { $set: { emailConfirmCode: confirmCode } });
                        });
                        req.flash('successFlash', 'You need to confirm your email. Please check your email to confirm it.');
                        mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: { username: req.body.username } });
                        console.log('email updated');
                    }
                });
            } else {
                console.log('Empty email or no change');
            }

            console.log('log marker 1');

            if(req.body.newpw) {

                if ((/\d/.test(req.body.newpw)) && (/[a-zA-Z]/.test(req.body.newpw))) {
                    if (req.body.newpw == req.body.confirmnewpw) {
                        const newPass = genPassword(req.body.newpw);
                        req.user.hash = newPass.hash;
                        req.user.salt = newPass.salt;
                        mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: {  hash: req.user.hash, salt: req.user.salt } });
                    } else {
                        req.flash('errorFlash', 'passwords don\'t match');
                    }
                } else {
                    req.flash('errorFlash', 'Password does not meet requirments.');
                }
            }
            //mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: {  hash: req.user.hash, salt: req.user.salt, username: req.user.username, ign: req.user.ign} });

            res.redirect('/settings');
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/homepage', async (req, res) => {
        if (req.isAuthenticated()) {
            if (adminList.includes(req.user.username)) {
                res.render(VIEWS + 'admin/adminHomepage.ejs');
            } else {
                let siteData = await getSiteData(mongo.User, mongo.Ques);
                res.render(VIEWS + 'private/homepage.ejs', { user: req.user, siteStats: siteData });
            }
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/leaderboard', async (req, res) => {
        if (req.isAuthenticated()) {

            var leaderboard = await generateLeaderboard(mongo.User, 10);

            res.render(VIEWS + 'private/leaderboard.ejs', { rankings: leaderboard, pageName: "Leaderboard" });
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/profile', (req, res) => {
        if (req.isAuthenticated()) {
            res.redirect('/profile/' + req.user.ign);
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/profile/:username', (req, res) => {
        if (req.isAuthenticated()) {
            mongo.User.findOne({ ign: req.params.username }, function (err, obj) {
                res.render(VIEWS + 'private/profile.ejs', { user: obj, totalTags: tags, pageName: obj.ign + "'s Profile" });
            });
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/references', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/home.ejs', { pageName: "Mutorials References" });
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/references/equations', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/equations.ejs', { equations: referenceSheet.equations, pageName: "Mutorials Equation Sheet" });
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/references/constants', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/constants.ejs', { constants: referenceSheet.constants, pageName: "Mutorials Constant Sheet" });
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/references/taglist', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/taglist.ejs', { tags: tags, pageName: "Mutorials Tags" });
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/references/about', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/about.ejs', { pageName: "About Mutorials" });
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/emailConfirmation', (req, res) => {
        if (req.isAuthenticated()) {
            debugger;
            const cc = new Promise((resolve, reject) => {
                resolve(emailValidation.checkCode(req.user.username, '0'));
            });
            cc.then((value) => {
                if (!value) {
                    debugger;
                    res.render(VIEWS + 'private/emailConfirmation.ejs', { email: req.user.username, pageName: "Email Confirmation" });
                } else {
                    req.flash('errorFlash', 'You\'ve already confirmed your email.');
                    res.redirect('/');
                }
            });
        } else {
            res.redirect('/');
        }
    });

    app.get('/settings', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/settings.ejs', { user: req.user, pageName: "Settings" });
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/stats', (req, res) => {
        if (req.isAuthenticated()) {
            res.redirect('/stats/' + req.user.ign);
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/stats/:username', (req, res) => {
        if (req.isAuthenticated()) {
            mongo.User.findOne({ ign: req.params.username }, function (err, obj) {
                res.render(VIEWS + 'private/stats.ejs', { user: obj, totalTags: tags, pageName: obj.ign + "'s Stats" });
            });
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/train', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/train/train.ejs', { pageName: "Train" });
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/train/chooseSubject', (req, res) => {
        const qNum = 0;
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/train/chooseSubject.ejs', { subjects: subjectUnitDictionary, qNum: qNum, pageName: "Train Subject" });
        }
        else {
            res.redirect('/');
        }
    })

    app.get('/train/daily', async (req, res) => {
        if (req.isAuthenticated()) {
            const date = await new Date().toISOString().split('T')[0];
            const question = await getDailyQuestion(mongo.Daily, mongo.Ques);
            res.render(VIEWS + 'private/train/dailyQuestion.ejs', { question, pageName: date + " Challenge" });
        }
        else {
            res.redirect('/');
        }
    });

    app.get('/train/:subject/proficiency', (req, res) => {
        // called when rating isn't set for subject
        if (req.isAuthenticated()) {
            if (req.user.rating[req.params.subject.toLowerCase()] == -1) {
                //req.user.rating[req.params.subject.toLowerCase()] = 0;
                //req.user.save();
                //mongo.db.collection('users').findOneAndUpdate({ username: req.user.username }, { $set: { rating: req.user.rating } });
                res.render(VIEWS + 'private/train/setProficiency.ejs', { subject: req.params.subject, pageName: req.params.subject + " Proficiency" });
            }
            else {
                res.redirect('/train');
            }
        }
        else {
            res.redirect('/');
        }
    })

    app.get('/train/:subject/chooseUnits', (req, res) => {
        const qNum = 1;
        if (req.isAuthenticated()) {
            if (req.user.rating[req.params.subject.toLowerCase()] == -1) { //check to see if redir needed
                res.redirect('/train/' + req.params.subject + '/proficiency'); //ROUTING FIX
            }
            else {
                res.render(VIEWS + 'private/train/chooseUnits.ejs', { subject: req.params.subject, units: subjectUnitDictionary[req.params.subject], qNum: qNum,
                    unitPresets: presetUnitOptions[req.params.subject], pageName: "Train Units" });
            }
        }
        else {
            res.redirect('/');
        }
    })

    app.get('/train/:subject/displayQuestion', async (req, res) => {
        var curQ = null;
        if (req.isAuthenticated()) {

            // no cache
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            // define units and attempt to get queued question
            var units = req.query.units.split(',');
            var q = "";
            if (req.user.stats.toAnswer[req.params.subject.toLowerCase()]) {
                q = await getQuestion(mongo.Ques, req.user.stats.toAnswer[req.params.subject.toLowerCase()]);
            }

            // Test if they have a question pending to answer which is valid for their units selected
            if(q && units.some(r => q.units.includes(r))) {

                res.render(VIEWS + 'private/train/displayQuestion.ejs', { units: units, newQues: q, subject: req.params.subject, user: req.user, pageName: "Classic Trainer" });

            } else {

                // deduct 8 rating if previously queued question was skipped
                if(q) {
                    skipQuestionUpdates(mongo.Ques, req, req.params.subject.toLowerCase(), q._id);
                }

                // get parameters set up
                var ceilingFloor = ratingCeilingFloor(req.user.rating[req.params.subject.toLowerCase()]);
                var floor = ceilingFloor.floor;
                var ceiling = ceilingFloor.ceiling;

                // get question
                getQuestions(mongo.Ques, floor, ceiling, req.params.subject, units).then(qs => {

                    // select random question
                    curQ = qs[Math.floor(Math.random() * qs.length)];

                    console.log(curQ);
                    if (!curQ) {
                        req.flash('errorFlash', 'We couldn\'t find any questions for your rating in the units you selected.');
                        res.redirect('/train/' + req.params.subject + '/chooseUnits');
                        return;
                    }

                    // update pending question field
                    updateQuestionQueue(req, req.params.subject, curQ._id);

                    // push to frontend
                    res.render(VIEWS + 'private/train/displayQuestion.ejs', { units: units, newQues: curQ, subject: req.params.subject, user: req.user, pageName: "Classic Trainer" });
                });

            }
        } else {
            res.redirect('/');
        }
    });

    app.get('/logout', (req, res) => {
        if (req.isAuthenticated()) {
            req.logout();
        }
        res.redirect('/');
    });
}
