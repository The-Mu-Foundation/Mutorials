const mongoose = require("mongoose");

// define user schema
const userSchema = new mongoose.Schema({
    username: String,
    ign: String,
    hash: String,
    salt: String,
    correct: Number,
    wrong: Number,
    rating: {
        physics: Number,
        chemistry: Number,
        biology: Number,
        physicsRate: Number,
        chemistryRate: Number,
        biologyRate: Number
    }
    // first index is phys, then chem, then bio; fourth index is 1/0 for proficiency
});

module.exports = { userSchema : userSchema };