const { tags } = require('../utils/constants/tags');
const { subjectUnitDictionary } = require('../utils/constants/subjects');
const { parseDelimiter } = require('../utils/functions/general');
const { queryContributor } = require('../utils/functions/admin');
const mongoose = require("mongoose");
const db = mongoose.connection;

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {

    app.all(/^(\/contributor).*$/, (req, res, next) => {
        if (req.isAuthenticated() && req.user.contributor) {
            next()
        } else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });

    // prefix all contributor routes with /contributor
    app.post('/contributors/addQuestion', (req, res, next) => {

        if (req.body.question.length < 1
            || parseDelimiter(req.body.answer)[0].length < 1
            || req.body.rating.length < 1
            || req.body.answerExplanation.length < 1
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

        const newQ = new mongo.PendingQues({
            question: req.body.question,
            choices: parseDelimiter(req.body.choices),
            tags: parseDelimiter(req.body.tags),
            rating: req.body.rating,
            answer: parseDelimiter(req.body.answer),
            answer_ex: req.body.answerExplanation,
            author: req.user.contributor,
            type: req.body.type,
            ext_source: req.body.externalSource,
            source_statement: req.body.sourceStatement,
            subject: req.body.subject,
            units: req.body.units,
            reviewers: []
        })

        newQ.save();

        res.json({
            success: true
        });
    });

    app.get('/contributors/addQuestion', (req, res) => {
        res.render(VIEWS + 'contributors/contributorAddQuestion.ejs', { subjectUnitDictionary, pageName: "CONTRIBUTOR Add Question" });
    });

    app.get('/contributors/getContributorStats', async (req, res) => {
        let contributor = await queryContributor(req.query.id, mongo.Ques, mongo.PendingQues);
        res.json(contributor);
    });

    app.get('/contributors/stats', (req, res) => {
        res.render(VIEWS + 'contributors/contributorStats.ejs', { contributorID: req.user.contributor, pageName: "CONTRIBUTOR Stats" });
    });
}
