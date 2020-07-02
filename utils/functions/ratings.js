// params: ratings are numbers, correct is boolean (true = player got it right)
function calculateRatings(userRating, questionRating, correct) {

    // important values: 600 is spread of elo change, 50 is scale of change
    var chanceOfCorrect = 1 / (1 + Math.pow(10, (questionRating - userRating) / 600));
    var userRatingChange = Math.ceil(50 * (correct - chanceOfCorrect));
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

    var spread = Math.round((Math.random()+1.1)*(Math.random()+1.1)*(Math.random()+1.1)*100);
    spread += Math.round(userRating/20);

    var floor = userRating-spread;
    var ceiling = userRating+spread;
    if(floor < 0) {
        floor = 0;
    }

    return { floor : floor, ceiling : ceiling };
}

module.exports = { calculateRatings : calculateRatings, ratingCeilingFloor : ratingCeilingFloor };