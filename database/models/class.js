const mongoose = require("mongoose");

const classSchema = new mongoose.Schema({
    name: String,
    school: String,
    city: String,
    classCode: String
});

module.exports = { classSchema };
