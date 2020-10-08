const mongoose = require("mongoose");

// define user schema
const siteDataSchema = new mongoose.Schema({
    tag: String,
    data: Object
});

module.exports = { siteDataSchema };
