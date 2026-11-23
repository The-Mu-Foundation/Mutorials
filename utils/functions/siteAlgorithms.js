// params: ratings are numbers, correct is boolean (true = player got it right)
function calculateRatings(userRating, questionRating, correct) {
  // important values: 1000 is spread of elo change, 25 is scale of change
  const chanceOfCorrect =
    1 / (1 + Math.pow(9, (questionRating - userRating) / 1000));
  const userRatingChange = Math.round(16 * (correct - chanceOfCorrect));
  const questionRatingChange = -Math.round(userRatingChange / 25);

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

  return { newUserRating: userRating, newQuestionRating: questionRating };
}

// input user rating, gives range of ratings for next question's selection
function ratingCeilingFloor(userRating) {
  let spread = Math.round((Math.random() + 2.7) * (Math.random() + 0.8) * 100);
  spread += Math.round(userRating / 10);

  let floor = userRating - spread;
  const ceiling = userRating + spread;
  if (floor < 0) {
    floor = 0;
  }

  return { floor: floor, ceiling: ceiling };
}

function calculateLevel(experience) {
  // if experience doesn't exist
  if (!experience) {
    experience = 0;
  }

  let total = experience;
  let level = 1;
  let decrement = 1000 * Math.pow(level, 1.21);

  while (total - decrement >= 0) {
    total -= decrement;
    level += 1;
    decrement = 1000 * Math.pow(level, 1.21);
  }

  return {
    level,
    remainder: Math.round(total),
    totalToNext: Math.round(decrement),
  };
}

function analyze(unitData) {
  const strengths = {
    physics: [],
    biology: [],
    chemistry: [],
    usabo: [],
    ess: [],
  };
  const weaknesses = {
    physics: [],
    biology: [],
    chemistry: [],
    usabo: [],
    ess: [],
  };
  const studying = {
    physics: [],
    biology: [],
    chemistry: [],
    usabo: [],
    ess: [],
  };
  const favorites = {
    physics: [],
    biology: [],
    chemistry: [],
    usabo: [],
    ess: [],
  };

  for (const [unit, data] of Object.entries(unitData)) {
    const performance = data.pastResults.reduce((a, b) => a + b, 0);
    const averageRating =
      data.pastRatings.reduce((a, b) => a + b, 0) / data.pastRatings.length;

    if (
      performance >= 10 ||
      (performance >= 5 && averageRating >= 2500) ||
      (performance >= 3 && averageRating >= 3500)
    ) {
      strengths[unit.split(' ')[0].toLowerCase()].push('' + unit);
    } else if (
      performance <= -7 ||
      (performance <= -5 && averageRating <= 2000) ||
      (performance <= -3 && averageRating <= 1500)
    ) {
      weaknesses[unit.split(' ')[0].toLowerCase()].push('' + unit);
    } else {
      studying[unit.split(' ')[0].toLowerCase()].push('' + unit);
    }

    if (data.correct + data.wrong >= 100) {
      favorites[unit.split(' ')[0].toLowerCase()].push('' + unit);
    }
  }

  return { strengths, weaknesses, studying, favorites };
}

module.exports = {
  calculateRatings,
  ratingCeilingFloor,
  calculateLevel,
  analyze,
};
