const mongoose = require("mongoose");
const { average } = require("./general");
var db = mongoose.connection;

async function getAdminData(User, Ques, SiteData) {
    
    let physicsQs = await Ques.find({ subject: "Physics" }).exec();
    let chemistryQs = await Ques.find({ subject: "Chemistry" }).exec();
    let biologyQs = await Ques.find({ subject: "Biology" }).exec();

    let physicsRatings = physicsQs.map((q) => { return q.rating; });
    let chemistryRatings = chemistryQs.map((q) => { return q.rating; });
    let biologyRatings = biologyQs.map((q) => { return q.rating; });

    let physicsAverageRating = Math.round(average(physicsRatings));
    let chemistryAverageRating = Math.round(average(chemistryRatings));
    let biologyAverageRating = Math.round(average(biologyRatings));

    let physicsQuestionCount = physicsRatings.length;
    let chemistryQuestionCount = chemistryRatings.length;
    let biologyQuestionCount = biologyRatings.length;

    return {
        physicsAverageRating,
        chemistryAverageRating,
        biologyAverageRating,
        physicsQuestionCount,
        chemistryQuestionCount,
        biologyQuestionCount
    }
}

module.exports = { getAdminData };

