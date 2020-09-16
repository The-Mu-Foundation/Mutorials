const mongoose = require("mongoose");

// define question schema
const qSchema = new mongoose.Schema({
    question: String,
    choices: Array,
    tags: Array,
    rating: Number,
    answer: Array,
    answer_ex: String,
    author: String,
    type: String,
    ext_source: String,
    source_statement: String,
    subject: Array,
    units: Array,
    stats: {
        pass: Number,
        fail: Number
    }
});

module.exports = { qSchema : qSchema };