// FUNCTION IMPORTS
const { tags } = require('../utils/constants/tags');
const { subjectUnitDictionary } = require('../utils/constants/subjects');
const { adminList, contributorList } = require('../utils/constants/sitesettings');
const { parseDelimiter } = require('../utils/functions/general');

const VIEWS = "../views/"

module.exports = (app, mongo) => {
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
    app.get('/devbutton', (req, res) => {
        if (req.isAuthenticated() && (adminList.includes(req.user.username))) {
            req.flash('successFlash', 'success click button');
            var contributorIDDictionary = {
                "ANJ": "Joseph",
                "AWATEO": "Om",
                "CHENJ": "Jeffrey",
                "CHENR": "Ray",
                "CHUNGJ": "Jaewon",
                "DENGC": "Colin",
                "DESAII": "Ishaan",
                "DONNERJ": "Jake",
                "DWIVEDYA": "Aditi",
                "GUIE": "Elsa",
                "KOTHAKOTAG": "Gnapika",
                "LAMA": "Allison",
                "LIA": "Anna",
                "LIH": "Hanting",
                "LIM": "Michael",
                "LIS": "Sophia",
                "MAE": "Erik",
                "MEHTAK": "Kareena",
                "ORONAE": "Eli",
                "PANDEYR": "Rohan",
                "PARKS": "Sean",
                "RAIZMANA": "Ariel",
                "RAOP": "Pranshu",
                "SHENE": "Ethan",
                "SONGJ": "Jeffrey",
                "STEDMANA": "Alex",
                "SUR": "Richard",
                "THIRUV": "Ved",
                "UPADHYAYO": "Ojasw",
                "WANGW": "William",
                "WUA": "Allen",
                "WUL": "Lucas",
                "WUS": "Sarah",
                "XIAOW": "Wendy",
                "YANGC": "Claire",
                "YANN": "Nina",
                "YAOS": "Selina",
                "YOOI": "Ian",
                "YUA": "Andrew",
                "ZHANGK": "Kevin",
                "ZHENGC": "Clarence",
                "ZHIA": "Alicia"
            }
            for (const [key, value] of Object.entries(contributorIDDictionary)) {
                mongo.db.
            res.redirect('/homepage');
        } else {
            req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
            res.redirect('/');
        }
    });

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
}
