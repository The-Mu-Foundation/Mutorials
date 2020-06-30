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

module.exports = { getQuestion : getQuestion, getQuestions : getQuestions, getRating : getRating, setRating : setRating };