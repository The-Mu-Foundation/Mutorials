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
        experience: Number,
        correct: Number,
        wrong: Number,
        collectedTags: Array,
        lastAnswered: String,
        toAnswer: {
            physics: String,
            chemistry: String,
            biology: String
        },
        ratingTracker: {
            physics: Array,
            chemistry: Array,
            biology: Array
        }
    },
    email_confirm_code: String,
    rating: {
        physics: Number,
        chemistry: Number,
        biology: Number
    },
    // first index is phys, then chem, then bio; fourth index is 1/0 for proficiency
    preferences: {
        dark_mode: Boolean
    }
});

module.exports = { userSchema : userSchema };
