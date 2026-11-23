// LIBRARY IMPORTS
const { nanoid } = require('nanoid');

// FUNCTION IMPORTS
const { toObjectId } = require('../utils/functions/ids');
const { asString, wrap } = require('../utils/functions/http');

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
  app.all(/^(\/class).*$/, (req, res, next) => {
    if (req.isAuthenticated()) {
      next();
    } else {
      req.flash(
        'errorFlash',
        'Error 401: Unauthorized. You need to login to see this page.',
      );
      res.redirect('/');
    }
  });

  // true if the signed-in user teaches the class with this ObjectId
  const teachesClass = (req, classId) =>
    Boolean(classId) &&
    req.user.teachingClasses.some((id) => String(id) === String(classId));

  const notFound = (req, res) => {
    req.flash('errorFlash', 'Error 404: Class not found.');
    res.redirect('/');
  };

  app.post(
    '/class/verifyClassCode',
    wrap(async (req, res) => {
      const classCode = asString(req.body.classCode).trim();
      if (!classCode) {
        req.flash('errorFlash', 'Please enter a code.');
        return res.redirect('/class/join');
      }
      req.session.classCode = classCode;
      const found = await mongo.Class.findOne({ classCode }).lean();
      if (found) {
        req.session.currentClass = found;
      } else {
        req.flash('errorFlash', "There isn't a class with that code.");
      }
      res.redirect('/class/join');
    }),
  );

  app.post(
    '/class/joinClass',
    wrap(async (req, res) => {
      const found = await mongo.Class.findOne({
        classCode: asString(req.body.classCode).trim(),
      }).lean();
      if (!found) {
        req.flash('errorFlash', "There isn't a class with that code.");
        return res.redirect('/class/join');
      }
      await mongo.User.updateOne(
        { _id: req.user._id },
        { $addToSet: { classes: found._id } },
      );
      req.flash(
        'successFlash',
        "You've successfully been added to " + found.name + '.',
      );
      res.redirect('/');
    }),
  );

  app.post(
    '/class/createClass',
    wrap(async (req, res) => {
      const name = asString(req.body.name).trim().slice(0, 100);
      if (!name) {
        req.flash('errorFlash', 'Please name your class.');
        return res.redirect('/class/create');
      }
      const existing = await mongo.Class.findOne({
        name,
        teacher: req.user.ign,
      }).lean();
      if (existing) {
        req.flash('errorFlash', 'You already have a class with that name.');
        return res.redirect('/');
      }
      const newClass = await new mongo.Class({
        name,
        teacher: req.user.ign,
        school: asString(req.body.school).trim().slice(0, 100),
        city: asString(req.body.city).trim().slice(0, 100),
        classCode: nanoid(8),
      }).save();
      await mongo.User.updateOne(
        { _id: req.user._id },
        { $push: { teachingClasses: newClass._id } },
      );
      req.flash('successFlash', 'We successfully created class ' + name + '.');
      res.redirect('/class/dash');
    }),
  );

  app.post(
    '/class/generateNewClassCode',
    wrap(async (req, res) => {
      const classId = toObjectId(req.body.classId);
      if (!teachesClass(req, classId)) return notFound(req, res);
      const newClassCode = nanoid(8);
      await mongo.Class.updateOne(
        { _id: classId },
        { $set: { classCode: newClassCode } },
      );
      req.flash('successFlash', 'New class code generated.');
      res.redirect('/class/manage/' + newClassCode);
    }),
  );

  app.post(
    '/class/leave',
    wrap(async (req, res) => {
      const classId = toObjectId(req.body.classId);
      if (classId) {
        await mongo.User.updateOne(
          { _id: req.user._id },
          { $pull: { classes: classId } },
        );
      }
      req.flash(
        'successFlash',
        "You've left " + asString(req.body.className).slice(0, 100) + '.',
      );
      res.redirect('/');
    }),
  );

  // only the teacher of a class may remove a student from it
  app.post(
    '/class/removeStudent',
    wrap(async (req, res) => {
      const classId = toObjectId(req.body.classId);
      if (!teachesClass(req, classId)) {
        return res.status(403).json({ status: 'Forbidden' });
      }
      await mongo.User.updateOne(
        { ign: asString(req.body.ign) },
        { $pull: { classes: classId } },
      );
      res.json({ status: 'Success' });
    }),
  );

  app.post(
    '/class/delete',
    wrap(async (req, res) => {
      const classId = toObjectId(req.body.classId);
      if (!teachesClass(req, classId)) return notFound(req, res);
      const doomed = await mongo.Class.findById(classId).lean();
      await mongo.Class.deleteOne({ _id: classId });
      await mongo.User.updateMany(
        { $or: [{ classes: classId }, { teachingClasses: classId }] },
        { $pull: { classes: classId, teachingClasses: classId } },
      );
      req.flash(
        'successFlash',
        'Class ' + (doomed ? doomed.name : '') + ' has been deleted.',
      );
      res.redirect('/');
    }),
  );

  app.get('/class/join', (req, res) => {
    res.locals.classCode = req.session.classCode;
    res.locals.currentClass = req.session.currentClass;
    req.session.classCode = null;
    req.session.currentClass = null;
    res.render(VIEWS + 'private/class/join.ejs');
  });

  app.get('/class/create', (req, res) => {
    res.render(VIEWS + 'private/class/create.ejs', { name: req.user.ign });
  });

  app.get(
    '/class/dash',
    wrap(async (req, res) => {
      const user = await mongo.User.findById(req.user._id)
        .populate('teachingClasses')
        .populate('classes')
        .exec();
      res.render(VIEWS + 'private/class/dash.ejs', {
        classes: user.classes,
        teachingClasses: user.teachingClasses,
      });
    }),
  );

  app.get(
    '/class/manage/:classCode',
    wrap(async (req, res) => {
      const currentClass = await mongo.Class.findOne({
        classCode: asString(req.params.classCode),
      }).lean();
      if (!currentClass || !teachesClass(req, currentClass._id)) {
        return notFound(req, res);
      }
      const students = await mongo.User.find({
        classes: currentClass._id,
      }).exec();
      if (students.length === 0) {
        req.flash('errorFlash', "There aren't any students in your class yet.");
      }
      // average only over students who have actually rated that subject
      const average = (subject) => {
        const ratings = students
          .map((s) => s.rating[subject])
          .filter((r) => Number.isFinite(r) && r !== -1);
        return ratings.length
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : 0;
      };
      res.render(VIEWS + 'private/class/details.ejs', {
        currentClass,
        students,
        physicsAvg: average('physics'),
        chemistryAvg: average('chemistry'),
        biologyAvg: average('biology'),
      });
    }),
  );
};
