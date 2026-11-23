// input a string (the question ID), returns question entry
function getUSABOQuestion(USABOQues, id) {
  return USABOQues.findById(id).exec();
}

// picks one random USABO question in the rating range that matches any category
async function pickUSABOQuestion(USABOQues, { floor, ceiling, categories }) {
  const [picked] = await USABOQues.aggregate([
    {
      $match: {
        rating: { $gte: floor, $lte: ceiling },
        categories: { $in: categories },
      },
    },
    { $sample: { size: 1 } },
    { $project: { _id: 1 } },
  ]);
  return picked ? USABOQues.findById(picked._id).exec() : null;
}

module.exports = { getUSABOQuestion, pickUSABOQuestion };
