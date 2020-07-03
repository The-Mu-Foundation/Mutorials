const mongoose = require("mongoose");
var db = mongoose.connection;

// input a string (the question ID), returns question entry
function getQuestion(Ques, id) {
    return Ques.findById(id).exec();
}

// input a rating range (as floor and ceiling values), returns a range of questions
function getQuestions(Ques, ratingFloor, ratingCeiling, subject, units) {
    const gotQ = Ques.find({ units: units, subject: [subject], rating: { $gte: ratingFloor, $lte: ratingCeiling } });
    return gotQ.exec();
}

// return rating of the user logged in right now
function getRating(subject, req) {
    const rate = req.user.rating[subject.toLowerCase()];
    return rate;
}

// set the rating of the user logged in right now
function setRating(subject, newRating, req) {
    req.user.rating[subject.toLowerCase()] = newRating;
    db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { rating: req.user.rating, correct: req.user.correct, wrong: req.user.wrong } });
}

// modify the correct/wrong counter for users, and the pass/fail counter for questions
function updateCounters(req, question, correct) {
    if (correct) {
        req.user.stats.correct++;
        question.stats.pass++;
    } else if (!correct) {
        req.user.stats.wrong++;
        question.stats.fail++;
    }
    db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { stats: { correct: req.user.stats.correct, wrong: req.user.stats.wrong } } });
    db.collection("questions").findOneAndUpdate({ _id: question._id }, { $set: { stats: { pass: question.stats.pass, fail: question.stats.fail } } });
}

function setQRating(antsy, db, newQRate){
    antsy.rating = newQRate;
    db.collection("questions").findOneAndUpdate({ _id: antsy._id }, { $set: {rating: antsy.rating} });
}
module.exports = { getQuestion : getQuestion, getQuestions : getQuestions, getRating : getRating, setRating : setRating, setQRating: setQRating, updateCounters : updateCounters };