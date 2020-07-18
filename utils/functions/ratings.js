// params: ratings are numbers, correct is boolean (true = player got it right)
function calculateRatings(userRating, questionRating, correct) {

    // important values: 1000 is spread of elo change, 32 is scale of change
    var chanceOfCorrect = 1 / (1 + Math.pow(10, (questionRating - userRating) / 1000));
    var userRatingChange = Math.ceil(32 * (correct - chanceOfCorrect));
    var questionRatingChange = -Math.ceil(userRatingChange / 10);

    // assign rating changes
    userRating += userRatingChange;
    questionRating += questionRatingChange;

    // make sure ratings are nonzero
    if (userRating < 1) {
        userRating = 1;
    }
    if (questionRating < 1) {
        questionRating = 1;
    }

    return { newUserRating: userRating, newQuestionRating: questionRating }
}

// input user rating, gives range of ratings for next question's selection
function ratingCeilingFloor(userRating) {

    var spread = Math.round((Math.random()+2)*(Math.random()+2)*100);
    spread += Math.round(userRating/10);

    var floor = userRating-spread;
    var ceiling = userRating+spread;
    if(floor < 0) {
        floor = 0;
    }

    return { floor : floor, ceiling : ceiling };
}

module.exports = { calculateRatings : calculateRatings, ratingCeilingFloor : ratingCeilingFloor };