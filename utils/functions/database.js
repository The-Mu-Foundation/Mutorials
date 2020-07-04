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
function setRating(subject, newRating, req, correct) {
    req.user.rating[subject.toLowerCase()] = newRating;
    if (correct) {
        req.user.correct++;
    } else if (!correct) {
        req.user.wrong++;
    }
    db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { rating: req.user.rating, correct: req.user.correct, wrong: req.user.wrong } });
    //universal code for updating ratings
}

function setQRating(antsy, db, newQRate){
    antsy.rating = newQRate;
    db.collection("questions").findOneAndUpdate({ _id: antsy._id }, { $set: {rating: antsy.rating} });
}
module.exports = { getQuestion : getQuestion, getQuestions : getQuestions, getRating : getRating, setRating : setRating, setQRating: setQRating };