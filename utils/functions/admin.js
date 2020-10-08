const mongoose = require("mongoose");
const { average } = require("./general");
var db = mongoose.connection;

// get specific admin analytics about the database
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

// query the performance of a contributor
async function queryContributor(id, Ques) {
    
    let written = await Ques.find({ author: id }).exec();

    if(!written || written.length < 1) {
        return { status: "Error" };
    }

    let physicsWritten = 0;
    let chemistryWritten = 0;
    let biologyWritten = 0;
    let ratingSum = 0;
    let hourSum = 0;

    written.forEach((question) => {

        if(question.subject.includes("Physics")) {
            physicsWritten++;
        }
        if(question.subject.includes("Chemistry")) {
            chemistryWritten++;
        }
        if(question.subject.includes("Biology")) {
            biologyWritten++;
        }

        ratingSum += question.rating;

        hourSum += calculateHours(question.subject[0], question.rating);
        console.log(question.rating);
        console.log(hourSum);
    });

    hourSum = Math.round(100*hourSum)/100;

    let ratingAverage = Math.round(ratingSum/written.length);

    return { status: "Success", data: {
        physicsWritten,
        chemistryWritten,
        biologyWritten,
        ratingAverage,
        hourSum
    } };
}

// approximation of number of hours to write a single question
function calculateHours(subject, rating) {
    
    // heuristic functions are subject to change
    if(subject == "Physics") {
        return 0.2*Math.pow(Math.E, 0.0006*rating);
    } else if(subject == "Chemistry") {
        return 0.3*Math.pow(Math.E, 0.0005*rating);
    } else if(subject == "Biology") {
        return 3.5*Math.pow(Math.E, 0.0003*rating);
    }
}

module.exports = { getAdminData, queryContributor };

