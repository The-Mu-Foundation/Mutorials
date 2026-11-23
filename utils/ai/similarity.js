// Semantic index over the question bank. Vectors are produced by a small
// sentence-embedding model, persisted in MongoDB (so a restart only embeds new
// or edited questions) and searched by brute-force cosine similarity, which is
// instantaneous for the tens of thousands of questions this site can hold.
const crypto = require('crypto');
const { toPlainText } = require('./text');

const COLLECTION = 'aiEmbeddings';
const BATCH = 16;

const unitName = (unit) => String(unit).replace(/^.*? - /, '');

// what gets embedded: subject and unit give the vector topical context
function textFor(question) {
  return [
    (question.subject || []).join(', '),
    (question.units || []).map(unitName).join(', '),
    toPlainText(question.question, 800),
  ].join(' | ');
}

const hashOf = (text, model) =>
  crypto.createHash('sha1').update(`${model}\n${text}`).digest('hex');

const dot = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};

function toBuffer(vec) {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

function fromBinary(binary) {
  const raw = binary.buffer || binary;
  return new Float32Array(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
  );
}

class SimilarityIndex {
  constructor({ mongo, backend, model }) {
    this.mongo = mongo;
    this.backend = backend;
    this.model = model;
    this.entries = new Map(); // id -> { subject, hash, vec }
    this.pendingCache = new Map(); // hash -> vec
    this.syncing = null;
    this.lastSyncedAt = 0;
    this.progress = { total: 0, indexed: 0, error: null };
  }

  get collection() {
    return this.mongo.db.collection(COLLECTION);
  }

  status() {
    return {
      ...this.progress,
      size: this.entries.size,
      syncing: Boolean(this.syncing),
    };
  }

  /** Embeds new or edited questions and drops vectors of deleted ones. */
  sync() {
    if (!this.syncing) {
      this.syncing = this._sync()
        .catch((err) => {
          this.progress.error = String(err.message || err);
          throw err;
        })
        .then((count) => {
          this.lastSyncedAt = Date.now();
          return count;
        })
        .finally(() => {
          this.syncing = null;
        });
    }
    return this.syncing;
  }

  /**
   * Makes sure the index has been built. The first call waits (up to maxWaitMs)
   * for the initial build; later calls return immediately and refresh the index
   * in the background so newly added questions become searchable.
   * @returns {Promise<boolean>} whether the index is usable
   */
  async ensureSynced(maxWaitMs = 4000, refreshMs = 10 * 60 * 1000) {
    const stale = Date.now() - this.lastSyncedAt > refreshMs;
    if (this.lastSyncedAt && !stale) return true;
    const running = this.sync();
    running.catch(() => {});
    if (this.lastSyncedAt) return true; // stale but usable: refresh in the background
    let timer;
    const outcome = await Promise.race([
      running.then(() => true),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), maxWaitMs);
      }),
    ]).finally(() => clearTimeout(timer));
    return outcome;
  }

  async _sync() {
    const questions = await this.mongo.Ques.find(
      {},
      'subject units question',
    ).lean();
    const stored = new Map(
      (await this.collection.find({ model: this.model }).toArray()).map(
        (doc) => [String(doc._id), doc],
      ),
    );
    this.progress = { total: questions.length, indexed: 0, error: null };

    const live = new Set();
    const todo = [];
    for (const question of questions) {
      const id = String(question._id);
      live.add(id);
      const text = textFor(question);
      const hash = hashOf(text, this.model);
      const cached = stored.get(id);
      if (cached && cached.hash === hash) {
        this.entries.set(id, {
          subject: (question.subject || [])[0],
          hash,
          vec: fromBinary(cached.vec),
        });
        this.progress.indexed += 1;
      } else {
        todo.push({ id, text, hash, subject: (question.subject || [])[0] });
      }
    }

    for (let i = 0; i < todo.length; i += BATCH) {
      const batch = todo.slice(i, i + BATCH);
      const vectors = await this.backend.embed(batch.map((item) => item.text));
      await Promise.all(
        batch.map((item, j) => {
          this.entries.set(item.id, {
            subject: item.subject,
            hash: item.hash,
            vec: vectors[j],
          });
          this.progress.indexed += 1;
          return this.collection.updateOne(
            { _id: item.id },
            {
              $set: {
                model: this.model,
                hash: item.hash,
                vec: toBuffer(vectors[j]),
              },
            },
            { upsert: true },
          );
        }),
      );
    }

    for (const id of [...this.entries.keys()]) {
      if (!live.has(id)) this.entries.delete(id);
    }
    const gone = [...stored.keys()].filter((id) => !live.has(id));
    if (gone.length > 0)
      await this.collection.deleteMany({ _id: { $in: gone } });
    return todo.length;
  }

  // vector for a stored question, embedding it on demand when it is not indexed yet
  async vectorFor(id) {
    const key = String(id);
    const known = this.entries.get(key);
    if (known) return known;
    const question = await this.mongo.Ques.findById(
      key,
      'subject units question',
    ).lean();
    if (!question) return null;
    const text = textFor(question);
    const [vec] = await this.backend.embed([text]);
    const entry = {
      subject: (question.subject || [])[0],
      hash: hashOf(text, this.model),
      vec,
    };
    this.entries.set(key, entry);
    return entry;
  }

  /** Most similar live questions to a stored question, same subject only. */
  async related(id, { k = 5, minScore = 0.3 } = {}) {
    const target = await this.vectorFor(id);
    if (!target) return [];
    const key = String(id);
    const scored = [];
    for (const [otherId, entry] of this.entries) {
      if (otherId === key || entry.subject !== target.subject) continue;
      const score = dot(target.vec, entry.vec);
      if (score >= minScore) scored.push({ id: otherId, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, k);
  }

  /** Nearest live questions to arbitrary text (used to catch duplicate submissions). */
  async nearestLive(text, { k = 5, minScore = 0.7 } = {}) {
    const [vec] = await this.backend.embed([text]);
    const scored = [];
    for (const [id, entry] of this.entries) {
      const score = dot(vec, entry.vec);
      if (score >= minScore) scored.push({ id, score, source: 'live' });
    }
    return { vec, hits: scored.sort((a, b) => b.score - a.score).slice(0, k) };
  }

  /** Same, over questions still waiting for review (embedded lazily and memoised). */
  async nearestPending(vec, { k = 5, minScore = 0.7, limit = 500 } = {}) {
    const pending = await this.mongo.PendingQues.find(
      {},
      'subject units question',
    )
      .limit(limit)
      .lean();
    const scored = [];
    const missing = [];
    for (const question of pending) {
      const text = textFor(question);
      const hash = hashOf(text, this.model);
      const cached = this.pendingCache.get(hash);
      if (cached) {
        const score = dot(vec, cached);
        if (score >= minScore)
          scored.push({ id: String(question._id), score, source: 'pending' });
      } else {
        missing.push({ question, text, hash });
      }
    }
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const vectors = await this.backend.embed(batch.map((item) => item.text));
      batch.forEach((item, j) => {
        this.pendingCache.set(item.hash, vectors[j]);
        const score = dot(vec, vectors[j]);
        if (score >= minScore)
          scored.push({
            id: String(item.question._id),
            score,
            source: 'pending',
          });
      });
    }
    if (this.pendingCache.size > 2000) this.pendingCache.clear();
    return scored.sort((a, b) => b.score - a.score).slice(0, k);
  }
}

module.exports = { SimilarityIndex, textFor, hashOf, dot };
