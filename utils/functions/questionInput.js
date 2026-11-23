// Validation of question-authoring forms (contributors, reviewers, admins).
const { tags } = require('../constants/tags');
const { subjectUnitDictionary } = require('../constants/subjects');
const { asString } = require('./http');

const QUESTION_TYPES = ['mc', 'sa', 'fr'];
const USABO_ROUNDS = ['open', 'semis'];
const MAX_TEXT = 20000;

const toList = (value) =>
  (value === undefined || value === null ? [] : [].concat(value)).map(String);
const split = (value) => asString(value).split('@');

function parseRating(value) {
  const rating = Number(asString(value));
  return Number.isInteger(rating) && rating >= 0 && rating <= 10000
    ? rating
    : null;
}

// prepends the tag of every selected unit to the tag list and removes duplicates
function withUnitTags(tagString, subjects, units) {
  let list = split(tagString).filter(Boolean);
  subjects.forEach((subject) => {
    const unitTags = (tags[subject] && tags[subject].Units) || {};
    Object.keys(unitTags).forEach((unitTag) => {
      if (units.includes(subject + ' - ' + unitTags[unitTag])) {
        list = [unitTag, ...list];
      }
    });
  });
  return [...new Set(list)];
}

/**
 * Validates a standard-bank question form. Returns { data } on success or
 * { error } describing what was wrong.
 * options.requireAuthor: admins and reviewers supply the author field.
 */
function parseQuestionForm(
  body,
  { requireAuthor = false, requireTags = false } = {},
) {
  const question = asString(body.question).trim();
  const answerExplanation = asString(body.answerExplanation).trim();
  const type = asString(body.type);
  const externalSource = asString(body.externalSource).trim();
  const author = asString(body.author).trim();
  const rating = parseRating(body.rating);
  const answer = split(body.answer);
  const subject = toList(body.subject).filter(
    (name) => subjectUnitDictionary[name],
  );
  const units = toList(body.units);

  if (!question || question.length > MAX_TEXT) return { error: 'question' };
  if (!answerExplanation || answerExplanation.length > MAX_TEXT)
    return { error: 'explanation' };
  if (!QUESTION_TYPES.includes(type)) return { error: 'type' };
  if (!externalSource) return { error: 'source' };
  if (rating === null) return { error: 'rating' };
  if (!answer[0]) return { error: 'answer' };
  if (subject.length === 0 || units.length === 0) return { error: 'subject' };
  if (requireAuthor && !author) return { error: 'author' };
  if (requireTags && split(body.tags).filter(Boolean).length === 0)
    return { error: 'tags' };

  return {
    data: {
      question,
      choices: split(body.choices),
      tags: withUnitTags(body.tags, subject, units),
      rating,
      answer,
      answer_ex: answerExplanation,
      author,
      type,
      ext_source: externalSource,
      source_statement: asString(body.sourceStatement),
      subject,
      units,
    },
  };
}

/** Validates a USABO question form. Returns { data } or { error }. */
function parseUsaboForm(body, { requireAuthor = false } = {}) {
  const question = asString(body.question).trim();
  const answerExplanation = asString(body.answerExplanation).trim();
  const type = asString(body.type);
  const rating = parseRating(body.rating);
  const answer = split(body.answer);
  const round = toList(body.round).filter((name) =>
    USABO_ROUNDS.includes(name),
  );
  const categories = toList(body.categories);
  const author = asString(body.author).trim();

  if (!question || question.length > MAX_TEXT) return { error: 'question' };
  if (!answerExplanation || answerExplanation.length > MAX_TEXT)
    return { error: 'explanation' };
  if (!QUESTION_TYPES.includes(type)) return { error: 'type' };
  if (rating === null) return { error: 'rating' };
  if (!answer[0]) return { error: 'answer' };
  if (round.length === 0 || categories.length === 0) return { error: 'round' };
  if (requireAuthor && !author) return { error: 'author' };

  return {
    data: {
      question,
      choices: split(body.choices),
      year: asString(body.year),
      rating,
      answer,
      answer_ex: answerExplanation,
      author,
      type,
      problemNumber: asString(body.problemNumber),
      round,
      categories,
    },
  };
}

module.exports = { parseQuestionForm, parseUsaboForm, withUnitTags };
