// FUNCTION IMPORTS
const { tags } = require('../utils/constants/tags');
const { subjectUnitDictionary } = require('../utils/constants/subjects');
const { adminList, contributorList } = require('../utils/constants/sitesettings');
const { parseDelimiter } = require('../utils/functions/general');
const { getSiteData, getAnnouncements } = require('../utils/functions/database');
const { getAdminData, queryContributor } = require('../utils/functions/admin');
const mongoose = require("mongoose");
var db = mongoose.connection;

const VIEWS = "../views/"

module.exports = (app, mongo) => {

    app.post('/admin/addAnnouncement', async (req, res, next) => {

        if(req.isAuthenticated() && (adminList.includes(req.user.username))) {

            try {

                let SiteData = mongo.SiteData;
                let announcements = await SiteData.findOne({ tag: "ANNOUNCEMENTS" }).exec();
                const date = await new Date().toISOString();

                let siteAnnouncements = announcements.data.site;
                siteAnnouncements = [...siteAnnouncements, {
                    date,
                    author: req.body.author,
                    title: req.body.title,
                    text: req.body.text
                }];

                announcements.data.site = siteAnnouncements;

                db.collection("sitedatas").findOneAndUpdate({ tag: "ANNOUNCEMENTS" }, { $set: { data: announcements.data } });
            } catch(err) {
                res.json({ status: "Error" });
            }
            
            res.json({ status: "Success" });

        } else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });

    app.post('/admin/addquestion', (req, res, next) => {
        //const questionStore =  new MongoStore({mongooseConnection: mongo.db, collection: 'questions'});

        if (req.isAuthenticated() && (adminList.includes(req.user.username))) {
            if (req.body.question.length < 1
                || parseDelimiter(req.body.tags).length < 1
                || req.body.rating.length < 1
                || parseDelimiter(req.body.answer)[0].length < 1
                || req.body.answerExplanation.length < 1
                || req.body.author.length < 1
                || req.body.type.length < 1
                || req.body.externalSource.length < 1
                || req.body.subject.length < 1
                || req.body.units.length < 1) {
                req.flash('errorFlash', 'You\'re forgetting a field.');
                res.redirect('/admin/addedFailure');
                return;
            }

            // append unique unit tags to taglist
            req.body.subject.forEach((subject) => {
                Object.keys(tags[subject]['Units']).forEach((unitTag) => {
                    if (req.body.units.includes(subject + ' - ' + tags[subject]['Units'][unitTag])) {
                        if(req.body.tags.length >= 1) {
                            req.body.tags = unitTag + '@' + req.body.tags;
                        } else {
                            req.body.tags = unitTag;
                        }
                    }
                });
            });

            const newQ = new mongo.Ques({
                question: req.body.question,
                choices: parseDelimiter(req.body.choices),
                tags: parseDelimiter(req.body.tags),
                rating: req.body.rating,
                answer: parseDelimiter(req.body.answer),
                answer_ex: req.body.answerExplanation,
                author: req.body.author,
                type: req.body.type,
                ext_source: req.body.externalSource,
                source_statement: req.body.sourceStatement,
                subject: req.body.subject,
                units: req.body.units,
                stats: {
                    pass: 0,
                    fail: 0
                }
            })
            //collection.insertOne({})
            newQ.save();
        } else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });


    //ADMIN GET ROUTES

    app.get('/admin/addquestion', (req, res) => {
        if (req.isAuthenticated() && (adminList.includes(req.user.username))) {
            res.render(VIEWS + 'admin/train/addQuestion.ejs', { subjectUnitDictionary: subjectUnitDictionary, pageName: "ADMIN Add Question" });
        }
        else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });

    app.get('/admin/addedSuccess', (req, res) => {
        if (req.isAuthenticated() && (adminList.includes(req.user.username))) {
            res.render(VIEWS + 'admin/train/addQuestionSuccess.ejs', { pageName: "ADMIN AddQ Success" });
        }
        else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });

    app.get('/admin/addedFailure', (req, res) => {
        if (req.isAuthenticated() && (adminList.includes(req.user.username))) {
            res.render(VIEWS + 'admin/train/addQuestionFailure.ejs', { pageName: "ADMIN AddQ Fail" });
        }
        else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });

    app.get('/admin/analytics', async (req, res) => {
        if (req.isAuthenticated() && (adminList.includes(req.user.username))) {
            let siteData = await getSiteData(mongo.User, mongo.Ques, mongo.SiteData);
            let adminData = await getAdminData(mongo.User, mongo.Ques, mongo.SiteData);
            res.render(VIEWS + 'admin/analytics.ejs', { siteData, adminData, pageName: "ADMIN Analytics" });
        }
        else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });

    app.get('/admin/announcements', async (req, res) => {
        if (req.isAuthenticated() && (adminList.includes(req.user.username))) {
            let announcements = await getAnnouncements(mongo.SiteData, 10);
            res.render(VIEWS + 'admin/announcements.ejs', { announcements, pageName: "ADMIN Announcements" });
        }
        else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });

    app.get('/admin/contributorStats', async (req, res) => {
        if (req.isAuthenticated() && (adminList.includes(req.user.username))) {
            res.render(VIEWS + 'admin/contributorStats.ejs', { pageName: "ADMIN Contributor Stats" });
        }
        else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });

    app.get('/admin/getContributorStats', async (req, res) => {
        if (req.isAuthenticated() && (adminList.includes(req.user.username))) {
            let contributor = await queryContributor(req.query.id, mongo.Ques);
            res.json(contributor);
        }
        else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });

    app.get('/admin/editQuestion', async (req, res) => {
        if (req.isAuthenticated() && (adminList.includes(req.user.username))) {
            res.render(VIEWS + 'admin/train/editQuestion.ejs', { pageName: "ADMIN Edit Question" });
        }
        else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });
}
