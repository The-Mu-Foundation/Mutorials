// Plain-text helpers shared by the AI features. Question content is authored by
// contributors as HTML, so it is reduced to plain text before it reaches a model.

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function toPlainText(html, max = 2000) {
  return String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m])
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
    .slice(0, max);
}

// lower-case, drop punctuation that does not change meaning, collapse spaces
function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9.\-+/\s]/g, ' ')
    .replace(/(?<![0-9])\.|\.(?![0-9])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const letter = (index) => String.fromCharCode(64 + index);

// 1-based indices stored in question.answer for mc / sa questions
function correctIndices(question) {
  if (question.type === 'fr') return [];
  return (question.answer || [])
    .map(Number)
    .filter(
      (n) =>
        Number.isInteger(n) && n >= 1 && n <= (question.choices || []).length,
    );
}

/** Human-readable correct answer, e.g. "B. 4.9 m/s^2". */
function describeCorrect(question) {
  if (question.type === 'fr') {
    return (question.answer || []).map((a) => toPlainText(a, 200)).join(' or ');
  }
  return correctIndices(question)
    .map((i) => `${letter(i)}. ${toPlainText(question.choices[i - 1], 300)}`)
    .join('; ');
}

/** Human-readable form of what the user submitted (indices, list of indices, or text). */
function describeUserAnswer(question, raw) {
  if (question.type === 'fr') return toPlainText(String(raw ?? ''), 200);
  const picked = []
    .concat(raw ?? [])
    .map(Number)
    .filter(
      (n) =>
        Number.isInteger(n) && n >= 1 && n <= (question.choices || []).length,
    );
  return picked
    .map((i) => `${letter(i)}. ${toPlainText(question.choices[i - 1], 300)}`)
    .join('; ');
}

// strings that identify the correct answer inside generated text
function answerNeedles(question) {
  if (question.type === 'fr') {
    return (question.answer || [])
      .map((a) => normalize(toPlainText(a, 200)))
      .filter(Boolean);
  }
  return correctIndices(question)
    .map((i) => normalize(toPlainText(question.choices[i - 1], 300)))
    .filter(Boolean);
}

function numbersIn(text) {
  return (String(text).match(/-?\d+(?:\.\d+)?/g) || []).map((n) =>
    String(Number(n)),
  );
}

module.exports = {
  toPlainText,
  normalize,
  letter,
  correctIndices,
  describeCorrect,
  describeUserAnswer,
  answerNeedles,
  numbersIn,
};
