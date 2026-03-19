const { Ques, db } = require('../mongo');

/**
 * Usage:
 *   node utils/functions/scripts.js 0-1000 1000-1500 1500-2000
 *
 * Each argument should be a range in the form "lower-upper" (or "lower:upper"),
 * where bounds are numeric ratings.
 *
 * If no ranges are provided, a default set is used.
 */

function parseRanges(args) {
  if (!args.length) {
    return [
      { label: '0-1000', min: 0, max: 1000 },
      { label: '1000-1500', min: 1000, max: 1500 },
      { label: '1500-2000', min: 1500, max: 2000 },
      { label: '2000-2500', min: 2000, max: 2500 },
      { label: '2500-3000', min: 2500, max: 3000 },
    ];
  }

  return args
    .map((arg) => {
      const cleaned = String(arg).trim();
      if (!cleaned) return null;

      // support "a-b" or "a:b"
      const parts = cleaned.includes('-')
        ? cleaned.split('-')
        : cleaned.split(':');

      if (parts.length !== 2) return null;

      const min = Number(parts[0]);
      const max = Number(parts[1]);

      if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

      return {
        label: `${min}-${max}`,
        min,
        max,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.min - b.min);
}

async function countQuestionsByRatingRanges(ranges) {
  const results = ranges.map((r) => ({ ...r, count: 0 }));

  const questions = await Ques.find({}, { rating: 1 }).lean().exec();

  for (const q of questions) {
    const rating = Number(q.rating);
    if (!Number.isFinite(rating)) continue;

    for (const r of results) {
      // lower bound inclusive, upper bound exclusive
      if (rating >= r.min && rating < r.max) {
        r.count += 1;
        break;
      }
    }
  }

  return { total: questions.length, results };
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const ranges = parseRanges(args);

    if (!ranges.length) {
      console.error('No valid rating ranges provided.');
      process.exitCode = 1;
      return;
    }

    const { total, results } = await countQuestionsByRatingRanges(ranges);

    console.log(`Total questions: ${total}`);
    for (const r of results) {
      console.log(`${r.label}: ${r.count}`);
    }
  } catch (err) {
    console.error('Error counting questions by rating range:', err);
    process.exitCode = 1;
  } finally {
    // Close the Mongo connection cleanly
    if (db && db.close) {
      db.close(() => {
        process.exit();
      });
    } else {
      process.exit();
    }
  }
}

if (require.main === module) {
  main();
}
