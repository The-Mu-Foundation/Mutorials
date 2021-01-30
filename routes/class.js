// LIBRARY IMPORTS

import { nanoid } from 'nanoid';

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
    app.post('/private/class/verifyClassCode', (req, res, next) => {
        if (req.isAuthenticated()) {
            if (!req.body.classCode != req.body.classCode == "") {
                req.flash('errorFlash', 'Please enter a code.');
            } else {
                res.local.classCode = req.body.classCode;
                mongo.Class.findOne({ classCode: classCode }, async (err, obj) => {
                    if (obj) {
                        res.local.name = obj.name;
                        res.local.teacher = obj.teacher;
                        res.local.school = obj.school;
                        res.local.city = obj.city;
                    } else {
                        res.flash('errorFlash', 'There isn\'t a class with that code.');
                    }
                    res.redirect('/private/class/join');
                });
            }
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.')
        }
    });
    app.post('/private/class/joinClass', (req, res, next) => {
        if (req.isAuthenticated()) {
            // TODO: this isn't actually good
            // because it just overwrites the class list
            // which is *bad*
            mongo.Users.findOneAndUpdate({ _id: req.user._id  }, { $set: { classes: [req.body._id] } });
            req.flash('successFlash', 'You\'ve successfully been added to ' + req.body.name + '.');
            res.redirect('/');
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.')
        }
    });

    app.post('/private/class/createClass', (req, res, next) => {
        if (req.isAuthenticated()) {
            const newClass = new mongo.Class({
                name: req.body.name,
                school: req.body.school,
                teacher: req.user.ign,
                city: req.user.city,
                classCode: nanoid(12)
            });
            newClass.save();
            mongo.Users.findOneAndUpdate({ _id: req.user._id }, { $set: { teaching_classes: [req.body._id] } });
            req.flash('successFlash', 'We successfully created class ' + req.body.name + '.');
            res.redirect('/')
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.')
        }
    });

    app.get('/private/class/join', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/class/join.ejs', { name: req.user.ign });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.')
        }
    });

    app.get('/private/class/create', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/class/create.ejs');
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.')
        }
    });
}

