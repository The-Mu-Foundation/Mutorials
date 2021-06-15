// LIBRARY IMPORTS
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
    app.all(/^(\/class).*$/, (req, res, next) => {
        if (req.isAuthenticated()) {
            next()
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.post('/class/verifyClassCode', (req, res, next) => {
        if (!req.body.classCode != req.body.classCode == "") {
            req.flash('errorFlash', 'Please enter a code.');
            res.redirect('/class/join');
        } else {
            req.session.classCode = req.body.classCode;
            mongo.db.collection('classes').findOne({ classCode: req.body.classCode }, async (err, obj) => {
                if (obj) {
                    req.session.currentClass = obj;
                } else {
                    req.flash('errorFlash', 'There isn\'t a class with that code.');
                }
                res.redirect('/class/join');
            });
        }
    });

    app.post('/class/joinClass', (req, res, next) => {
        mongo.db.collection('classes').findOne({ classCode: req.body.classCode }, async (err, obj) => {
            mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id  }, { $addToSet: { classes: obj._id } });
            req.flash('successFlash', 'You\'ve successfully been added to ' + req.body.name + '.');
            res.redirect('/');
        });
    });

    app.post('/class/createClass', (req, res, next) => {
        mongo.Class.findOne({ $and: [{ name: req.body.name }, { teacher: req.user.ign }] }).then((currentClass) => {
            if (currentClass) {
                req.flash('errorFlash', 'You already have a class with that name.');
                res.redirect('/');
            } else {
                const newClass = new mongo.Class({
                    name: req.body.name,
                    school: req.body.school,
                    city: req.body.city,
                    classCode: nanoid(8)
                });
                newClass.save();
                mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $push: { teachingClasses: newClass._id } });
                req.flash('successFlash', 'We successfully created class ' + req.body.name + '.');
                res.redirect('/class/dash');
            }
        });
    });

    app.post('/class/generateNewClassCode', (req, res, next) => {
        mongo.User.findOne({ $and: [{ _id: req.user._id }, { teachingClasses: req.body.classId }] }).then(async (teacher) => {
            if (teacher) {
                let newClassCode = nanoid(8);
                console.log(newClassCode);
                reqClassId = mongoose.Types.ObjectId(req.body.classId);
                mongo.db.collection('classes').findOneAndUpdate({ _id: reqClassId }, { $set: { classCode: newClassCode } }, { new: true }).then((err, currentClass) => {
                    req.flash('successFlash', 'New class code generated.');
                    res.redirect('/class/manage/' + newClassCode);
                });
            } else {
                req.flash('errorFlash', 'Error 404: Class not found.');
                res.redirect('/');
            }
        });
    });

    app.post('/class/leave', (req, res, next) => {
        reqClassId = mongoose.Types.ObjectId(req.body.classId);
        mongo.User.findOneAndUpdate({ _id: req.user._id }, { $pull: { classes: { $in: [reqClassId] } } }).then((err, students) => {
            req.flash('successFlash', 'You\'ve left ' + req.body.className + '.');
            res.redirect('/');
        });
    });

    app.post('/class/removeStudent', (req, res, next) => {
        reqClassId = mongoose.Types.ObjectId(req.body.classId);
        console.log(req.body.ign);
        mongo.User.findOneAndUpdate({ ign: req.body.ign }, { $pull: { classes: { $in: [reqClassId] } } }).then((err, students) => {
            res.json({ status: "Success" });
        });
    });

    app.post('/class/delete', (req, res, next) => {
        reqClassId = mongoose.Types.ObjectId(req.body.classId);
        mongo.User.findOne({ $and: [{ _id: req.user._id }, { teachingClasses: reqClassId }] }).then(async (teacher) => {
            if (teacher) {
                console.log(reqClassId);
                mongo.Class.deleteOne({ _id: reqClassId }).then((err, deletedClass) => {
                    console.log(deletedClass);
                    mongo.User.updateMany({}, { $pull: { classes: { $in: [reqClassId] } } }).then((err, students) => {
                        mongo.User.updateMany({}, { $pull: { teachingClasses: { $in: [reqClassId] } } }).then((err, teachers) => {
                            req.flash('successFlash', 'Class ' + req.body.className + ' has been deleted.');
                            res.redirect('/');
                        });
                    });
                });
            } else {
                req.flash('errorFlash', 'Error 404: Class not found.');
                res.redirect('/');
            }
        });
    });

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

    app.get('/class/dash', (req, res) => {
        mongo.User.findOne({ _id: req.user._id }).populate('teachingClasses').populate('classes').then(user => {
            res.render(VIEWS + 'private/class/dash.ejs', { classes: user.classes, teachingClasses: user.teachingClasses });
        });
    });

    app.get('/class/manage/:classCode', (req, res) => {
        if (req.params.classCode) {
            mongo.db.collection('classes').findOne({ classCode: req.params.classCode }).then((currentClass) => {
                if (currentClass) {
                    mongo.User.findOne({ teachingClasses: currentClass._id }).then((teacher) => {
                        if (teacher.ign == req.user.ign) {
                            mongo.User.find({ classes: currentClass._id }).then((students) => {
                                let physicsAvg = 0, chemistryAvg = 0, biologyAvg = 0;
                                if (!students || (students.length == 0)) {
                                    req.flash('errorFlash', 'There aren\'t any students in your class yet.');
                                } else {
                                    // calculate averages
                                    // students is just a list of users
                                    if (students.length != 0) {
                                        students.forEach((student, studentIndex) => {
                                            if (student.rating.physics != -1) {
                                                physicsAvg += student.rating.physics;
                                            }
                                            if (student.rating.chemistry != -1) {
                                                chemistryAvg += student.rating.chemistry;
                                            }
                                            if (student.rating.chemistry != -1) {
                                                biologyAvg += student.rating.biology + 1;
                                            }
                                        });
                                        physicsAvg = physicsAvg / students.length;
                                        chemistryAvg = chemistryAvg / students.length;
                                        biologyAvg = biologyAvg / students.length;
                                    }
                                }
                                res.render(VIEWS + 'private/class/details.ejs', {
                                    currentClass: currentClass,
                                    students: students,
                                    physicsAvg: physicsAvg,
                                    chemistryAvg: chemistryAvg,
                                    biologyAvg: biologyAvg
                                });
                            });
                        } else {
                            req.flash('errorFlash', 'Error 404: Class not found.');
                            res.redirect('/');
                        }
                    });
                } else {
                    req.flash('errorFlash', 'Error 404: Class not found.');
                    res.redirect('/');
                }
            });
        } else {
            req.flash('errorFlash', 'That URL doesn\'t contain a class code.');
            res.redirect('/');
        }
    });
}

