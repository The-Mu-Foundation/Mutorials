const mongoose = require("mongoose");

// define user schema
const userSchema = new mongoose.Schema({
    username: String, //email address
    ign: String, //username
    hash: String,
    salt: String,
    external_acc: Boolean,
    external_id: Number,
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
    },
    achievements: {
        join_mutorials: Boolean,
        rating_beginner: Boolean,
        rating_intermediate: Boolean,
        rating_advanced: Boolean,
        rating_expert: Boolean,
        first_physics: Boolean,
        first_chemistry: Boolean,
        first_biology: Boolean,
        rush_10: Boolean,
        rush_20: Boolean,
        solves_300: Boolean,
        solves_500: Boolean,
        tags_20: Boolean,
        tags_50: Boolean,
        tags_100: Boolean,
        tags_180: Boolean
    }
});

module.exports = { userSchema };
