const mongoose = require("mongoose");
var db = mongoose.connection;

// input a string (the question ID), returns question entry
function getQuestion(Ques, id) {
    return Ques.findById(id).exec();
}

// input a rating range (as floor and ceiling values), returns a range of questions
async function getQuestions (Ques, ratingFloor, ratingCeiling, subject, units) {
    const gotQ = Ques.find({subject: [subject], rating: { $gte: ratingFloor, $lte: ratingCeiling } });
    var tempQ = await gotQ.exec();
    for(i = 0; i < tempQ.length; i++){
        const found = units.some(r => tempQ[i].units.includes(r));
        if(!found){
            tempQ.splice(i, 1);
            i--;
        }
    }
    return tempQ;
}

// return rating of the user logged in right now
function getRating (subject, req) {
    return req.user.rating[subject.toLowerCase()];
}

// set the rating of the user logged in right now
function setRating (subject, newRating, req) {
    req.user.rating[subject.toLowerCase()] = newRating;
    db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { rating: req.user.rating } });
}

// modify the correct/wrong counter for users, and the pass/fail counter for questions, as well as tag collector tags

function updateAll (req, question, correct) {
    updateCounters(req, question, correct);
    updateTracker(req, question);
    updateLastAnswered(req, question);
}
function updateCounters (req, question, correct) {
    if (correct) {
        // update counters
        req.user.stats.correct++;
        question.stats.pass++;
        // update tag collector
        question.tags.forEach((tag) => {
            if(!req.user.stats.collectedTags.includes(tag)) {
                req.user.stats.collectedTags.push(tag);
            }
        });
    } else if (!correct) {
        req.user.stats.wrong++;
        question.stats.fail++;
    }
    db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { stats: req.user.stats } });
    db.collection("questions").findOneAndUpdate({ _id: question._id }, { $set: { stats: { pass: question.stats.pass, fail: question.stats.fail } } });
}
function updateTracker (req, question) {
    // update rating tracker
    var tracker;
    if(req.user.stats.ratingTracker === undefined) {
        req.user.stats.ratingTracker = {};
    }
    try {
        // try to update the tracker
        tracker = req.user.stats.ratingTracker[question.subject[0].toLowerCase()];
        tracker.push(req.user.rating[question.subject[0].toLowerCase()]);
        while(tracker.length > 20) {
            tracker.shift();
        }
    } catch(err) {
        // tracker doesn't exist (yet), so create one!
        tracker = [req.user.rating[question.subject[0].toLowerCase()]];
        req.user.stats.ratingTracker[question.subject[0].toLowerCase()];
    }
    req.user.stats.ratingTracker[question.subject[0].toLowerCase()] = tracker;
    db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { stats: req.user.stats } });
}
function updateLastAnswered (req, question) {
    // updated "last answered" field with question ID
    req.user.stats.lastAnswered = question._id;
    db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { stats: req.user.stats } });
}

// update "to answer" queue field in user db
function updateQuestionQueue (req, subject, id) {
    req.user.stats.toAnswer[subject.toLowerCase()] = id;
    db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { stats: req.user.stats } });
}
function clearQuestionQueue (req, subject) {
    req.user.stats.toAnswer[subject.toLowerCase()] = "";
    db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { stats: req.user.stats } });
}

// things to update when skipping question
async function skipQuestionUpdates(Ques, req, subject, id) {
    
    // deduct 8 rating for skipping
    var originalRating = getRating(subject, req);
    var deduction = originalRating > 8 ? originalRating-8 : 0;
    setRating(subject, deduction, req);

    // update rating tracker
    let q = await getQuestion(Ques, id);
    updateTracker(req, q);

    // add +1 wrong for question and give question one rating
    q.rating += 1;
    q.stats.fail += 1;
    db.collection("questions").findOneAndUpdate({ _id: q._id }, { $set: { stats: q.stats, rating: q.rating } });
}

// set question rating
function setQRating (antsy, newQRate) {
    antsy.rating = newQRate;
    db.collection("questions").findOneAndUpdate({ _id: antsy._id }, { $set: {rating: antsy.rating} });
}

// generate a leaderboard for a certain subject; count is the number of people on board
async function generateLeaderboard (User, count) {

    // NOTE: change the $gte to a higher number once we get more users
    let physics = await User.find({ "rating.physics": { $gte: 500 } }).sort({ "rating.physics": -1 }).limit(count).exec();
    let chem = await User.find({ "rating.chemistry": { $gte: 500 } }).sort({ "rating.chemistry": -1 }).limit(count).exec();
    let bio = await User.find({ "rating.biology": { $gte: 500 } }).sort({ "rating.biology": -1 }).limit(count).exec();

    return { physics, chem, bio };
    
}

async function getDailyQuestion(Daily, Ques) {

    // attempt to get daily object
    const date = await new Date().toISOString().split('T')[0];
    let question = await Daily.findOne({ date }).exec();

    if(question) {

        // if daily object exists
        let content = await Ques.findById(question.question).exec();
        return content;
    } else {

        // if daily object does not exist, create a new one
        const questions = await Ques.find({ rating: { $gte: 2500, $lte: 4000 } }).exec();
        const selection = await questions[Math.floor(Math.random() * questions.length)];

        let question = await new Daily({
            question: selection._id
        })
        await question.save();

        return selection;
    }
}

module.exports = { getQuestion, getQuestions, getRating, setRating, setQRating, updateCounters, updateTracker, updateLastAnswered, updateAll, updateQuestionQueue,
    clearQuestionQueue, skipQuestionUpdates, generateLeaderboard, getDailyQuestion };

