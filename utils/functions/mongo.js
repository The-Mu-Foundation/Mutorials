const mongoose = require('mongoose');
const session = require('express-session');
const InitiateMongoServer = require('../../database/config/db');
const { userSchema } = require('../../database/models/user');
const { qSchema } = require('../../database/models/question');
const { dailySchema } = require('../../database/models/daily');

// START MONGO SERVER
InitiateMongoServer();
var db = mongoose.connection;
const PORT = process.env.PORT || 3000;
const MongoStore = require('connect-mongo')(session);
const Ques = db.model('Ques', qSchema, 'questions');
const User = db.model('User', userSchema);
const Daily = db.model('Daily', dailySchema);

// SESSION COLLECTION
const sessionStore = new MongoStore({ mongooseConnection: db, collection: 'sessions' });

module.exports = {
    db: db,
    PORT: PORT,
    MongoStore: MongoStore,
    Ques: Ques,
    User: User,
    Daily: Daily,
    sessionStore: sessionStore
}

