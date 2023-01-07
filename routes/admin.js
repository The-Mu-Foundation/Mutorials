// FUNCTION IMPORTS
const { tags } = require('../utils/constants/tags');
const { subjectUnitDictionary } = require('../utils/constants/subjects');
const { adminList } = require('../utils/constants/sitesettings');
const { parseDelimiter } = require('../utils/functions/general');
const { getSiteData, getAnnouncements } = require('../utils/functions/database');
const { getAdminData, queryContributor } = require('../utils/functions/admin');
const mongoose = require("mongoose");
const { userSchema } = require('../database/models/user');
const db = mongoose.connection;
//const user = require('../database/models/user');
//const userInfo = mongoose.model('userInfo', user);

const VIEWS = "../views/"

module.exports = (app, mongo) => {
    app.all(/^(\/admin).*$/, (req, res, next) => {
        if (req.isAuthenticated() && (adminList.includes(req.user.username))) {
            next()
        } else if (req.isAuthenticated() && !(adminList.includes(req.user.username))) {
            req.flash('errorFlash', 'Error 403: You don\'t have permission to access this resource.');
            res.redirect('/');
        } else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });

    app.post('/admin/addAnnouncement', async (req, res, _) => {
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
        } catch (err) {
            res.json({ status: "Error" });
        }
        res.json({ status: "Success" });
    });

    app.post('/admin/addquestion', (req, res, _) => {
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
                    if (req.body.tags.length >= 1) {
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
        mongo.db.collection("users").findOneAndUpdate({ ign: req.body.contributorUsername }, { $set: { contributor: req.body.contributorID } }).then((result) => {
            (!result.value) ? req.flash('errorFlash', 'Contributor not found.') : req.flash('successFlash', 'Contributor successfully added!');
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
            || !req.body.units
            || (req.user.contributor != req.body.reviewerID) == ('isEdit' != req.body.reviewerID)) {
            res.json({
                success: false
            });
            return;
        }

        // append unique unit tags to taglist
        req.body.subject.forEach((subject) => {
            Object.keys(tags[subject]['Units']).forEach((unitTag) => {
                if (req.body.units.includes(subject + ' - ' + tags[subject]['Units'][unitTag])) {
                    if (req.body.tags.length >= 1) {
                        req.body.tags = unitTag + '@' + req.body.tags;
                    } else {
                        req.body.tags = unitTag;
                    }
                }
            });
        });

        // remove duplicate tags
        req.body.tags = [...new Set(req.body.tags.split('@'))].join('@');
        
        mongo.db.collection(req.body.reviewerID != "isEdit" ? "pendingQuestions" : "questions").findOneAndUpdate(
            { _id: mongoose.Types.ObjectId(req.body.questionID) },
            {
                $set: {
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
                },
                $addToSet: {
                    reviewers: req.body.reviewerID
                }
            },
            { new: true }
        ).then((err, question) => {
            question = question ? question : err.value;
            if (req.body.reviewerID != 'isEdit' && question && question.reviewers.length > 0) {
                // 2 reviews complete, move to questions collection
                mongo.db.collection("pendingQuestions").deleteOne({ _id: question._id }, (err, _) => {
                    if (err) {
                        console.log(err);
                    } else {
                        mongo.db.collection("questions").insertOne({
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
                        }, (err, _) => {
                            if (err) {
                                console.log(err);
                            }
                            res.json({
                                success: true
                            });
                        });
                    }
                });
            } else {
                res.json({
                    success: err ? true : false
                });
            }
        });
    });

    app.post('/admin/skipQuestion', (req, res) => {
        console.log("post " + req.cookies['skipQuestions']);
        c = req.cookies['skipQuestions'];
        if (c) { c.push(req.body.questionID) } else { c = [req.body.questionID] }
        res.cookie('skipQuestions', c).json({ success: true });
    });

    //ADMIN GET ROUTES

    app.get('/admin/adminHomepage', (req, res) => {
        c = req.cookies['skipQuestions'];
        if (!c) { c = []; } else { c = c.map(mongoose.Types.ObjectId) }
        mongo.db.collection('pendingQuestions').countDocuments({ $and: [{ reviewers: { $ne: req.user.contributor } }, { $id: { $nin: c } }] }).then((numUser, err) => {
            if (err) { console.log(1, err); } else {
                mongo.db.collection('pendingQuestions').countDocuments({ question: /.*/ }, (err, numAll) => {
                    if (err) { console.log(2, err); }
                    res.render(VIEWS + 'admin/adminHomepage.ejs', { numUser: numUser, numAll: numAll });
                });
            }
        });
    })

    app.get('/admin/addquestion', (_, res) => {
        res.render(VIEWS + 'admin/train/addQuestion.ejs', { subjectUnitDictionary, pageName: "ADMIN Add Question" });
    });

    app.get('/admin/addedSuccess', (_, res) => {
        res.render(VIEWS + 'admin/train/addQuestionSuccess.ejs', { pageName: "ADMIN AddQ Success" });
    });

    app.get('/admin/addedFailure', (_, res) => {
        res.render(VIEWS + 'admin/train/addQuestionFailure.ejs', { pageName: "ADMIN AddQ Fail" });
    });

    app.get('/admin/analytics', async (_, res) => {
        let siteData = await getSiteData(mongo.User, mongo.Ques, mongo.SiteData);
        let adminData = await getAdminData(mongo.User, mongo.Ques, mongo.SiteData);
        res.render(VIEWS + 'admin/analytics.ejs', { siteData, adminData, pageName: "ADMIN Analytics" });
    });

    app.get('/admin/announcements', async (_, res) => {
        let announcements = await getAnnouncements(mongo.SiteData, 10);
        res.render(VIEWS + 'admin/announcements.ejs', { announcements, pageName: "ADMIN Announcements" });
    });

    app.get('/admin/contributorStats', async (_, res) => {
        res.render(VIEWS + 'admin/contributorStats.ejs', { pageName: "ADMIN Contributor Stats" });
    });

    app.get('/admin/getContributorStats', async (req, res) => {
        let contributor = await queryContributor(req.query.id, mongo.Ques, mongo.PendingQues);
        res.json(contributor);
    });

    // Master list of questions
    app.get('/admin/allQuestions', async (req, res) => {
        const allQuestions = await mongo.db.collection('questions').find().toArray();
        res.render(VIEWS + 'admin/train/allQuestions.ejs', {
            questions: allQuestions
        });
    });

    app.get('/admin/editQuestion', async (req, res) => {
        mongo.db.collection('questions').findOne({ _id: mongoose.Types.ObjectId(req.query.id) }).then((question, err) => {
            if (!err) {
                res.render(VIEWS + 'admin/train/editQuestion.ejs', {
                    isReview: false,
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
        c = req.cookies['skipQuestions'];
        if (!c) { c = []; } else { c = c.map(mongoose.Types.ObjectId) }
        mongo.db.collection('pendingQuestions').findOne({ $and: [{ reviewers: { $ne: req.user.contributor } }, { _id: { $nin: c } }, {_id: mongoose.Types.ObjectId(req.query.id)}] }).then((question) => {
            if (question) {
                res.render(VIEWS + 'admin/train/editQuestion.ejs', {
                    isReview: true,
                    subjectUnitDictionary: subjectUnitDictionary,
                    question: question,
                    pageName: "ADMIN Review Question"
                });
            } else {
                req.flash('errorFlash', 'No questions to review');
                res.redirect('/homepage')
            }
        })
    });

    app.get('/admin/physicsQuestions', async (req, res) => {
        const allQuestions = await mongo.db.collection('questions').find().toArray();
        res.render(VIEWS + 'admin/train/physicsQuestions.ejs', {
            questions: allQuestions
        });
    });

    app.get('/admin/chemQuestions', async (req, res) => {
        const allQuestions = await mongo.db.collection('questions').find().toArray();
        res.render(VIEWS + 'admin/train/chemQuestions.ejs', {
            questions: allQuestions
        });
    });

    app.get('/admin/bioQuestions', async (req, res) => {
        const allQuestions = await mongo.db.collection('questions').find().toArray();
        res.render(VIEWS + 'admin/train/bioQuestions.ejs', {
            questions: allQuestions
        });
    });

    app.get('/admin/reviewQuestions', async (req, res) => {
        const pendingQuestions = await mongo.db.collection('pendingQuestions').find().toArray();
        for (let question of pendingQuestions){
            if (question.reviewers.length > 1){
                mongo.db.collection('pendingQuestions').deleteOne({ _id: question._id }, () => {
                    mongo.db.collection('questions').insertOne({
                        question: question.question,
                        choices: question.choices,
                        tags: question.tags,
                        rating: question.rating,
                        answer: question.answer,
                        answer_ex: question.answer_ex,
                        author: question.author,
                        type: question.type,
                        ext_source: question.ext_source,
                        source_statement: question.source_statement,
                        subject: question.subject,
                        units: question.units,
                        reviewers: question.reviewers
                    })
                })
            }
        }
        pendingQuestions = await mongo.db.collection('pendingQuestions').find().toArray();
        res.render(VIEWS + 'admin/train/reviewHomepage.ejs', { questions: pendingQuestions });
    });

    app.get('/admin/pendingBioQuestions', async (req, res) => {
        const pendingQuestions = await mongo.db.collection('pendingQuestions').find().toArray();
        res.render(VIEWS + 'admin/train/reviewBio.ejs', { questions: pendingQuestions });
    });

    app.get('/admin/pendingChemQuestions', async (req, res) => {
        const pendingQuestions = await mongo.db.collection('pendingQuestions').find().toArray();
        res.render(VIEWS + 'admin/train/reviewChem.ejs', { questions: pendingQuestions });
    });

    app.get('/admin/pendingPhysicsQuestions', async (req, res) => {
        const pendingQuestions = await mongo.db.collection('pendingQuestions').find().toArray();
        res.render(VIEWS + 'admin/train/reviewPhysics.ejs', { questions: pendingQuestions });
    });
}
