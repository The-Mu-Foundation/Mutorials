// Self-hosted AI features: related questions, a guarded generative tutor and
// duplicate detection for question authors. See docs/AI.md.
const crypto = require('crypto');
const { ai } = require('../utils/config');
const { isAdmin } = require('../utils/constants/sitesettings');
const { aiLimiter } = require('../utils/middleware/security');
const { getBackend, getIndex } = require('../utils/ai/runtime');
const { BusyError } = require('../utils/ai/backend');
const {
  MODES,
  buildMessages,
  checkOutput,
  fallback,
} = require('../utils/ai/guards');
const { toPlainText } = require('../utils/ai/text');
const { toObjectId } = require('../utils/functions/ids');
const { asString, wrap } = require('../utils/functions/http');

const DUPLICATE_THRESHOLD = 0.8;
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 24 * 60 * 60 * 1000;

const snippet = (html, max = 160) => {
  const text = toPlainText(html, 600);
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
};

module.exports = (app, mongo) => {
  app.all(/^\/ai(\/.*)?$/, (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Please sign in to use the AI tools.' });
  });
  app.use('/ai', aiLimiter);

  let ttlReady = null;
  const ensureCacheIndex = () => {
    ttlReady ||= mongo.db
      .collection('aiCache')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      .catch(() => {});
    return ttlReady;
  };

  app.get('/ai/status', (req, res) => {
    const backend = getBackend();
    res.json({
      ...backend.capabilities(),
      index: ai.enabled ? getIndex(mongo).status() : null,
    });
  });

  // ------------------------------------------------------------ related questions
  app.get(
    '/ai/related/:id',
    wrap(async (req, res) => {
      const id = toObjectId(req.params.id);
      if (!id) return res.status(404).json({ related: [] });
      if (!ai.enabled) return res.json({ available: false, related: [] });
      try {
        const index = getIndex(mongo);
        if (!(await index.ensureSynced())) {
          return res.json({ available: false, warming: true, related: [] });
        }
        const hits = await index.related(id, { k: 5 });
        const docs = await mongo.Ques.find(
          { _id: { $in: hits.map((hit) => hit.id) } },
          'question rating units subject',
        ).lean();
        const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
        const related = hits
          .filter((hit) => byId.has(hit.id))
          .map((hit) => {
            const doc = byId.get(hit.id);
            return {
              id: hit.id,
              score: Math.round(hit.score * 100) / 100,
              snippet: snippet(doc.question),
              rating: doc.rating,
              unit: (doc.units || [])[0]
                ? String(doc.units[0]).replace(/^.*? - /, '')
                : null,
            };
          });
        res.json({ available: true, related });
      } catch (err) {
        console.error('[ai] related failed:', err.message || err);
        res.json({ available: false, related: [] });
      }
    }),
  );

  // ------------------------------------------------------------------ the tutor
  async function hasAnswered(req, question) {
    const subjectKey = String(question.subject[0] || '').toLowerCase();
    const seen = (req.session.seenQuestions || {})[subjectKey] || [];
    if (seen.includes(String(question._id))) return true;
    return Boolean(
      await mongo.Attempt.exists({
        user: req.user._id,
        question: question._id,
      }),
    );
  }

  const cacheKey = (mode, question, answerKey) =>
    crypto
      .createHash('sha256')
      .update(
        [
          ai.llmModel,
          mode,
          String(question._id),
          crypto
            .createHash('sha1')
            .update(
              `${question.question}\0${question.answer_ex}\0${question.answer}`,
            )
            .digest('hex'),
          answerKey,
        ].join('\0'),
      )
      .digest('hex');

  app.post(
    '/ai/tutor',
    wrap(async (req, res) => {
      const mode = asString(req.body.mode);
      const id = toObjectId(req.body.id);
      if (!MODES.includes(mode) || !id)
        return res.status(400).json({ error: 'Invalid request.' });

      const question = await mongo.Ques.findById(id).lean();
      if (!question)
        return res.status(404).json({ error: 'That question does not exist.' });

      // explanations reveal the answer, so they are only available after answering
      if (mode !== 'hint' && !(await hasAnswered(req, question))) {
        return res
          .status(403)
          .json({ error: 'Answer the question first to unlock explanations.' });
      }

      const userAnswer =
        mode === 'why-wrong'
          ? []
              .concat(req.body.answer ?? [])
              .map((a) => String(a).slice(0, 300))
              .slice(0, 8)
          : [];
      const answerKey = userAnswer.join(',');

      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      const send = (payload) => {
        if (!res.writableEnded && !res.destroyed)
          res.write(JSON.stringify(payload) + '\n');
      };
      const finish = (payload) => {
        send({ type: 'result', mode, ...payload });
        res.end();
      };
      const plain = () => fallback(mode, question, { userAnswer });
      const llm = ai.enabled && ai.llmEnabled;

      if (!llm) {
        return finish({
          text: plain(),
          source: 'fallback',
          reason: 'llm-disabled',
        });
      }

      await ensureCacheIndex();
      const key = cacheKey(mode, question, answerKey);
      const hit = await mongo.db.collection('aiCache').findOne({ _id: key });
      if (hit) {
        return finish({
          text: hit.text,
          source: hit.source === 'model' ? 'cache' : 'fallback',
          reason: hit.reason,
        });
      }

      const backend = getBackend();
      send({
        type: 'status',
        state: backend.capabilities().queued > 0 ? 'queued' : 'generating',
      });
      const heartbeat = setInterval(
        () => send({ type: 'status', state: 'generating' }),
        5000,
      );
      try {
        const raw = await backend.generate(
          buildMessages(mode, question, { userAnswer }),
        );
        const verdict = checkOutput(mode, raw, question);
        const doc = verdict.ok
          ? {
              text: verdict.text,
              source: 'model',
              expiresAt: new Date(Date.now() + CACHE_TTL_MS),
            }
          : {
              text: plain(),
              source: 'fallback',
              reason: verdict.reason,
              expiresAt: new Date(Date.now() + FAILURE_TTL_MS),
            };
        await mongo.db
          .collection('aiCache')
          .updateOne(
            { _id: key },
            { $set: { ...doc, mode, createdAt: new Date() } },
            { upsert: true },
          )
          .catch(() => {});
        finish({
          text: doc.text,
          source: doc.source === 'model' ? 'model' : 'fallback',
          reason: doc.reason,
        });
      } catch (err) {
        if (!(err instanceof BusyError))
          console.error('[ai] tutor failed:', err.message || err);
        finish({
          text: plain(),
          source: 'fallback',
          reason: err instanceof BusyError ? 'busy' : 'error',
        });
      } finally {
        clearInterval(heartbeat);
      }
    }),
  );

  // ---------------------------------------------------- duplicate detection (authors)
  const mayAuthor = (user) =>
    isAdmin(user) || Boolean(user.contributor) || user.reviewer === true;

  app.post(
    '/ai/duplicates',
    wrap(async (req, res) => {
      if (!mayAuthor(req.user))
        return res.status(403).json({ error: 'Forbidden.' });
      const text = toPlainText(asString(req.body.question), 1000);
      if (text.length < 15)
        return res
          .status(400)
          .json({ error: 'Enter the question text first.' });
      if (!ai.enabled) return res.json({ available: false, matches: [] });
      try {
        const index = getIndex(mongo);
        await index.ensureSynced();
        const { vec, hits } = await index.nearestLive(text, {
          minScore: DUPLICATE_THRESHOLD,
        });
        const pending = await index.nearestPending(vec, {
          minScore: DUPLICATE_THRESHOLD,
        });
        const top = [...hits, ...pending]
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        const liveDocs = await mongo.Ques.find(
          {
            _id: {
              $in: top.filter((m) => m.source === 'live').map((m) => m.id),
            },
          },
          'question',
        ).lean();
        const pendingDocs = await mongo.PendingQues.find(
          {
            _id: {
              $in: top.filter((m) => m.source === 'pending').map((m) => m.id),
            },
          },
          'question',
        ).lean();
        const bodies = new Map(
          [...liveDocs, ...pendingDocs].map((doc) => [
            String(doc._id),
            doc.question,
          ]),
        );
        res.json({
          available: true,
          threshold: DUPLICATE_THRESHOLD,
          matches: top
            .filter((m) => bodies.has(m.id))
            .map((m) => ({
              id: m.id,
              source: m.source,
              score: Math.round(m.score * 100) / 100,
              snippet: snippet(bodies.get(m.id)),
            })),
        });
      } catch (err) {
        console.error('[ai] duplicates failed:', err.message || err);
        res.json({ available: false, matches: [] });
      }
    }),
  );
};
