// FUNCTION IMPORTS
const { calculateRatings, ratingCeilingFloor, calculateLevel, analyze } = require('../utils/functions/siteAlgorithms');
const { presetUnitOptions } = require('../utils/constants/presets');
const { tags } = require('../utils/constants/tags');
const { referenceSheet } = require('../utils/constants/referencesheet');
const { subjectUnitDictionary } = require('../utils/constants/subjects');
const { adminList, contributorList } = require('../utils/constants/sitesettings');
const { arraysEqual } = require('../utils/functions/general');
const { genPassword } = require('../utils/functions/password');
const emailValidation = require('../utils/functions/emailValidation');
const { getQuestion, getQuestions, getRating, setRating, setQRating, updateTracker, updateCounters, updateAll, updateQuestionQueue, addExperience,
    clearQuestionQueue, skipQuestionUpdates, generateLeaderboard, getDailyQuestion, getSiteData, incrementSolveCounter,
    getAnnouncements, updateRushStats } = require('../utils/functions/database');


const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
    app.post('/private/initialRating', (req, res, next) => {
        // initial ratings set proficiency

        if (req.isAuthenticated()) {
            if (req.user.rating[req.body.subject.toLowerCase()] == -1) {
                req.user.rating[req.body.subject.toLowerCase()] = req.body.level;
                mongo.db.collection('users').findOneAndUpdate({ username: req.user.username }, { $set: { rating: req.user.rating } });
            } else {
                req.flash('errorFlash', 'You\'ve already set your proficiency for that subject');
            }
            res.redirect('/train/' + req.body.subject + '/chooseUnits');
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
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
                const antsy = getQuestion(mongo.Ques, req.body.id).then(async antsy => {

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

                        // update site data
                        incrementSolveCounter(mongo.SiteData, antsy.subject[0].toLowerCase(), isRight);
                    } else {

                        // update tracker
                        updateTracker(req, antsy);
                        addExperience(req, Math.ceil(antsy.rating/20));
                    }
                    // render answer page
                    let experienceStats = await calculateLevel(req.user.stats.experience);
                    res.render(VIEWS + 'private/train/answerExplanation.ejs', { units: req.body.units, userAnswer: req.body.answerChoice, userRating: getRating(req.body.subject, req), subject: req.body.subject,
                        newQues: antsy, correct: isRight, oldUserRating: oldUserRating, oldQ: oldQRating, user: req.user, experienceStats, pageName: "Answer Explanation" });
                });
            } else if (req.body.type == 'sa' && req.body.saChoice != undefined) {
                var isRight = false;
                const antsy = getQuestion(mongo.Ques, req.body.id).then(async antsy => {

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

                        // update site data
                        incrementSolveCounter(mongo.SiteData, antsy.subject[0].toLowerCase(), isRight);
                    } else {

                        // update tracker
                        updateTracker(req, antsy);
                        addExperience(req, Math.ceil(antsy.rating/20));
                    }
                    // render answer page
                    let experienceStats = await calculateLevel(req.user.stats.experience);
                    res.render(VIEWS + 'private/train/answerExplanation.ejs', { units: req.body.units, userAnswer: req.body.saChoice, userRating: getRating(req.body.subject, req), subject: req.body.subject,
                        newQues: antsy, correct: isRight, oldUserRating: oldUserRating, oldQ: oldQRating, user: req.user, experienceStats, pageName: "Answer Explanation" });
                });
            } else if (req.body.type == 'fr' && req.body.freeAnswer != '') {
                var isRight = false;
                const antsy = getQuestion(mongo.Ques, req.body.id).then(async antsy => {

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

                        // update site data
                        incrementSolveCounter(mongo.SiteData, antsy.subject[0].toLowerCase(), isRight);
                    } else {

                        // update tracker
                        updateTracker(req, antsy);
                        addExperience(req, Math.ceil(antsy.rating/20));
                    }
                    // render answer page
                    let experienceStats = await calculateLevel(req.user.stats.experience);
                    res.render(VIEWS + 'private/train/answerExplanation.ejs', { units: req.body.units, userAnswer: req.body.freeAnswer, userRating: getRating(req.body.subject, req), subject: req.body.subject,
                        newQues: antsy, correct: isRight, oldUserRating: oldUserRating, oldQ: oldQRating, user: req.user, experienceStats, pageName: "Answer Explanation" });
                });
            } else {
                req.flash('errorFlash', 'Please choose an answer next time... We treated that as a skip (-8 rating).');
                skipQuestionUpdates(mongo.Ques, req, req.body.subject, req.body.id);
                clearQuestionQueue(req, req.body.subject);
                res.redirect(req.body.redirect);
            }
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.post('/train/skipQuestion', async (req, res, next) => {
        if (req.isAuthenticated()) {

            const { subject, id, redirect } = req.body;
            skipQuestionUpdates(mongo.Ques, req, subject, id);

            clearQuestionQueue(req, subject);

            res.redirect(redirect);

        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    // Settings page


    // change profile settings
    app.post('/changeProfile', (req, res) => {
        if (req.isAuthenticated()) {
            if (!(/^\d+$/.test(req.body.age))) {
                req.flash('errorFlash', 'Please enter a valid age!');
            }

            if (req.body.age < 1 || req.body.age > 150) {
                req.flash('errorFlash', 'You\'ve got to be at least 1 and younger than 150 to use Mutorials ;)');
            } else {
                req.user.profile.age = req.body.age;
            }

            if (req.user.profile.age > 13) {
                if (req.body.name == filter.clean(req.body.name)) {
                    if (req.body.name.length <= 50) {
                        req.user.profile.name = req.body.name;
                    } else {
                        req.flash('errorFlash', 'Please keep your name under 50 characters long.');
                    }
                } else {
                    req.flash('errorFlash', 'Keep it appropriate.');
                }
                if (req.body.bio == filter.clean(req.body.bio)) {
                    if (req.body.bio.length <= 150) {
                        req.user.profile.bio = req.body.bio;
                    } else {
                        req.flash('errorFlash', 'Please keep your bio under 150 characters long.');
                    }
                } else {
                    req.flash('errorFlash', 'Keep it appropriate.');
                }
                if (req.body.location == filter.clean(req.body.location)) {
                    if (req.body.location.length <= 50) {
                        req.user.profile.location = req.body.location;
                    } else {
                        req.flash('errorFlash', 'Please keep your location under 50 characters long.');
                    }
                } else {
                    req.flash('errorFlash', 'Keep it appropriate.');
                }
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
            // mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: { profile: { age: req.user.profile.age, location: req.user.profile.location, name: req.user.profile.name, bio: req.user.profile.bio }, preferences: { dark_mode: req.user.preferences.dark_mode } } }, {upsert: true});
            mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: { profile: { age: req.user.profile.age, location: req.user.profile.location, name: req.user.profile.name, bio: req.user.profile.bio }}}, {upsert: true});
            console.log(req.user);

            res.redirect('/settings');
            console.log('Profile has been updated');
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    // change user preferences
    app.post('/changePreferences', (req, res) => {
        if (req.isAuthenticated()) {

            req.user.preferences.dark_mode = !!req.body.darkMode;

            mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: { preferences: { dark_mode: req.user.preferences.dark_mode } } }, {upsert: true});

            console.log('Updated preferences');

            res.redirect('/settings');
        } else{
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });


    // change account settings
    app.post('/changeSettings', (req, res) => {
        if (req.isAuthenticated()) {

            if (req.body.ign && req.body.ign != req.user.ign) {

                if (!(/^[\w\-\.\~]+$/.test(req.body.ign))) {
                    req.flash('errorFlash', 'Allowed username characters: letters, numbers, underscore, hyphen, period, and tilde.');
                } else if (req.body.ign.length > 30) {
                    req.flash('errorFlash', 'Please keep your username under 30 characters long.');
                } else {
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
                }
            } else {
                console.log('Empty username or no change');
            }

            if(req.body.username && req.body.username != req.user.username) {
                if (!emailValidation.regexCheck(req.body.username)) {
                    req.flash('errorFlash', 'The email you entered is not valid.');
                } else {
                    mongo.User.countDocuments({ username: req.body.username }, function (err, count) {
                        if (count > 0) {
                            console.log('email exists');
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
                }
            } else {
                console.log('Empty email or no change');
            }

            console.log('log marker 1');

            if(req.body.newpw) {

                if ((/\d/.test(req.body.newpw)) && (/[a-zA-Z]/.test(req.body.newpw)) && req.body.newpw.length >= 7) {
                    if (req.body.newpw == req.body.confirmnewpw) {
                        const newPass = genPassword(req.body.newpw);
                        req.user.hash = newPass.hash;
                        req.user.salt = newPass.salt;
                        mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: {  hash: req.user.hash, salt: req.user.salt } });
                    } else {
                        req.flash('errorFlash', 'Passwords don\'t match.');
                    }
                } else {
                    req.flash('errorFlash', 'Password does not meet requirments.');
                }
            }
            //mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $set: {  hash: req.user.hash, salt: req.user.salt, username: req.user.username, ign: req.user.ign} });

            res.redirect('/settings');
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.post('/deleteAccount', async (req,res) => {

        if (req.isAuthenticated()) {
            mongo.db.collection('users').deleteOne({ _id: req.user._id });
            req.logout();
            console.log('Deleted Account');
            req.flash('successFlash','Goodbye.');
            res.redirect('/');
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/announcements', async (req, res) => {
        if (req.isAuthenticated()) {
            let announcements = await getAnnouncements(mongo.SiteData, 20);
            res.render(VIEWS + 'private/announcements.ejs', { announcements, pageName: "Announcements" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
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
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/homepage', async (req, res) => {
        if (req.isAuthenticated()) {
            if (adminList.includes(req.user.username)) {
                res.render(VIEWS + 'admin/adminHomepage.ejs');
            } else {
                let siteData = await getSiteData(mongo.User, mongo.Ques, mongo.SiteData);
                let experienceStats = await calculateLevel(req.user.stats.experience);
                const question = await getDailyQuestion(mongo.Daily, mongo.Ques);
                let announcements = await getAnnouncements(mongo.SiteData, 3);
                res.render(VIEWS + 'private/homepage.ejs', { user: req.user, siteStats: siteData, experienceStats, question, announcements });
            }
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/leaderboard', async (req, res) => {
        if (req.isAuthenticated()) {

            var leaderboard = await generateLeaderboard(mongo.User, 10);

            res.render(VIEWS + 'private/leaderboard.ejs', { rankings: leaderboard, pageName: "Leaderboard" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/profile', (req, res) => {
        if (req.isAuthenticated()) {
            res.redirect('/profile/' + req.user.ign);
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/profile/:username', (req, res) => {
        if (req.isAuthenticated()) {
            mongo.User.findOne({ ign: req.params.username }, async function (err, obj) {
                if (obj) {
                    let experienceStats = await calculateLevel(obj.stats.experience ? obj.stats.experience : 0);
                    res.render(VIEWS + 'private/profile.ejs', { user: obj, totalTags: tags, pageName: obj.ign + "'s Profile", experienceStats });
                } else {
                    req.flash('errorFlash', 'Error 404: File Not Found. That username doesn\'t exist.');
                    res.redirect('/');
                }
            });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/references', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/home.ejs', { pageName: "Mutorials References" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/references/equations', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/equations.ejs', { equations: referenceSheet.equations, pageName: "Mutorials Equation Sheet" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/references/constants', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/constants.ejs', { constants: referenceSheet.constants, pageName: "Mutorials Constant Sheet" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/references/taglist', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/taglist.ejs', { tags: tags, pageName: "Mutorials Tags" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/references/about', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/about.ejs', { pageName: "About Mutorials" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/search', (req, res) => {
        if (req.isAuthenticated()) {
            let { search } = req.query;
            if(search) {
                console.log(search);
                res.render(VIEWS + 'private/search.ejs', { results: {}, query: search, pageName: "Search" });
            } else {
                res.render(VIEWS + 'private/search.ejs', { results: {}, query: "", pageName: "Search" });
            }
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/settings', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/settings.ejs', { user: req.user, pageName: "Settings" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/stats', (req, res) => {
        if (req.isAuthenticated()) {
            res.redirect('/stats/' + req.user.ign);
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/statsAdditional', async (req, res) => {

        if (req.isAuthenticated()) {
            
            try {

                let { physicsRating, chemistryRating, biologyRating, experience, rushHighscore } = req.query;
                
                let globalPhysicsRank = (await mongo.User.countDocuments({ "rating.physics": { $gt: physicsRating } })) + 1;
                let globalChemistryRank = (await mongo.User.countDocuments({ "rating.chemistry": { $gt: chemistryRating } })) + 1;
                let globalBiologyRank = (await mongo.User.countDocuments({ "rating.biology": { $gt: biologyRating } })) + 1;
                let globalExperienceRank = (await mongo.User.countDocuments({ "stats.experience": { $gt: experience } })) + 1;
                let globalRushRank = (await mongo.User.countDocuments({ "stats.rush.highscore": { $gt: rushHighscore } })) + 1;

                res.json({
                    status: "Success",
                    globalRank: {
                        physics: globalPhysicsRank,
                        chemistry: globalChemistryRank,
                        biology: globalBiologyRank,
                        experience: globalExperienceRank,
                        rush: globalRushRank
                    }
                });
                
            } catch(err) {

                res.json({
                    status: "Error"
                });
            }
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/stats/:username', (req, res) => {
        if (req.isAuthenticated()) {
            mongo.User.findOne({ ign: req.params.username }, async function (err, obj) {
                if (obj) {

                    let userLevel = await calculateLevel(obj.stats.experience ? obj.stats.experience : 0);
                    let analytics = await analyze(obj.stats.units ? obj.stats.units : {});

                    res.render(VIEWS + 'private/stats.ejs', { user: obj, totalTags: tags, userLevel, analytics, pageName: obj.ign + "'s Stats" });
                } else {
                    req.flash('errorFlash', 'Error 404: File Not Found. That username doesn\'t exist.');
                    res.redirect('/');
                }
            });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/train', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/train/train.ejs', { pageName: "Train" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/train/chooseSubject', (req, res) => {
        const qNum = 0;
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/train/chooseSubject.ejs', { subjects: subjectUnitDictionary, qNum: qNum, pageName: "Train Subject" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/train/daily', async (req, res) => {
        if (req.isAuthenticated()) {
            const date = await new Date().toISOString().split('T')[0];
            const question = await getDailyQuestion(mongo.Daily, mongo.Ques);
            res.render(VIEWS + 'private/train/dailyQuestion.ejs', { question, pageName: date + " Challenge" });
        }
        else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/train/rush', async (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/train/rush.ejs', { pageName: "Problem Rush" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/train/rush/loadQuestion', async (req, res) => {
        if (req.isAuthenticated()) {
            
            try {

                let score = parseInt(req.query.score);

                let lowerBound = 500+score*100;
                let upperBound = 500+(score+1)*100-1;
                if(score == 0) {
                    lowerBound = 0;
                }

                let selection = undefined;
                while(!selection) {

                    let questions = await mongo.Ques.find({ type: "mc", rating: { $gte: lowerBound, $lte: upperBound } }).exec();
                    selection = questions[Math.floor(questions.length*Math.random())];

                    lowerBound -= 50;
                    upperBound += 50;
                }

                res.json({
                    status: "Success",
                    id: selection._id,
                    subject: selection.subject[0],
                    rating: selection.rating,
                    statement: selection.question,
                    choices: selection.choices
                });
            } catch(err) {

                res.json({
                    status: "Error"
                });
            }
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/train/rush/checkAnswer', async (req, res) => {
        if (req.isAuthenticated()) {
            
            try {

                let choice = req.query.index;
                let id = req.query.id;

                let question = await mongo.Ques.findOne({ _id: id }).exec();

                let correct = true;
                if(question.answer[0] != choice) {
                    correct = false;
                }

                // backend site data updates
                incrementSolveCounter(mongo.SiteData, question.subject[0].toLowerCase(), correct);
                addExperience(req, correct ? (question.rating/2) : (question.rating/4));
                updateCounters(req, question, correct);
                setQRating(question, correct ? Math.max(0, question.rating - 1) : question.rating + 1);

                res.json({
                    status: "Success",
                    correct
                });
            } catch(err) {

                res.json({
                    status: "Error"
                });
            }
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/train/rush/results', async (req, res) => {
        if (req.isAuthenticated()) {
            
            try {

                let score = req.query.score;

                await updateRushStats(req.user, score);
                
                let user = await mongo.User.findOne({ _id: req.user._id }).exec();;

                let highscore = user.stats.rush.highscore;
                
                res.json({
                    status: "Success",
                    highscore
                });
                
            } catch(err) {

                res.json({
                    status: "Error"
                });
            }
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/train/:subject/proficiency', (req, res) => {

        // called when rating isn't set for subject
        if (req.isAuthenticated()) {
            if (req.user.rating[req.params.subject.toLowerCase()] == -1) {
                
                res.render(VIEWS + 'private/train/setProficiency.ejs', { subject: req.params.subject, pageName: req.params.subject + " Proficiency" });
            }
            else {
                res.redirect('/train');
            }
        }
        else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

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
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

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

            // get experience stats
            let experienceStats = await calculateLevel(req.user.stats.experience);

            // Test if they have a question pending to answer which is valid for their units selected
            if (q && units.some(r => q.units.includes(r))) {

                res.render(VIEWS + 'private/train/displayQuestion.ejs', { units: units, newQues: q, subject: req.params.subject, user: req.user, experienceStats, pageName: "Classic Trainer" });

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
                    res.render(VIEWS + 'private/train/displayQuestion.ejs', { units: units, newQues: curQ, subject: req.params.subject, user: req.user, experienceStats, pageName: "Classic Trainer" });
                });

            }
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
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
