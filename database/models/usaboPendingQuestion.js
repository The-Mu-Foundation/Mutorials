const mongoose = require("mongoose");

// define question schema
const usaboPendingQSchema = new mongoose.Schema({
    subject: {
        type: Array,
        default: ['USABO']
    },
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
    reviewers: Array,
    year: Number,
    writtenDate: {
        type: String,
        default: new Date().toISOString().split('T')[0]
    }
});

module.exports = { usaboPendingQSchema };