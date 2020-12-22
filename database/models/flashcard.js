const mongoose = require("mongoose");

// define user schema
const flashcardSchema = new mongoose.Schema({
    name: String,
    date: {
        type: String,
        default: new Date().toISOString()
    },
    creator: mongoose.Schema.Types.ObjectId,
    views: Number,
    tags: [ String ],
    cards: [
        {
            front: String,
            back: String
        }
    ]
});

module.exports = { flashcardSchema };

