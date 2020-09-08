// MODULE IMPORTS
const bodyParser = require('body-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const express = require('express');
var flash = require('express-flash-messages');
const session = require('express-session');
const emailValidation = require('./utils/functions/emailValidation');
const http = require('http');
const https = require('https');
var enforce = require('express-sslify');

// START EXPRESS SERVER
const app = express();
const PORT = process.env.PORT || 3000;

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
    app.use(sslRedirect(['production'], 301));
}

var mongo = require('./utils/functions/mongo.js');

app.use(session({
    secret: 'blahblah',
    resave: false,
    saveUninitialized: true,
    store: mongo.sessionStore
}));

require('./utils/functions/passport.js')(app, mongo);

app.use(flash()); // express-flash-messages config
app.use(function (req, res, next) {
    res.locals.successFlash = req.flash('successFlash');
    res.locals.errorFlash = req.flash('errorFlash');
    next();
});

// ROUTE IMPORTS
require('./routes/public.js')(app, mongo);
require('./routes/private.js')(app, mongo);
require('./routes/admin.js')(app, mongo);

// WILDCARD FOR ALL OTHER ROUTES
app.get('*', (req, res) => {
    res.redirect('/');
});

// START http AND https SERVERS
http.createServer(app).listen(PORT, function() {
    console.log('Express server listening on port ' + PORT);
});

