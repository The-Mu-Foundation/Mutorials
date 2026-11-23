// Local model runtime built on Transformers.js (ONNX Runtime, CPU). Models are
// open-weight checkpoints from the Hugging Face Hub, downloaded once into
// AI_CACHE_DIR. Nothing is sent to any third-party inference API.

class BusyError extends Error {
  constructor() {
    super('The AI queue is full.');
    this.name = 'BusyError';
    this.code = 'AI_BUSY';
  }
}

class Queue {
  constructor(maxPending) {
    this.maxPending = maxPending;
    this.pending = 0;
    this.tail = Promise.resolve();
  }
  // runs jobs one at a time; rejects immediately when too many are waiting
  run(job) {
    if (this.pending >= this.maxPending) return Promise.reject(new BusyError());
    this.pending += 1;
    const result = this.tail.then(job);
    this.tail = result.then(
      () => {},
      () => {},
    );
    return result.finally(() => {
      this.pending -= 1;
    });
  }
}

// loads a resource once; after a failure it may be retried following a cooldown
function lazy(load, cooldownMs = 60000) {
  let promise = null;
  let failedAt = 0;
  return () => {
    if (promise && failedAt && Date.now() - failedAt < cooldownMs)
      return promise;
    if (!promise || failedAt) {
      failedAt = 0;
      promise = load().catch((err) => {
        failedAt = Date.now();
        throw err;
      });
    }
    return promise;
  };
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms} ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function createBackend(cfg) {
  const loadLibrary = lazy(async () => {
    const lib = await import('@huggingface/transformers');
    lib.env.cacheDir = cfg.cacheDir;
    lib.env.allowRemoteModels = !cfg.offline;
    return lib;
  });

  const loadEmbedder = lazy(async () => {
    const { pipeline } = await loadLibrary();
    return pipeline('feature-extraction', cfg.embedModel, { dtype: 'q8' });
  });

  const loadGenerator = lazy(async () => {
    const { pipeline } = await loadLibrary();
    return pipeline('text-generation', cfg.llmModel, { dtype: cfg.llmDtype });
  });

  const embedQueue = new Queue(64);
  const generateQueue = new Queue(cfg.maxQueue);
  const state = {
    embedderReady: false,
    generatorReady: false,
    lastError: null,
  };

  return {
    capabilities() {
      return {
        embeddings: cfg.enabled,
        llm: cfg.enabled && cfg.llmEnabled,
        embedModel: cfg.embedModel,
        llmModel: cfg.llmEnabled ? cfg.llmModel : null,
        embedderReady: state.embedderReady,
        generatorReady: state.generatorReady,
        queued: generateQueue.pending,
      };
    },

    /** @returns {Promise<Float32Array[]>} L2-normalised embeddings, one per text */
    async embed(texts) {
      if (!cfg.enabled) throw new Error('AI features are disabled.');
      return embedQueue.run(async () => {
        try {
          const extractor = await loadEmbedder();
          state.embedderReady = true;
          const out = await extractor(texts, {
            pooling: 'mean',
            normalize: true,
          });
          return out.tolist().map((row) => Float32Array.from(row));
        } catch (err) {
          state.lastError = String(err.message || err);
          throw err;
        }
      });
    },

    /** @returns {Promise<string>} the assistant's reply (greedy decoding, deterministic) */
    async generate(messages, { maxNewTokens = cfg.maxNewTokens } = {}) {
      if (!cfg.enabled || !cfg.llmEnabled)
        throw new Error('The language model is disabled.');
      return generateQueue.run(() =>
        withTimeout(
          (async () => {
            try {
              const generator = await loadGenerator();
              state.generatorReady = true;
              const out = await generator(messages, {
                max_new_tokens: maxNewTokens,
                do_sample: false,
                repetition_penalty: 1.1,
              });
              return String(out[0].generated_text.at(-1).content);
            } catch (err) {
              state.lastError = String(err.message || err);
              throw err;
            }
          })(),
          cfg.generationTimeoutMs,
          'generation',
        ),
      );
    },

    lastError: () => state.lastError,
  };
}

module.exports = { createBackend, BusyError, Queue };
