const mongoose = require("mongoose");

// define user schema
const userSchema = new mongoose.Schema({
    username: String,
    ign: String,
    hash: String,
    salt: String,
    profile: {
        name: String,
        location: String,
        age: String,
        bio: String
    },
    stats: {
        correct: Number,
        wrong: Number,
        collectedTags: Array,
        ratingTracker: {
            physics: Array,
            chemistry: Array,
            biology: Array
        }
    },
    rating: {
        physics: Number,
        chemistry: Number,
        biology: Number
    }
    // first index is phys, then chem, then bio; fourth index is 1/0 for proficiency
});

module.exports = { userSchema : userSchema };