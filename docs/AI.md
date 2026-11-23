# AI study helper

Mutorials includes optional AI features that run **on the site's own server** with open-weight models from the Hugging Face Hub, executed through [Transformers.js](https://huggingface.co/docs/transformers.js) (ONNX Runtime, CPU). No question text, answer or user data is sent to any third-party AI service.

| Feature                                                       | Model                                       | Default              | Where                 |
| ------------------------------------------------------------- | ------------------------------------------- | -------------------- | --------------------- |
| Related questions after answering                             | `Xenova/all-MiniLM-L6-v2` (q8, about 23 MB) | on                   | `GET /ai/related/:id` |
| Duplicate check for question authors (live and pending banks) | same                                        | on                   | `POST /ai/duplicates` |
| Hint before answering                                         | `onnx-community/Qwen2.5-1.5B-Instruct` (q4) | **off** (`AI_LLM=1`) | `POST /ai/tutor`      |
| "Explain it simply" and "Why was I wrong?" after answering    | same                                        | **off**              | `POST /ai/tutor`      |

Models download on first use into `AI_CACHE_DIR` (default `.cache/models`, git-ignored). Set `AI_OFFLINE=1` to forbid downloads and use only what is already cached.

## Design principle: the model rephrases, it does not decide

Every question already has a human-written answer and explanation. The tutor therefore never asks a model to solve anything. It is given the question, the choices and the author's explanation as data and asked to rephrase, nudge or contrast. Because small models are fluent but unreliable, **no generated text is shown unchecked**:

1. **Grounded prompt.** Question content is wrapped in tags and declared to be data; the model has no tools and no access to anything else.
2. **Output guards** (`utils/ai/guards.js`). Output is rejected when it:
   - is too short or too long, contains a URL, or is a refusal or meta-comment;
   - for hints, reveals the correct answer or says "the answer is";
   - for explanations, does not state the correct answer;
   - contains a number that appears nowhere in the question, choices or explanation (integers up to 10 are tolerated).
3. **Deterministic fallback.** A rejected or failed generation is replaced by the author's explanation (or a generic hint naming the unit). The feature can degrade; it can never be worse than the baseline.
4. **Access control.** Hints are available at any time. Explanations reveal the answer, so `/ai/tutor` refuses them until the user has answered that question.
5. **Cache.** Results are cached in MongoDB (`aiCache`) keyed by model, mode, question content hash and, for "why wrong", the chosen answer. Editing a question changes its hash. Each question is generated once; later users get an instant answer. Failed generations are cached for 24 hours so a bad question does not burn CPU repeatedly.
6. **Resource limits.** One generation runs at a time, at most `AI_MAX_QUEUE` (default 4) wait, each is capped at `AI_MAX_NEW_TOKENS` (160) and `AI_TIMEOUT_MS` (120 s); requests are rate limited. When the queue is full the user gets the fallback immediately.
7. **Rendering.** The browser inserts model output with `textContent`, so it can never inject markup.

### Prompt injection

Question text is written by contributors, so it is untrusted. It reaches the model only inside `<question>`, `<choices>` and `<reference_explanation>` tags; the system prompt says to ignore instructions inside them. This is a mitigation, not a guarantee, so the guards are the real defence: output that was steered off task (for example "PWNED", or a link) fails the answer and URL checks and is replaced by fallback text (covered by `tests/ai.test.js`). The model cannot take actions, so the worst case is a wasted generation.

## Measured behaviour (pilot)

`node scripts/ai-eval.js <model> ...` runs a model over 10 hand-written physics, chemistry and biology questions in the three modes (30 generations per model, greedy decoding, 2 vCPU / 8 GB machine, q4 weights). **This is a pilot for choosing a default, not a benchmark:** n = 10 questions, one run, and "passed guards" means the output survived the automatic checks, not that a human judged it correct or well explained.

| Model                 | Mode           | Passed guards | Median latency (s) |
| --------------------- | -------------- | ------------- | ------------------ |
| Qwen2.5-1.5B-Instruct | explain simply | 8/10          | 39.8               |
| Qwen2.5-1.5B-Instruct | hint           | 8/10          | 12.9               |
| Qwen2.5-1.5B-Instruct | why wrong      | 9/10          | 36.8               |
| Qwen2.5-0.5B-Instruct | explain simply | 9/10          | 11.6               |
| Qwen2.5-0.5B-Instruct | hint           | 8/10          | 4.6                |
| Qwen2.5-0.5B-Instruct | why wrong      | 5/10          | 19.0               |
| SmolLM2-360M-Instruct | explain simply | 5/10          | 5.0                |
| SmolLM2-360M-Instruct | hint           | 7/10          | 5.8                |
| SmolLM2-360M-Instruct | why wrong      | 5/10          | 10.5               |

Overall guard pass rate: 25/30 (1.5B), 22/30 (0.5B), 17/30 (360M). Dominant failure: the output did not state the correct answer (3, 6 and 10 failures respectively), followed by hints that leaked the answer.

What this means:

- The guards earn their keep. In a first spot check, SmolLM2-360M stated 9.8 m/s² for a problem whose reference explanation derives 4.9 m/s², and the answer guard rejects exactly that.
- A guard pass is a necessary, not sufficient, condition: a fluent paragraph can contain the right number and still explain it poorly. The label "AI-generated. Verify against the explanation above." is shown for that reason.
- 1.5B is more reliable than 0.5B on the harder "why wrong" task but is several times slower. With the cache the cost is paid once per question and mode, so for a bank of N questions the worst-case warm-up is about N x 40 s of CPU, which can be spread over time.
- Larger instruction-tuned models (3B and up) would likely improve quality but need a GPU or much more CPU than a typical shared host.

To trade quality for speed on small hosts set `AI_LLM_MODEL=onnx-community/Qwen2.5-0.5B-Instruct`. Re-run `scripts/ai-eval.js` after changing models or guards.

## Operations

- **Memory:** the 1.5B q4 model is expected to need on the order of 1 to 2 GB of RAM while loaded and the embedder a few hundred MB (not precisely measured yet; check on your host). Shared hosting plans may not allow this; the embedding features alone are lightweight.
- **First start:** the similarity index builds in the background on first use and persists vectors in the `aiEmbeddings` collection, so restarts only embed new or edited questions. The index refreshes at most every 10 minutes.
- **Disabling:** `AI_ENABLED=0` removes every AI element from the UI (the front end checks `/ai/status`). Leaving `AI_LLM` unset keeps only the embedding features.
- **Privacy:** only the question bank text is embedded; user answers are used only to build the "why wrong" prompt and are never stored by the AI layer except as part of the cache key.

## Ideas not built yet

- A study-coach view that turns the new `attempts` log into per-unit weak-spot recommendations.
- Semantic search over the whole bank (the index already supports it).
- Pre-generation of explanations for the whole bank as an off-peak batch job.
- Human evaluation of explanation quality with a larger question set.
