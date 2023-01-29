// FUNCTION IMPORTS
const { calculateLevel, analyze } = require('../utils/functions/siteAlgorithms');
const { adminList } = require('../utils/constants/sitesettings');
const { generateLeaderboard, getDailyQuestion, getSiteData, getAnnouncements, querySite } = require('../utils/functions/database');
const mongoose = require("mongoose");
const { parseDelimiter } = require('../utils/functions/general');

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
    app.all(/^(\/announcements|\/homepage|\/question|\/search).*$/, (req, res, next) => {
        if (req.isAuthenticated()) {
            next()
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/usaboHomepage', async (req, res) => {
        let siteData = await getSiteData(mongo.User, mongo.Ques, mongo.SiteData);
        let experienceStats = await calculateLevel(req.user.stats.experience);
        const question = await getDailyQuestion(mongo.Daily, mongo.Ques);
        let announcements = await getAnnouncements(mongo.SiteData, 3);
        res.render(VIEWS + 'usabo/homepage.ejs', { user: req.user, siteStats: siteData, admin: adminList.includes(req.user.username), experienceStats, question, announcements });
    });

    app.get('/question/:id', (req, res) => {
        mongo.Ques.findOne({ _id: req.params.id }, async function (err, obj) {
            if (obj) {
                res.render(VIEWS + 'private/question.ejs', { question: obj, pageName: "Question " + obj._id });
            } else {
                req.flash('errorFlash', 'Error 404: File Not Found. That question doesn\'t exist.');
                res.redirect('/');
            }
        });
    });

    app.post('/contributors/addUSABOQuestion', (req, res, next) => {

        if (req.body.question.length < 1
            || parseDelimiter(req.body.answer)[0].length < 1
            || req.body.rating.length < 1
            || req.body.answerExplanation.length < 1
            || req.body.type.length < 1
            || !req.body.round
            || !req.body.categories) {
            res.json({
                success: false
            });
            return;
        }
        let newQ = 0;
        //if (!(adminList.includes(req.user.username))){
            newQ = new mongo.USABOPendingQues({
                question: req.body.question,
                choices: parseDelimiter(req.body.choices),
                year: req.body.year,
                rating: req.body.rating,
                answer: parseDelimiter(req.body.answer),
                answer_ex: req.body.answerExplanation,
                author: req.user.contributor,
                type: req.body.type,
                problemNumber: req.body.problemNumber,
                round: req.body.round,
                categories: req.body.categories,
                reviewers: []
            })
        /*} else {
            newQ = new mongo.USABOQues({
                question: req.body.question,
                choices: parseDelimiter(req.body.choices),
                year: req.body.year,
                rating: req.body.rating,
                answer: parseDelimiter(req.body.answer),
                answer_ex: req.body.answerExplanation,
                author: req.user.contributor,
                type: req.body.type,
                problemNumber: req.body.problemNumber,
                round: req.body.round,
                categories: req.body.categories,
                reviewers: []
            })
        }*/

        newQ.save();

        res.json({
            success: true
        });
    });

    app.get('/contributors/addUSABOQuestion', (req, res) => {
        res.render(VIEWS + 'usabo/contributorAddQuestion.ejs', { pageName: "CONTRIBUTOR Add USABO Question" });
    });
}
