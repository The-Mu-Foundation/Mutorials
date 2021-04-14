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
    app.all(/^(\/admin).*$/, (req, res, next) => {
        if(req.isAuthenticated() && (adminList.includes(req.user.username))) {
            next()
        } else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });

    app.post('/admin/addAnnouncement', async (req, res, next) => {
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
    });

    app.post('/admin/addquestion', (req, res, next) => {
        if (req.body.question.length < 1
            || parseDelimiter(req.body.tags).length < 1
            || req.body.rating.length < 1
            || parseDelimiter(req.body.answer)[0].length < 1
            || req.body.answerExplanation.length < 1
            || req.body.author.length < 1
            || req.body.type.length < 1
            || req.body.externalSource.length < 1
            || !req.body.subject
            || !req.body.units) {
            res.json({
                success: false
            });
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

        newQ.save();

        res.json({
            success: true
        });
    });

    app.post('/admin/addContributor', (req, res) => {
        console.log(req.body.contributorUsername);
        mongo.db.collection("users").findOneAndUpdate({ ign: req.body.contributorUsername }, { $set: { contributor: req.body.contributorID } }, { upsert: true }).then((err, success) => {
            err ? req.flash('errorFlash', 'Contributor not found.') : req.flash('successFlash', 'Contributor successfully added!');
            res.redirect('/homepage');
        });
    })

    app.post('/admin/editQuestion', (req, res) => {
        if (req.body.question.length < 1
            || parseDelimiter(req.body.tags).length < 1
            || req.body.rating.length < 1
            || parseDelimiter(req.body.answer)[0].length < 1
            || req.body.answerExplanation.length < 1
            || req.body.author.length < 1
            || req.body.type.length < 1
            || req.body.externalSource.length < 1
            || !req.body.subject
            || !req.body.units) {
            res.json({
                success: false
            });
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
        mongo.db.collection( req.body.reviewerID ? "pendingQuestions" : "questions" ).findOneAndUpdate(
            { _id: mongoose.Types.ObjectId(req.body.id) },
            {
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
                $push: { reviewers: req.body.reviewerID }
            }
        ).then((err, question) => {
            if (question.reviewers.length == 2 && req.body.reviewerID) {
                // 2 reviews complete, move to questions collection
            }
            res.json({
                success: err ? true : false
            });
        })
    });

    //ADMIN GET ROUTES

    app.get('/admin/addquestion', (req, res) => {
        res.render(VIEWS + 'admin/train/addQuestion.ejs', { subjectUnitDictionary, pageName: "ADMIN Add Question" });
    });

    app.get('/admin/addedSuccess', (req, res) => {
        res.render(VIEWS + 'admin/train/addQuestionSuccess.ejs', { pageName: "ADMIN AddQ Success" });
    });

    app.get('/admin/addedFailure', (req, res) => {
        res.render(VIEWS + 'admin/train/addQuestionFailure.ejs', { pageName: "ADMIN AddQ Fail" });
    });

    app.get('/admin/analytics', async (req, res) => {
        let siteData = await getSiteData(mongo.User, mongo.Ques, mongo.SiteData);
        let adminData = await getAdminData(mongo.User, mongo.Ques, mongo.SiteData);
        res.render(VIEWS + 'admin/analytics.ejs', { siteData, adminData, pageName: "ADMIN Analytics" });
    });

    app.get('/admin/announcements', async (req, res) => {
        let announcements = await getAnnouncements(mongo.SiteData, 10);
        res.render(VIEWS + 'admin/announcements.ejs', { announcements, pageName: "ADMIN Announcements" });
    });

    app.get('/admin/contributorStats', async (req, res) => {
        res.render(VIEWS + 'admin/contributorStats.ejs', { pageName: "ADMIN Contributor Stats" });
    });

    app.get('/admin/getContributorStats', async (req, res) => {
        let contributor = await queryContributor(req.query.id, mongo.Ques, mongo.PendingQues);
        res.json(contributor);
    });

    app.get('/admin/editQuestion', async (req, res) => {
        mongo.db.collection('questions').findOne({ _id: mongoose.Types.ObjectId(req.query.id) }).then((err, question) => {
            if (!err) {
                res.render(VIEWS + 'admin/train/editQuestion.ejs', {
                    subjectUnitDictionary: subjectUnitDictionary,
                    question: question,
                    pageName: "ADMIN Edit Question"
                });
            } else {
                req.flash('errorFlash', 'Question not found.');
                res.redirect('/homepage')
            }
        });
    });

    app.get('/admin/reviewQuestion', async (req, res) => {
        mongo.db.collection('pendingQuestions').findOne({ question: /.*/ }).then((question) => {
            console.log(question);
            res.render(VIEWS + 'admin/train/editQuestion.ejs', {
                isReview: true,
                subjectUnitDictionary: subjectUnitDictionary,
                question: question,
                pageName: "ADMIN Review Question"
            });
        })
            // if (!err) {
            // } else {
            //     req.flash('errorFlash', 'Question not found.');
            //     res.redirect('/homepage')
            // }
    });
}
