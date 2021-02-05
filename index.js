// MODULE IMPORTS
const bodyParser = require('body-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const express = require('express');
var flash = require('express-flash-messages');
const session = require('express-session');
const http = require('http');
const https = require('https');
var enforce = require('express-sslify');
const emailValidation = require('./utils/functions/emailValidation');

// START EXPRESS SERVER
const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'devsecret';

// https SETUP
const httpsConfig = {
    cert: process.env.SSL_CRT,
    ca: process.env.SSL_CA_BUNDLE,
    key: process.env.SSL_KEY,
    passphrase: process.env.SSL_PASSPHRASE
};
const httpServer = http.createServer(app);
const httpsServer = https.createServer(httpsConfig, app);

if (PORT != 3000) {
    app.use(enforce.HTTPS({trustProtoHeader: true }));
}

var mongo = require('./utils/functions/mongo.js');

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: mongo.sessionStore
}));

require('./utils/functions/passport.js')(app, mongo);

app.use(flash()); // express-flash-messages config

app.use((req, res, next) => {
    res.locals.successFlash = req.flash('successFlash');
    res.locals.errorFlash = req.flash('errorFlash');
    if (req.user) {
        app.locals.darkMode = req.user.preferences.dark_mode || false;
    } else {
        app.locals.darkMode = false;
    }
    res.locals.logUser = req.user;
    next();
});

// ROUTE IMPORTS
require('./routes/public.js')(app, mongo);
require('./routes/private.js')(app, mongo);
require('./routes/admin.js')(app, mongo);
require('./routes/class.js')(app, mongo);

// WILDCARD FOR ALL OTHER ROUTES
app.get('*', (req, res) => {
    req.flash('errorFlash', 'Error 404: File Not Found. That page doesn\'t exist.');
    res.redirect('/');
});

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
    if (res.headersSent) {
        console.log('yes');
        return next(err);
    }
    console.error(err.stack);
    req.flash('errorFlash', 'Error 500: Internal Server Error. Something broke on our end, sorry about that.');
    res.redirect('/');
});

// START http AND https SERVERS
http.createServer(app).listen(PORT, function() {
    console.log('Express server listening on port ' + PORT);
});

