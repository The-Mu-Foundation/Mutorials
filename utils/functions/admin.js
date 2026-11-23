const { average } = require('./general');
const { USABOPendingQues, USABOQues } = require('./mongo');

// get specific admin analytics about the database
async function getAdminData(User, Ques, SiteData) {
  const physicsQs = await Ques.find({ subject: 'Physics' }).exec();
  const chemistryQs = await Ques.find({ subject: 'Chemistry' }).exec();
  const biologyQs = await Ques.find({ subject: 'Biology' }).exec();

  const physicsRatings = physicsQs.map((q) => {
    return q.rating;
  });
  const chemistryRatings = chemistryQs.map((q) => {
    return q.rating;
  });
  const biologyRatings = biologyQs.map((q) => {
    return q.rating;
  });

  const physicsAverageRating = Math.round(average(physicsRatings));
  const chemistryAverageRating = Math.round(average(chemistryRatings));
  const biologyAverageRating = Math.round(average(biologyRatings));

  const physicsQuestionCount = physicsRatings.length;
  const chemistryQuestionCount = chemistryRatings.length;
  const biologyQuestionCount = biologyRatings.length;

  return {
    physicsAverageRating,
    chemistryAverageRating,
    biologyAverageRating,
    physicsQuestionCount,
    chemistryQuestionCount,
    biologyQuestionCount,
  };
}

// query the performance of a contributor
async function queryContributor(id, Ques, PendingQues) {
  const written = await Ques.find({ author: id }).exec();
  const pendingWritten = await PendingQues.find({ author: id }).exec();
  const curUSABO = await USABOQues.find({ author: id }).exec();
  const pendingUSABO = await USABOPendingQues.find({ author: id }).exec();

  if (
    ((!written && !curUSABO) || (written.length < 1 && curUSABO.length < 1)) &&
    ((!pendingWritten && !pendingUSABO) ||
      (pendingWritten.length < 1 && pendingUSABO.length < 1))
  ) {
    return { status: 'Error' };
  }

  let physicsWritten = 0;
  let chemistryWritten = 0;
  let biologyWritten = 0;
  const usaboWritten = curUSABO.length;
  let essWritten = 0;
  let physicsRatingSum = 0;
  let chemistryRatingSum = 0;
  let biologyRatingSum = 0;
  let usaboRatingSum = 0;
  let essRatingSum = 0;
  let ratingSum = 0;
  let hourSum = 0;

  if (written.length > 0) {
    written.forEach((question) => {
      let refactor = 1;
      if (question.hourRefactor) {
        refactor = question.hourRefactor;
      }
      if (question.subject.includes('Physics')) {
        physicsWritten++;
        physicsRatingSum += question.rating;
      }
      if (question.subject.includes('Chemistry')) {
        chemistryWritten++;
        chemistryRatingSum += question.rating;
      }
      if (question.subject.includes('Biology')) {
        biologyWritten++;
        biologyRatingSum += question.rating;
      }
      if (question.subject.includes('ESS')) {
        essWritten++;
        essRatingSum += question.rating;
      }

      ratingSum += question.rating;

      hourSum += calculateHours(question.subject[0], question.rating, refactor);
    });
  }

  if (curUSABO.length > 0) {
    curUSABO.forEach((question) => {
      ratingSum += question.rating;
      usaboRatingSum += question.rating;
      hourSum += calcUSABOHours(
        question.round[0],
        question.rating,
        question.hourRefactor,
      );
    });
  }

  const ratingAverage = Math.round(ratingSum / Math.max(1, written.length));
  const physicsRatingAverage = Math.round(
    physicsRatingSum / Math.max(1, physicsWritten),
  );
  const chemistryRatingAverage = Math.round(
    chemistryRatingSum / Math.max(1, chemistryWritten),
  );
  const biologyRatingAverage = Math.round(
    biologyRatingSum / Math.max(1, biologyWritten),
  );
  const essRatingAverage = Math.round(essRatingSum / Math.max(1, essWritten));
  const usaboRatingAverage = Math.round(
    usaboRatingSum / Math.max(1, usaboWritten),
  );

  let pendingPhysicsWritten = 0;
  let pendingChemistryWritten = 0;
  let pendingBiologyWritten = 0;
  let pendingESSWritten = 0;
  const pendingUSABOWritten = pendingUSABO.length;
  let pendingHourSum = 0;

  if (pendingWritten.length > 1) {
    pendingWritten.forEach((question) => {
      let refactor = 1;
      if (question.hourRefactor) {
        refactor = question.hourRefactor;
      }
      if (question.subject.includes('Physics')) {
        pendingPhysicsWritten++;
        pendingHourSum += calculateHours(
          'Physics',
          physicsRatingAverage,
          refactor,
        );
      }
      if (question.subject.includes('Chemistry')) {
        pendingChemistryWritten++;
        pendingHourSum += calculateHours(
          'Chemistry',
          chemistryRatingAverage,
          refactor,
        );
      }
      if (question.subject.includes('Biology')) {
        pendingBiologyWritten++;
        pendingHourSum += calculateHours(
          'Biology',
          biologyRatingAverage,
          refactor,
        );
      }
      if (question.subject.includes('ESS')) {
        pendingESSWritten++;
        pendingHourSum += calculateHours('ESS', essRatingAverage, refactor);
      }
    });
  }

  if (pendingUSABO.length > 1) {
    pendingUSABO.forEach((question) => {
      let refactor = 1;
      if (question.hourRefactor) {
        refactor = question.hourRefactor;
      }
      pendingHourSum += calcUSABOHours(
        question.round[0],
        question.rating,
        refactor,
      );
    });
  }

  hourSum = Math.round(100 * hourSum) / 100;
  pendingHourSum = Math.round(100 * pendingHourSum) / 100;

  return {
    status: 'Success',
    data: {
      physics: {
        physicsWritten,
        physicsRatingAverage,
        pendingPhysicsWritten,
      },
      chemistry: {
        chemistryWritten,
        chemistryRatingAverage,
        pendingChemistryWritten,
      },
      biology: {
        biologyWritten,
        biologyRatingAverage,
        pendingBiologyWritten,
      },
      ess: {
        essWritten,
        essRatingAverage,
        pendingESSWritten,
      },
      usabo: {
        usaboWritten,
        usaboRatingAverage,
        pendingUSABOWritten,
      },
      ratingAverage,
      hourSum,
      pendingHourSum,
    },
  };
}

// approximation of number of hours to write a single question
function calculateHours(subject, rating, hourRefactor) {
  // heuristic functions are subject to change
  if (subject == 'Physics') {
    return 0.05 * Math.pow(Math.E, 0.0009 * rating) * hourRefactor;
  } else if (subject == 'Chemistry') {
    return 0.04 * Math.pow(Math.E, 0.001 * rating) * hourRefactor;
  } else if (subject == 'Biology' || subject == 'ESS') {
    return 0.14 * Math.pow(Math.E, 0.0005 * rating) * hourRefactor;
  }
}

function calcUSABOHours(round, rating, hourRefactor) {
  if (round == 'open') {
    return 0.05 * Math.pow(Math.E, 0.0006 * rating) * hourRefactor;
  } else if (round == 'semis') {
    return 0.075 * Math.pow(Math.E, 0.0007 * rating) * hourRefactor;
  }
}

module.exports = { getAdminData, queryContributor };
