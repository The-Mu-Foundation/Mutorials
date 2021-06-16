const mongoose = require('mongoose');
const session = require('express-session');
const InitiateMongoServer = require('../../database/config/db');
const { userSchema } = require('../../database/models/user');
const { qSchema } = require('../../database/models/question');
const { pendingQSchema } = require('../../database/models/pendingQuestion');
const { dailySchema } = require('../../database/models/daily');
const { siteDataSchema } = require('../../database/models/siteData');
const { classSchema } = require('../../database/models/class')

// START MONGO SERVER
InitiateMongoServer();
const db = mongoose.connection;
const PORT = process.env.PORT || 3000;
const MongoStore = require('connect-mongo')(session);
const Ques = db.model('Ques', qSchema, 'questions');
const PendingQues = db.model('PendingQues', pendingQSchema, 'pendingQuestions');
const User = db.model('User', userSchema);
const Daily = db.model('Daily', dailySchema);
const SiteData = db.model('SiteData', siteDataSchema);
const Class = db.model('Class', classSchema)

// SESSION COLLECTION
const sessionStore = new MongoStore({ mongooseConnection: db, collection: 'sessions' });

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
    sessionStore: sessionStore
}

