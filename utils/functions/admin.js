const mongoose = require("mongoose");
const { average } = require("./general");
const db = mongoose.connection;

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
async function queryContributor(id, Ques, PendingQues) {

    let written = await Ques.find({ author: id }).exec();
    let pendingWritten = await PendingQues.find({ author: id }).exec();

    if ((!written || written.length < 1) && (!pendingWritten || pendingWritten.length < 1)) {
        return { status: "Error" };
    }

    let physicsWritten = 0;
    let chemistryWritten = 0;
    let biologyWritten = 0;
    let physicsRatingSum = 0;
    let chemistryRatingSum = 0;
    let biologyRatingSum = 0;
    let ratingSum = 0;
    let hourSum = 0;

    written.forEach((question) => {

        if (question.subject.includes("Physics")) {
            physicsWritten++;
            physicsRatingSum += question.rating;
        }
        if (question.subject.includes("Chemistry")) {
            chemistryWritten++;
            chemistryRatingSum += question.rating;
        }
        if (question.subject.includes("Biology")) {
            biologyWritten++;
            biologyRatingSum += question.rating;
        }

        ratingSum += question.rating;

        hourSum += calculateHours(question.subject[0], question.rating);
    });

    let ratingAverage = Math.round(ratingSum / Math.max(1, written.length));
    let physicsRatingAverage = Math.round(physicsRatingSum / Math.max(1, physicsWritten));
    let chemistryRatingAverage = Math.round(chemistryRatingSum / Math.max(1, chemistryWritten));
    let biologyRatingAverage = Math.round(biologyRatingSum / Math.max(1, biologyWritten));

    let pendingPhysicsWritten = 0;
    let pendingChemistryWritten = 0;
    let pendingBiologyWritten = 0;
    let pendingHourSum = 0;

    pendingWritten.forEach((question) => {

        if (question.subject.includes("Physics")) {
            pendingPhysicsWritten++;
            pendingHourSum += calculateHours(question.subject[0], physicsRatingAverage);
        }
        if (question.subject.includes("Chemistry")) {
            pendingChemistryWritten++;
            pendingHourSum += calculateHours(question.subject[0], chemistryRatingAverage);
        }
        if (question.subject.includes("Biology")) {
            pendingBiologyWritten++;
            pendingHourSum += calculateHours(question.subject[0], biologyRatingAverage);
        }
    });

    hourSum = Math.round(100 * hourSum) / 100;
    pendingHourSum = Math.round(100 * pendingHourSum) / 100;

    return {
        status: "Success", data: {
            physics: {
                physicsWritten,
                physicsRatingAverage,
                pendingPhysicsWritten
            },
            chemistry: {
                chemistryWritten,
                chemistryRatingAverage,
                pendingChemistryWritten
            },
            biology: {
                biologyWritten,
                biologyRatingAverage,
                pendingBiologyWritten
            },
            ratingAverage,
            hourSum,
            pendingHourSum
        }
    };
}

// approximation of number of hours to write a single question
function calculateHours(subject, rating) {

    // heuristic functions are subject to change
    if (subject == "Physics") {
        return 0.05 * Math.pow(Math.E, 0.0009 * rating);
    } else if (subject == "Chemistry") {
        return 0.03 * Math.pow(Math.E, 0.001 * rating);
    } else if (subject == "Biology") {
        return 0.15 * Math.pow(Math.E, 0.0005 * rating);
    }
}

module.exports = { getAdminData, queryContributor };

