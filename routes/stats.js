// FUNCTION IMPORTS
const { calculateLevel, analyze } = require('../utils/functions/siteAlgorithms');
const { tags } = require('../utils/constants/tags');
const { achievementDescriptions } = require('../utils/constants/achievements');
const { generateLeaderboard } = require('../utils/functions/database');

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
    app.all(/^(\/leaderboard|\/profile|\/stats).*$/, (req, res, next) => {
        if (req.isAuthenticated()) {
            next()
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/leaderboard', async (req, res) => {
        var leaderboard = await generateLeaderboard(mongo.User, 10);
        res.render(VIEWS + 'private/leaderboard.ejs', { rankings: leaderboard, pageName: "Leaderboard" });
    });

    app.get('/profile', (req, res) => {
        res.redirect('/profile/' + req.user.ign);
    });

    app.get('/profile/:username', (req, res) => {
        mongo.User.findOne({ ign: req.params.username }, async function (err, obj) {
            if (obj) {
                if (obj.preferences.hideProfile && req.user.ign != req.params.username) {
                    req.flash('errorFlash', 'This user has made their profile private.');
                    res.redirect('/homepage');
                } else {
                    var thisAge = 0;
                    if(req.user.profile.yob && obj.profile.yob != 2020){
                        thisAge = new Date().getFullYear() - obj.profile.yob;
                    }
                    let experienceStats = await calculateLevel(obj.stats.experience ? obj.stats.experience : 0);
                    res.render(VIEWS + 'private/profile.ejs', { age: thisAge, user: obj, totalTags: tags, pageName: obj.ign + "'s Profile", experienceStats, allAchievements: achievementDescriptions });
                }
            } else {
                req.flash('errorFlash', 'Error 404: File Not Found. That username doesn\'t exist.');
                res.redirect('/');
            }
        });
    });

    app.get('/stats', (req, res) => {
        res.redirect('/stats/' + req.user.ign);
    });

    app.get('/statsAdditional', async (req, res) => {
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
    });

    app.get('/stats/:username', (req, res) => {
        mongo.User.findOne({ ign: req.params.username }, async function (err, obj) {
            if (obj) {
                if (obj.preferences.hideProfile && req.user.ign != req.params.username) {
                    mongo.User.findOne({ $and: [{ teachingClasses: { $in: obj.classes } }, { ign: req.user.ign }] }).then(async (teacher) => {
                        if (teacher) {
                            let userLevel = await calculateLevel(obj.stats.experience ? obj.stats.experience : 0);
                            let analytics = await analyze(obj.stats.units ? obj.stats.units : {});

                            res.render(VIEWS + 'private/stats.ejs', { user: obj, totalTags: tags, userLevel, analytics, pageName: obj.ign + "'s Stats" });
                        } else {
                            req.flash('errorFlash', 'This user has made their stats private.');
                            res.redirect('/homepage');
                        }
                    });
                } else {
                    let userLevel = await calculateLevel(obj.stats.experience ? obj.stats.experience : 0);
                    let analytics = await analyze(obj.stats.units ? obj.stats.units : {});

                    res.render(VIEWS + 'private/stats.ejs', { user: obj, totalTags: tags, userLevel, analytics, pageName: obj.ign + "'s Stats" });
                }
            } else {
                req.flash('errorFlash', 'Error 404: File Not Found. That username doesn\'t exist.');
                res.redirect('/');
            }
        });
    });
}
