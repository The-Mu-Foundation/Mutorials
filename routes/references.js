// FUNCTION IMPORTS
const { referenceSheet } = require('../utils/constants/referencesheet');
const { tags } = require('../utils/constants/tags');

const VIEWS = __dirname + '/../views/';

module.exports = (app, mongo) => {
    app.all(/^(\/references).*$/, (req, res, next) => {
        if (req.isAuthenticated()) {
            next()
        } else {
            req.flash('errorFlash', 'Error 401: Unauthorized. You need to login to see this page.');
            res.redirect('/');
        }
    });

    app.get('/references', (req, res) => {
        res.render(VIEWS + 'private/references/home.ejs', { pageName: "Mutorials References" });
    });

    app.get('/references/equations', (req, res) => {
        res.render(VIEWS + 'private/references/equations.ejs', { equations: referenceSheet.equations, pageName: "Mutorials Equation Sheet" });
    });

    app.get('/references/constants', (req, res) => {
        res.render(VIEWS + 'private/references/constants.ejs', { constants: referenceSheet.constants, pageName: "Mutorials Constant Sheet" });
    });

    app.get('/references/taglist', (req, res) => {
        res.render(VIEWS + 'private/references/taglist.ejs', { tags: tags, pageName: "Mutorials Tags" });
    });

    app.get('/references/about', (req, res) => {
        res.render(VIEWS + 'private/references/about.ejs', { pageName: "About Mutorials" });
    });
}
