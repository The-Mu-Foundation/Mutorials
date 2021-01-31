// LIBRARY IMPORTS
const { nanoid } = require('nanoid');

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
    app.post('/class/verifyClassCode', (req, res, next) => {
        if (req.isAuthenticated()) {
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
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });
    app.post('/class/joinClass', (req, res, next) => {
        if (req.isAuthenticated()) {
            mongo.db.collection('classes').findOne({ classCode: req.body.classCode }, async (err, obj) => {
                mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id  }, { $push: { classes: obj._id } });
                req.flash('successFlash', 'You\'ve successfully been added to ' + req.body.name + '.');
                res.redirect('/');
            });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.post('/class/createClass', (req, res, next) => {
        if (req.isAuthenticated()) {
            const newClass = new mongo.Class({
                name: req.body.name,
                school: req.body.school,
                teacher: req.user.ign,
                city: req.body.city,
                classCode: nanoid(12)
            });
            newClass.save();
            mongo.db.collection('users').findOneAndUpdate({ _id: req.user._id }, { $push: { teachingClasses: newClass._id } });
            req.flash('successFlash', 'We successfully created class ' + req.body.name + '.');
            res.redirect('/')
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.post('/class/getDetails', (req, res, next) => {
        res.redirect('/');
    });


    app.get('/class/join', (req, res) => {
        if (req.isAuthenticated()) {
            res.locals.classCode = req.session.classCode;
            res.locals.currentClass = req.session.currentClass;
            req.session.classCode = null;
            req.session.currentClass = null;
            res.render(VIEWS + 'private/class/join.ejs');
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/class/create', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/class/create.ejs', { name: req.user.ign });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/class/dash', (req, res) => {
        if (req.isAuthenticated()) {
            console.log(req.user.teachingClasses);
            mongo.User.findOne({ _id: req.user._id }).populate('classes').then(teacher => {
                console.log(teacher);
                res.render(VIEWS + 'private/class/dash.ejs', { teachingClasses: teacher.teachingClasses });
            });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/class/details', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/class/details.ejs');
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });
}

