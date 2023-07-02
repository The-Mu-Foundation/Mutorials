// FUNCTION IMPORTS
const { tags } = require('../utils/constants/tags');
const { subjectUnitDictionary } = require('../utils/constants/subjects');
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

const VIEWS = '../views/';

module.exports = (app, mongo) => {
  app.all(/^(\/admin).*$/, (req, res, next) => {
    if (req.isAuthenticated() && adminList.includes(req.user.username)) {
      next();
    } else if (
      req.isAuthenticated() &&
      !adminList.includes(req.user.username)
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

  // ADMIN GET ROUTES
  app.get('/admin/usaboAdminHomepage', (req, res) => {
    c = req.cookies['skipQuestions'];
    if (!c) {
      c = [];
    } else {
      c = c.map(mongoose.Types.ObjectId);
    }
    mongo.db
      .collection('usaboPendingQuestions')
      .countDocuments({
        $and: [
          { reviewers: { $ne: req.user.contributor } },
          { $id: { $nin: c } },
        ],
      })
      .then((numUser, err) => {
        if (err) {
          console.log(1, err);
        } else {
          mongo.db
            .collection('usaboPendingQuestions')
            .countDocuments({ question: /.*/ }, (err, numAll) => {
              if (err) {
                console.log(2, err);
              }
              res.render(VIEWS + 'usabo/adminHomepage.ejs', {
                numUser,
                numAll,
              });
            });
        }
      });
  });

  app.get('/admin/addUSABOquestion', (_, res) => {
    res.render(VIEWS + 'usabo/contributorAddQuestion.ejs', {
      pageName: 'ADMIN Add USABO Question',
    });
  });

  // DATA ROUTE: Get USABO question stats
  app.get('/admin/usaboQuestionStats', async (req, res) => {
    let allQuestions = await mongo.db
      .collection('usaboQuestions')
      .find()
      .toArray();

    // Compute some properties
    let yearDist = {}; // Distribution of questions across years
    for (let question of allQuestions) {
      const { year, round } = question;
      if (!yearDist[year]) yearDist[year] = { semis: 0, open: 0 };
      yearDist[year][round]++;
    }

    res.json({ yearDist: Object.entries(yearDist) });
  });

  // Master list of questions
  app.get('/admin/allUSABOQuestions', async (req, res) => {
    let tempQuestions = await mongo.db
      .collection('questions')
      .find({ subject: 'USABO' })
      .toArray();
    /*let allQuestions = await mongo.db.collection('usaboQuestions').find().toArray();
        for (let i = 0; i < allQuestions.length; i++){
            allQuestions[i].hourRefactor = 1;
        }*/

    allQuestions = await mongo.db.collection('usaboQuestions').find().toArray();
    res.render(VIEWS + 'usabo/train/allQuestions.ejs', {
      questions: allQuestions,
      leftToTransfer: tempQuestions.length,
    });
  });

  app.get('/admin/editUSABOQuestion', async (req, res) => {
    mongo.db
      .collection('usaboQuestions')
      .findOne({ _id: mongoose.Types.ObjectId(req.query.id) })
      .then((question, err) => {
        if (!err) {
          res.render(VIEWS + 'usabo/train/editQuestion.ejs', {
            isReview: false,
            question: question,
            pageName: 'ADMIN Edit Question',
          });
        } else {
          req.flash('errorFlash', 'Question not found.');
          res.redirect('/usaboHomepage');
        }
      });
  });

  app.get('/admin/transfer', async (req, res) => {
    const tempQuestions = await mongo.db
      .collection('questions')
      .find({ subject: ['USABO'] })
      .toArray();
    for (let i = 0; i < Math.min(20, tempQuestions.length); i++) {
      let question = tempQuestions[i];

      // Extract units from "USABO - " format
      question.units = question.units.map((unit) => {
        const unitMatch = unit.match(/USABO - (.+)/);
        return unitMatch ? unitMatch[1] : unit;
      });

      // Grab necessary USABO attributes--more robust
      let year, problemNumber;
      let yearIdx;
      question.tags.forEach((tag, i) => {
        // Match year?
        if (tag.match(/\d{4}/)) {
          year = parseInt(tag);
          yearIdx = i;
        }

        // Match problem number?
        const problemNumberMatch = tag.match(/Problem: (\d+)/);
        if (problemNumberMatch) problemNumber = problemNumberMatch[1];
      });

      let newQ = new mongo.USABOQues({
        question: question.question,
        choices: question.choices,
        rating: question.rating,
        answer: question.answer,
        answer_ex: question.answer_ex,
        author: question.author,
        type: question.type,
        categories: question.units,
        year,
        problemNumber,
        round: question.tags[yearIdx + 2],
        stats: question.stats,
        writtenDate: question.writtenDate,
        subject: ['USABO'],
        reviewers: question.reviewers,
        hourRefactor: question.hourRefactor,
      });

      newQ.save();
      mongo.db.collection('questions').deleteOne({ _id: question._id });
    }
    res.redirect('/admin/allUSABOQuestions');
  });
};
