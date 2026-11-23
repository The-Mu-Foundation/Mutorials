// Builds the Express application. Kept separate from index.js (which starts the
// HTTP server) so tests can import the app without opening a port.
const cookieParser = require('cookie-parser');
const express = require('express');
const flash = require('express-flash-messages');
const session = require('express-session');
const path = require('path');

const config = require('./utils/config');
const mongo = require('./utils/functions/mongo.js');
const security = require('./utils/middleware/security');

const app = express();

// correct client IPs and protocol detection behind the hosting proxy
if (config.isProduction) {
  app.set('trust proxy', 1);
}
app.disable('x-powered-by');

app.use(security.enforceHttps);
app.use(security.securityHeaders());
app.use(security.generalLimiter);

app.use(
  session({
    name: 'mutorials.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: mongo.sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: config.sessionMaxAgeMs,
    },
  }),
);

app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(express.json({ limit: '200kb' }));
app.use(security.rejectOperatorInjection);
app.use(security.sameOriginGuard);

require('./utils/functions/passport.js')(app, mongo);

app.use(flash()); // express-flash-messages config
app.use(cookieParser());

app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.locals.successFlash = req.flash('successFlash');
  res.locals.errorFlash = req.flash('errorFlash');
  // per-request (not app-wide) so one user's preference never leaks to another
  res.locals.darkMode = Boolean(req.user && req.user.preferences?.dark_mode);
  res.locals.logUser = req.user;
  next();
});

// ROUTE IMPORTS
require('./routes/public.js')(app, mongo);
require('./routes/private.js')(app, mongo);
require('./routes/admin.js')(app, mongo);
require('./routes/usabo.js')(app, mongo);
require('./routes/class.js')(app, mongo);
require('./routes/contributors.js')(app, mongo);
require('./routes/references.js')(app, mongo);
require('./routes/settings.js')(app, mongo);
require('./routes/stats.js')(app, mongo);
require('./routes/train.js')(app, mongo);
require('./routes/usaboAdmin.js')(app, mongo);
require('./routes/usaboTrain.js')(app, mongo);
require('./routes/reviewers.js')(app, mongo);
require('./routes/ai.js')(app, mongo);

// WILDCARD FOR ALL OTHER ROUTES
app.use((req, res) => {
  if (req.method !== 'GET') {
    return res.status(404).send('Not found.');
  }
  req.flash(
    'errorFlash',
    "Error 404: File Not Found. That page doesn't exist.",
  );
  res.redirect('/');
});

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error(err.stack || err);
  if (req.flash) {
    req.flash(
      'errorFlash',
      'Error 500: Internal Server Error. Something broke on our end, sorry about that.',
    );
  }
  res.redirect('/');
});

module.exports = app;
