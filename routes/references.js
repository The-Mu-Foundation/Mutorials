// FUNCTION IMPORTS
const { referenceSheet } = require('../utils/constants/referencesheet');

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
    app.get('/references', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/home.ejs', { pageName: "Mutorials References" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/references/equations', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/equations.ejs', { equations: referenceSheet.equations, pageName: "Mutorials Equation Sheet" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/references/constants', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/constants.ejs', { constants: referenceSheet.constants, pageName: "Mutorials Constant Sheet" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/references/taglist', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/taglist.ejs', { tags: tags, pageName: "Mutorials Tags" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/references/about', (req, res) => {
        if (req.isAuthenticated()) {
            res.render(VIEWS + 'private/references/about.ejs', { pageName: "About Mutorials" });
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });
}
