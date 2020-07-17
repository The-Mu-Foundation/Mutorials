const mongoose = require("mongoose");
var db = mongoose.connection;

// input a string (the question ID), returns question entry
function getQuestion(Ques, id) {
    return Ques.findById(id).exec();
}

// input a rating range (as floor and ceiling values), returns a range of questions
async function getQuestions(Ques, ratingFloor, ratingCeiling, subject, unitos) {
    const gotQ = Ques.find({subject: [subject], rating: { $gte: ratingFloor, $lte: ratingCeiling } });
    var tempQ = await gotQ.exec();
    for(i = 0; i < tempQ.length; i++){
        const found = unitos.some(r=> tempQ[i].units.includes(r));
        if(!found){
            tempQ.splice(i, 1);
            i--;
        }
    }
    return tempQ;
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

// modify the correct/wrong counter for users, and the pass/fail counter for questions, as well as tag collector tags
function updateCounters(req, question, correct) {

    // update counters
    if (correct) {
        req.user.stats.correct++;
        question.stats.pass++;
    } else if (!correct) {
        req.user.stats.wrong++;
        question.stats.fail++;
    }

    // update tag collector
    if(correct) {
        question.tags.forEach((tag) => {
            if(!req.user.stats.collectedTags.includes(tag)) {
                req.user.stats.collectedTags.push(tag);
            }
        });
    }

    // update rating tracker
    var tracker;

    if(req.user.stats.ratingTracker == undefined) {
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

    // update above results in database
    db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { stats: { correct: req.user.stats.correct, wrong: req.user.stats.wrong, collectedTags: req.user.stats.collectedTags, ratingTracker: req.user.stats.ratingTracker } } });
    db.collection("questions").findOneAndUpdate({ _id: question._id }, { $set: { stats: { pass: question.stats.pass, fail: question.stats.fail } } });
}

function setQRating(antsy, newQRate){
    antsy.rating = newQRate;
    db.collection("questions").findOneAndUpdate({ _id: antsy._id }, { $set: {rating: antsy.rating} });
}

module.exports = { getQuestion : getQuestion, getQuestions : getQuestions, getRating : getRating, setRating : setRating, setQRating: setQRating, updateCounters : updateCounters};