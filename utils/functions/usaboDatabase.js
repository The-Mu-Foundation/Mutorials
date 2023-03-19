const mongoose = require("mongoose");
const db = mongoose.connection;

const { calculateLevel } = require("./siteAlgorithms");

// input a string (the question ID), returns question entry
function getUSABOQuestion(USABOQues, id) {
    return USABOQues.findById(id).exec();
}

// input a rating range (as floor and ceiling values), returns a range of questions
async function getUSABOQuestions(USABOQues, ratingFloor, ratingCeiling, categories) {
    const gotQ = USABOQues.find({ rating: { $gte: ratingFloor, $lte: ratingCeiling } });
    let tempQ = await gotQ.exec();
    for (i = 0; i < tempQ.length; i++) {
        const found = categories.some(r => tempQ[i].categories.includes(r));
        if (!found) {
            tempQ.splice(i, 1);
            i--;
        }
    }
    return tempQ;
}

module.exports = {
    getUSABOQuestion, getUSABOQuestions
};