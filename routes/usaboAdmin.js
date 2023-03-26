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

    app.post('/admin/editUSABOQuestion', (req, res) => {
        if (req.body.question.length < 1
            || req.body.rating.length < 1
            || parseDelimiter(req.body.answer)[0].length < 1
            || req.body.answerExplanation.length < 1
            || req.body.author.length < 1
            || req.body.type.length < 1
            || !req.body.year
            || !req.body.round
            || !req.body.categories
            //|| !req.body.problemNumber
            || (req.user.contributor != req.body.reviewerID) == ('isEdit' != req.body.reviewerID)) {
            res.json({
                success: false
            });
            return;
        }

        
        mongo.db.collection(req.body.reviewerID != "isEdit" ? "usaboPendingQuestions" : "usaboQuestions").findOneAndUpdate(
            { _id: mongoose.Types.ObjectId(req.body.questionID) },
            {
                $set: {
                    question: req.body.question,
                    choices: parseDelimiter(req.body.choices),
                    year: req.body.year,
                    rating: req.body.rating,
                    answer: parseDelimiter(req.body.answer),
                    answer_ex: req.body.answerExplanation,
                    author: req.body.author,
                    type: req.body.type,
                    problemNumber: req.body.problemNumber,
                    round: req.body.round,
                    categories: req.body.categories,
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
                mongo.db.collection("usaboPendingQuestions").deleteOne({ _id: question._id }, (err, _) => {
                    if (err) {
                        console.log(err);
                    } else {
                        mongo.db.collection("usaboQuestions").insertOne({
                            question: req.body.question,
                            choices: parseDelimiter(req.body.choices),
                            year: req.body.year,
                            rating: req.body.rating,
                            answer: parseDelimiter(req.body.answer),
                            answer_ex: req.body.answerExplanation,
                            author: req.body.author,
                            type: req.body.type,
                            problemNumber: req.body.problemNumber,
                            round: req.body.round,
                            categories: req.body.categories,
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

    //ADMIN GET ROUTES

    app.get('/admin/usaboAdminHomepage', (req, res) => {
        c = req.cookies['skipQuestions'];
        if (!c) { c = []; } else { c = c.map(mongoose.Types.ObjectId) }
        mongo.db.collection('usaboPendingQuestions').countDocuments({ $and: [{ reviewers: { $ne: req.user.contributor } }, { $id: { $nin: c } }] }).then((numUser, err) => {
            if (err) { console.log(1, err); } else {
                mongo.db.collection('usaboPendingQuestions').countDocuments({ question: /.*/ }, (err, numAll) => {
                    if (err) { console.log(2, err); }
                    res.render(VIEWS + 'usabo/adminHomepage.ejs', { numUser: numUser, numAll: numAll });
                });
            }
        });
    })

    app.get('/admin/addUSABOquestion', (_, res) => {
        res.render(VIEWS + 'usabo/contributorAddQuestion.ejs', { pageName: "ADMIN Add USABO Question" });
    });

    // Master list of questions
    app.get('/admin/allUSABOQuestions', async (req, res) => {
        let allQuestions = await mongo.db.collection('usaboQuestions').find().toArray();
        /*for (let question of allQuestions){
            mongo.db.collection('usaboQuestions').findOneAndUpdate(
                { _id: mongoose.Types.ObjectId(question._id) },
                {
                    $set: {
                        subject: ['USABO'],
                        stats: {
                            pass: 0,
                            fail: 0
                        }
                    }
                }
            )
        }*/
        const tempQuestions = await mongo.db.collection('questions').find({ subject: ['USABO'] }).toArray();
        /*for (let question of tempQuestions){
            let tagStart = 0//question.units.length;
            for (let i = 0; i < question.units.length; i++){
                question.units[i] = question.units[i].substring(8);
            }
            let newQ = new mongo.USABOQues({
                question: question.question,
                choices: question.choices,
                rating: question.rating,
                answer: question.answer,
                answer_ex: question.answer_ex,
                author: question.author,
                type: question.type,
                categories: question.units,
                year: parseInt(question.tags[tagStart]),
                problemNumber: question.tags[tagStart + 1].substring(9),
                round: question.tags[tagStart + 2],
                stats: question.stats,
                writtenDate: question.writtenDate,
                subject: ['USABO'],
                reviewers: question.reviewers
                });
                newQ.save();
                mongo.db.collection("questions").deleteOne({ _id: question._id });
        }*/
        allQuestions = await mongo.db.collection('usaboQuestions').find().toArray();
        res.render(VIEWS + 'usabo/train/allQuestions.ejs', {
            questions: allQuestions, leftToTransfer: tempQuestions.length
        });
    });

    app.get('/admin/editUSABOQuestion', async (req, res) => {
        mongo.db.collection('usaboQuestions').findOne({ _id: mongoose.Types.ObjectId(req.query.id) }).then((question, err) => {
            if (!err) {
                res.render(VIEWS + 'usabo/train/editQuestion.ejs', {
                    isReview: false,
                    question: question,
                    pageName: "ADMIN Edit Question"
                });
            } else {
                req.flash('errorFlash', 'Question not found.');
                res.redirect('/usaboHomepage')
            }
        });
    });

    app.get('/admin/reviewUSABOQuestion', async (req, res) => {
        c = req.cookies['skipQuestions'];
        if (!c) { c = []; } else { c = c.map(mongoose.Types.ObjectId) }
        mongo.db.collection('usaboPendingQuestions').findOne({ $and: [{ reviewers: { $ne: req.user.contributor } }, { _id: { $nin: c } }, {_id: mongoose.Types.ObjectId(req.query.id)}] }).then((question) => {
            if (question) {
                res.render(VIEWS + 'usabo/train/editQuestion.ejs', {
                    isReview: true,
                    question: question,
                    pageName: "ADMIN Review USABO Question"
                });
            } else {
                req.flash('errorFlash', 'No questions to review');
                res.redirect('/usaboHomepage')
            }
        })
    });

    app.get('/admin/reviewUSABOQuestions', async (req, res) => {
        let pendingQuestions = await mongo.db.collection('usaboPendingQuestions').find().toArray();
        for (let question of pendingQuestions){
            if (question.reviewers.length > 1){
                mongo.db.collection('usaboPendingQuestions').deleteOne({ _id: question._id }, () => {
                    mongo.db.collection('usaboQuestions').insertOne({
                        question: question.question,
                        choices: question.choices,
                        year: question.year,
                        rating: question.rating,
                        answer: question.answer,
                        answer_ex: question.answer_ex,
                        author: question.author,
                        type: question.type,
                        problemNumber: question.problemNumber,
                        round: question.round,
                        categories: question.categories,
                        reviewers: question.reviewers
                    })
                })
            }
        }
        pendingQuestions = await mongo.db.collection('usaboPendingQuestions').find().toArray();
        res.render(VIEWS + 'usabo/train/reviewHomepage.ejs', { questions: pendingQuestions });
    });

    app.get('/admin/transfer', async (req, res) => {
        const tempQuestions = await mongo.db.collection('questions').find({ subject: ['USABO'] }).toArray();
        for (let i = 0; i < Math.min(20, tempQuestions.length); i++){
            let question = tempQuestions[i];
            let tagStart = 0//question.units.length;
            for (let i = 0; i < question.units.length; i++){
                question.units[i] = question.units[i].substring(8);
            }
            let newQ = new mongo.USABOQues({
                question: question.question,
                choices: question.choices,
                rating: question.rating,
                answer: question.answer,
                answer_ex: question.answer_ex,
                author: question.author,
                type: question.type,
                categories: question.units,
                year: parseInt(question.tags[tagStart]),
                problemNumber: question.tags[tagStart + 1].substring(9),
                round: question.tags[tagStart + 2],
                stats: question.stats,
                writtenDate: question.writtenDate,
                subject: ['USABO'],
                reviewers: question.reviewers
                });
                newQ.save();
                mongo.db.collection("questions").deleteOne({ _id: question._id });
        }
        res.redirect('/admin/allUSABOQuestions');
    });
}