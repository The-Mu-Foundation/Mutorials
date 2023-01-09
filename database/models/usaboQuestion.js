const mongoose = require("mongoose");

// define question schema
const usaboQSchema = new mongoose.Schema({
    question: String,
    choices: Array,
    rating: Number,
    answer: Array,
    answer_ex: String,
    author: String,
    type: String,
    problemNumber: String,
    round: Array,
    categories: Array,
    year: Number,
    stats: {
        pass: Number,
        fail: Number
    },
    reviewers: Array,
    writtenDate: {
        type: String,
        default: new Date().toISOString().split('T')[0]
    }
});

module.exports = { usaboQSchema };