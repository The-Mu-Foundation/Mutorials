#!/usr/bin/env node
// Pilot evaluation of the generative tutor: runs real open models on a small
// hand-written question set and reports how often the output survives the
// guards (utils/ai/guards.js), plus latency.
//
//   node scripts/ai-eval.js [modelId ...]   (downloads models on first use)
//
// This is a pilot (n = 10 questions x 3 modes), meant for choosing a default
// model and spotting regressions, not for statistical claims.
const path = require('path');
const questions = require('./ai-eval-questions.json');
const { createBackend } = require('../utils/ai/backend');
const { buildMessages, checkOutput } = require('../utils/ai/guards');

const models = process.argv.slice(2);
if (models.length === 0) models.push('onnx-community/Qwen2.5-1.5B-Instruct');

const MODES = ['simplify', 'hint', 'why-wrong'];

async function evaluate(model) {
  const backend = createBackend({
    enabled: true,
    llmEnabled: true,
    offline: false,
    embedModel: 'Xenova/all-MiniLM-L6-v2',
    llmModel: model,
    llmDtype: 'q4',
    cacheDir:
      process.env.AI_CACHE_DIR ||
      path.join(__dirname, '..', '.cache', 'models'),
    maxNewTokens: 160,
    generationTimeoutMs: 600000,
    maxQueue: 100,
  });
  const rows = { simplify: [], hint: [], 'why-wrong': [] };
  const failures = {};
  for (const question of questions) {
    for (const mode of MODES) {
      // a plausible wrong answer: the first choice that is not correct (free response: none)
      const wrong =
        question.type === 'fr'
          ? ['not sure']
          : [
              String(
                question.choices.findIndex(
                  (_, i) => !question.answer.includes(String(i + 1)),
                ) + 1,
              ),
            ];
      const started = Date.now();
      let verdict;
      try {
        const raw = await backend.generate(
          buildMessages(mode, question, { userAnswer: wrong }),
        );
        verdict = checkOutput(mode, raw, question);
      } catch (err) {
        verdict = { ok: false, reason: 'error: ' + err.message };
      }
      rows[mode].push({ ok: verdict.ok, ms: Date.now() - started });
      if (!verdict.ok)
        failures[verdict.reason] = (failures[verdict.reason] || 0) + 1;
      process.stderr.write(
        `${model} ${question.id} ${mode} ${verdict.ok ? 'ok' : verdict.reason}\n`,
      );
    }
  }
  return { model, rows, failures };
}

(async () => {
  const results = [];
  for (const model of models) results.push(await evaluate(model));
  console.log('\n| Model | Mode | Passed guards | Median latency (s) |');
  console.log('|---|---|---|---|');
  for (const { model, rows } of results) {
    for (const mode of MODES) {
      const sorted = rows[mode].map((r) => r.ms).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] / 1000;
      const passed = rows[mode].filter((r) => r.ok).length;
      console.log(
        `| ${model} | ${mode} | ${passed}/${rows[mode].length} | ${median.toFixed(1)} |`,
      );
    }
  }
  for (const { model, failures } of results) {
    console.log(`\nFailure reasons for ${model}: ${JSON.stringify(failures)}`);
  }
})();
