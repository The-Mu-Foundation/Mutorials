// object for user's ratings
const mongoose = require("mongoose");

var ratingSchema = new mongoose.Schema({
    physics:{
        type: String,
        default: "0"
    },
    chemistry:{
        type: String,
        default: "0"
    },
    biology: {
        type: String,
        default: "0"
    },
    physicsRate: {
        type: String,
        default: "0"
    },
    chemistryRate:{
        type: String,
        default: "0"
    },
    biologyRate: {
        type: String,
        default: "0"
    }
});
module.exports = {ratings: ratingSchema};