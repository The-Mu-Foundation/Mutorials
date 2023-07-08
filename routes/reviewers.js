// FUNCTION IMPORTS
const { tags } = require('../utils/constants/tags');
const {
  subjectUnitDictionary,
  subjects,
} = require('../utils/constants/subjects');
const { adminList } = require('../utils/constants/sitesettings');
const { parseDelimiter } = require('../utils/functions/general');
const {
  getSiteData,
  getAnnouncements,
} = require('../utils/functions/database');
const { getAdminData, queryContributor } = require('../utils/functions/admin');
const mongoose = require('mongoose');
const { userSchema } = require('../database/models/user');
const db = mongoose.connection;
//const user = require('../database/models/user');
//const userInfo = mongoose.model('userInfo', user);

const VIEWS = '../views/';

module.exports = (app, mongo) => {
  app.all(/^(\/reviewer).*$/, (req, res, next) => {
    if (
      req.isAuthenticated() &&
      (adminList.includes(req.user.username) || req.user.reviewer == true)
    ) {
      next();
    } else if (
      req.isAuthenticated() &&
      !adminList.includes(req.user.username) &&
      (!req.user.reviewer || req.user.reviewer == false)
    ) {
      req.flash(
        'errorFlash',
        "Error 403: You don't have permission to access this resource."
      );
      res.redirect('/');
    } else {
      req.flash(
        'errorFlash',
        "Error 404: File Not Found. That page doesn't exist."
      );
      res.redirect('/');
    }
  });

  app.post('/reviewer/editQuestion', (req, res) => {
    if (
      req.body.question.length < 1 ||
      parseDelimiter(req.body.tags).length < 1 ||
      req.body.rating.length < 1 ||
      parseDelimiter(req.body.answer)[0].length < 1 ||
      req.body.answerExplanation.length < 1 ||
      req.body.author.length < 1 ||
      req.body.type.length < 1 ||
      req.body.externalSource.length < 1 ||
      !req.body.subject ||
      !req.body.units ||
      (req.user.contributor != req.body.reviewerID) ==
        ('isEdit' != req.body.reviewerID)
    ) {
      res.json({
        success: false,
      });
      return;
    }

    // append unique unit tags to taglist
    req.body.subject.forEach((subject) => {
      Object.keys(tags[subject]['Units']).forEach((unitTag) => {
        if (
          req.body.units.includes(
            subject + ' - ' + tags[subject]['Units'][unitTag]
          )
        ) {
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

    mongo.db
      .collection(
        req.body.reviewerID != 'isEdit' ? 'pendingQuestions' : 'questions'
      )
      .findOneAndUpdate(
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
            reviewers: req.body.reviewerID,
          },
        },
        { new: true }
      )
      .then((err, question) => {
        question = question ? question : err.value;
        if (
          req.body.reviewerID != 'isEdit' &&
          question &&
          question.reviewers.length > 0
        ) {
          // 2 reviews complete, move to questions collection
          mongo.db
            .collection('pendingQuestions')
            .deleteOne({ _id: question._id }, (err, _) => {
              if (err) {
                console.log(err);
              } else {
                mongo.db.collection('questions').insertOne(
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
                    hourRefactor: question.hourRefactor,
                    writtenDate: question.writtenDate,
                  },
                  (err, _) => {
                    if (err) {
                      console.log(err);
                    }
                    res.json({
                      success: true,
                    });
                  }
                );
              }
            });
        } else {
          res.json({
            success: err ? true : false,
          });
        }
      });
  });

  app.post('/reviewer/editUSABOQuestion', (req, res) => {
    if (
      req.body.question.length < 1 ||
      req.body.rating.length < 1 ||
      parseDelimiter(req.body.answer)[0].length < 1 ||
      req.body.answerExplanation.length < 1 ||
      req.body.author.length < 1 ||
      req.body.type.length < 1 ||
      !req.body.year ||
      !req.body.round ||
      !req.body.categories ||
      //|| !req.body.problemNumber
      (req.user.contributor != req.body.reviewerID) ==
        ('isEdit' != req.body.reviewerID)
    ) {
      res.json({
        success: false,
      });
      return;
    }

    mongo.db
      .collection(
        req.body.reviewerID != 'isEdit'
          ? 'usaboPendingQuestions'
          : 'usaboQuestions'
      )
      .findOneAndUpdate(
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
            reviewers: req.body.reviewerID,
          },
        },
        { new: true }
      )
      .then((err, question) => {
        question = question ? question : err.value;
        if (
          req.body.reviewerID != 'isEdit' &&
          question &&
          question.reviewers.length > 0
        ) {
          // 2 reviews complete, move to questions collection
          mongo.db
            .collection('usaboPendingQuestions')
            .deleteOne({ _id: question._id }, (err, _) => {
              if (err) {
                console.log(err);
              } else {
                mongo.db.collection('usaboQuestions').insertOne(
                  {
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
                    hourRefactor: question.hourRefactor,
                    writtenDate: question.writtenDate,
                  },
                  (err, _) => {
                    if (err) {
                      console.log(err);
                    }
                    res.json({
                      success: true,
                    });
                  }
                );
              }
            });
        } else {
          res.json({
            success: err ? true : false,
          });
        }
      });
  });

  app.post('/reviewer/hourRefactor', (req, res) => {
    console.log('refactoring hours...');
    console.log('old hours: ' + req.body.curFactor);
    let newHours = req.body.curFactor * req.body.multiplier;
    console.log('new hours: ' + newHours);
    console.log('questionID: ' + req.body.questionID);
    mongo.db
      .collection('questions')
      .findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(req.body.questionID) },
        { $set: { hourRefactor: newHours } }
      );
    mongo.db
      .collection('pendingQuestions')
      .findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(req.body.questionID) },
        { $set: { hourRefactor: newHours } }
      );
    res.redirect('back');
  });

  app.post('/reviewer/usaboHourRefactor', (req, res) => {
    console.log('refactoring hours...');
    let newHours = req.body.curFactor * req.body.multiplier;
    console.log('new hours: ' + newHours);
    console.log('questionID: ' + req.body.questionID);
    mongo.db
      .collection('usaboQuestions')
      .findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(req.body.questionID) },
        { $set: { hourRefactor: newHours } }
      );
    mongo.db
      .collection('usaboPendingQuestions')
      .findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(req.body.questionID) },
        { $set: { hourRefactor: newHours } }
      );
    res.redirect('back');
  });

  app.get('/reviewer/reviewQuestion', async (req, res) => {
    c = req.cookies['skipQuestions'];
    if (!c) {
      c = [];
    } else {
      c = c.map(mongoose.Types.ObjectId);
    }
    mongo.db
      .collection('pendingQuestions')
      .findOne({
        $and: [
          { reviewers: { $ne: req.user.contributor } },
          { _id: { $nin: c } },
          { _id: mongoose.Types.ObjectId(req.query.id) },
        ],
      })
      .then((question) => {
        if (question) {
          res.render(VIEWS + 'admin/train/editQuestion.ejs', {
            isReview: true,
            subjectUnitDictionary: subjectUnitDictionary,
            question: question,
            pageName: 'ADMIN Review Question',
          });
        } else {
          req.flash('errorFlash', 'No questions to review');
          res.redirect('/homepage');
        }
      });
  });

  app.get('/reviewer/reviewQuestions', async (req, res) => {
    /*let questionArray = await mongo.db.collection('usaboPendingQuestions').find().toArray();
        for (question of questionArray){
            for (let i = 0; i < question.categories.length; i++){
                question.categories[i] = "USABO - " + question.categories[i];
            }
            mongo.db.collection("pendingQuestions").insertOne({
                question: question.question,
                choices: question.choices,
                tags: [question.year, "Problem: " + question.problemNumber, question.round[0]],
                rating: question.rating,
                answer: question.answer,
                answer_ex: question.answer_ex,
                author: question.author,
                type: question.type,
                ext_source: 'Competition',
                source_statement: 'USABO',
                subject: ['USABO'],
                units: question.categories,
                reviewers: question.reviewers,
                stats: question.stats
            });
            mongo.db.collection("usaboPendingQuestions").deleteOne({ _id: question._id });
        }*/
    let pendingQuestions = await mongo.db
      .collection('pendingQuestions')
      .find()
      .toArray();
    for (let question of pendingQuestions) {
      if (question.reviewers.length > 1) {
        mongo.db
          .collection('pendingQuestions')
          .deleteOne({ _id: question._id }, () => {
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
              reviewers: question.reviewers,
              writtenDate: question.writtenDate,
              hourRefactor: question.hourRefactor,
            });
          });
      }
      /*if (!question.hourRefactor) {
                let newQ = new PendingQues({
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
                    reviewers: question.reviewers,
                    stats: question.stats,
                    hourRefactor: 1
                });
                newQ.save();
                mongo.db.collection("pendingQuestions").deleteOne({ _id: question._id });
            }*/
    }
    pendingQuestions = await mongo.db
      .collection('pendingQuestions')
      .find()
      .toArray();
    res.render(VIEWS + 'admin/train/reviewHomepage.ejs', {
      questions: pendingQuestions,
      subjects: subjects,
    });
  });

  app.get('/reviewer/reviewQuestions/:subject', async (req, res) => {
    const pendingQuestions = await mongo.db
      .collection('pendingQuestions')
      .find()
      .toArray();
    res.render(VIEWS + 'admin/train/reviewSubjects.ejs', {
      questions: pendingQuestions,
      subject: req.params.subject,
    });
  });

  app.get('/reviewer/reviewUSABOQuestion', async (req, res) => {
    c = req.cookies['skipQuestions'];
    if (!c) {
      c = [];
    } else {
      c = c.map(mongoose.Types.ObjectId);
    }
    mongo.db
      .collection('usaboPendingQuestions')
      .findOne({
        $and: [
          { reviewers: { $ne: req.user.contributor } },
          { _id: { $nin: c } },
          { _id: mongoose.Types.ObjectId(req.query.id) },
        ],
      })
      .then((question) => {
        if (question) {
          res.render(VIEWS + 'usabo/train/editQuestion.ejs', {
            isReview: true,
            question: question,
            pageName: 'ADMIN Review USABO Question',
          });
        } else {
          req.flash('errorFlash', 'No questions to review');
          res.redirect('/usaboHomepage');
        }
      });
  });

  app.get('/reviewer/reviewUSABOQuestions', async (req, res) => {
    let pendingQuestions = await mongo.db
      .collection('usaboPendingQuestions')
      .find()
      .toArray();
    for (let question of pendingQuestions) {
      if (question.reviewers.length > 1) {
        mongo.db
          .collection('usaboPendingQuestions')
          .deleteOne({ _id: question._id }, () => {
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
              reviewers: question.reviewers,
              writtenDate: question.writtenDate,
              hourRefactor: question.hourRefactor,
            });
          });
      }
      /*if (!question.hourRefactor) {
                question.hourRefactor = 1;
            }*/
    }
    pendingQuestions = await mongo.db
      .collection('usaboPendingQuestions')
      .find()
      .toArray();
    res.render(VIEWS + 'usabo/train/reviewHomepage.ejs', {
      questions: pendingQuestions,
    });
  });
};
