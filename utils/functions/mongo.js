const mongoose = require('mongoose');
const InitiateMongoServer = require('../../database/config/db');
const { userSchema } = require('../../database/models/user');
const { qSchema } = require('../../database/models/question');
const { pendingQSchema } = require('../../database/models/pendingQuestion');
const { dailySchema } = require('../../database/models/daily');
const { siteDataSchema } = require('../../database/models/siteData');
const { classSchema } = require('../../database/models/class');
const { attemptSchema } = require('../../database/models/attempt');
const { usaboQSchema } = require('../../database/models/usaboQuestion');
const {
  usaboPendingQSchema,
} = require('../../database/models/usaboPendingQuestion');

// START MONGO SERVER
const connected = InitiateMongoServer();
// surfaced so index.js can fail fast and tests can await readiness
connected.catch(() => {});
const db = mongoose.connection;
const PORT = process.env.PORT || 3000;
const MongoStore = require('connect-mongo').default;
const Ques = db.model('Ques', qSchema, 'questions');
const PendingQues = db.model('PendingQues', pendingQSchema, 'pendingQuestions');
const USABOQues = db.model('USABOQues', usaboQSchema, 'usaboQuestions');
const USABOPendingQues = db.model(
  'USABOPendingQues',
  usaboPendingQSchema,
  'usaboPendingQuestions',
);
const User = db.model('User', userSchema);
const Daily = db.model('Daily', dailySchema);
const SiteData = db.model('SiteData', siteDataSchema);
const Class = db.model('Class', classSchema);
const Attempt = db.model('Attempt', attemptSchema, 'attempts');

// SESSION COLLECTION
const clientPromise = connected.then(() => db.getClient());
clientPromise.catch(() => {});
const sessionStore = MongoStore.create({
  clientPromise,
  collectionName: 'sessions',
  ttl: 14 * 24 * 60 * 60,
  touchAfter: 24 * 60 * 60,
});

module.exports = {
  db: db,
  PORT: PORT,
  MongoStore: MongoStore,
  Ques,
  PendingQues,
  User,
  Daily,
  SiteData,
  Class,
  Attempt,
  USABOQues,
  USABOPendingQues,
  sessionStore: sessionStore,
  connected,
};
