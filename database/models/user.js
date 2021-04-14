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
        yob: Number, //used to be age
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
        },
        rush: {
            highscore: Number,
            attempts: Number
        },
        units: Object
    },
    email_confirm_code: String,
    rating: {
        physics: Number,
        chemistry: Number,
        biology: Number
    },
    // first index is phys, then chem, then bio; fourth index is 1/0 for proficiency
    preferences: {
        dark_mode: Boolean,
        hideProfile: Boolean
    },
    classes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    }],
    teachingClasses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    }],
    contributor: {
        type: String,
        default: ""
    }
});

module.exports = { userSchema };
