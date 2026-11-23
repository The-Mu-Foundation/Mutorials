# [Mutorials](https://www.mutorials.org/)

[![discord](https://img.shields.io/discord/682073068440780810?color=blue&label=discord&style=for-the-badge)](https://discord.gg/vTrEprkTpz)

Mutorials is a free, adaptive, open-source trainer for science students, created by The Mu Foundation, a 501(c)(3) nonprofit. Please see our website for more info :)

## Quick start

Requirements: Node 22 and a MongoDB instance (local or Atlas).

```bash
npm install
cp .env.example .env      # then edit it; see the table below
npm run build             # compile Tailwind CSS (or `npm run dev` to watch)
npm start                 # http://localhost:3000
```

| Command                                 | What it does                                                           |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `npm test`                              | Unit and integration tests; uses an in-memory MongoDB, no setup needed |
| `npm run lint` / `npm run format:check` | ESLint 9 (flat config) and Prettier                                    |
| `npm run check`                         | Lint, format check and tests, as CI runs them                          |
| `npm run audit:prod`                    | Audit production dependencies                                          |

### Configuration

All configuration is read through [`utils/config.js`](utils/config.js). No secrets live in the repository.

| Variable                                                       | Required      | Purpose                                                                                                                           |
| -------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `DB_URL`                                                       | In production | MongoDB connection string. Development defaults to `mongodb://127.0.0.1:27017/mutorials`; production refuses to start without it. |
| `SESSION_SECRET`                                               | In production | Signs session cookies. If unset in production a random per-process secret is used and sessions reset on every restart.            |
| `PORT`                                                         | No            | HTTP port (default 3000). Any other value is treated as a hosted/production deployment.                                           |
| `ADMIN_EMAILS`                                                 | No            | Semicolon-separated admin email addresses (overrides the built-in list). Admins must also have a verified email.                  |
| `MAILGUN_CREDENTIALS`                                          | No            | SMTP password for password-reset email.                                                                                           |
| `DISCORD_WEBHOOK_URL`                                          | No            | Where the contact/feedback form posts. Disabled when unset.                                                                       |
| `AI_ENABLED`                                                   | No            | `0` disables all AI features. Embedding features (related questions, duplicate checks) are on by default.                         |
| `AI_LLM`                                                       | No            | `1` enables the generative tutor (hints and simplified explanations). See [docs/AI.md](docs/AI.md).                               |
| `AI_LLM_MODEL`, `AI_EMBED_MODEL`, `AI_CACHE_DIR`, `AI_OFFLINE` | No            | Model selection and cache location; see [docs/AI.md](docs/AI.md).                                                                 |

## AI study helper

Mutorials includes optional AI features that run on the server itself with open-weight models from Hugging Face. No question text or user data is sent to a third-party AI service. They provide related-question suggestions, duplicate detection for question authors, and (opt-in) hints and simplified explanations that are checked against the author's own explanation before they are shown. Details, hardware requirements and measured model behaviour are in [docs/AI.md](docs/AI.md).

## Security

See [SECURITY.md](SECURITY.md) for the security model and how to report a vulnerability.

## Helping Mutorials

We're happy that you want to help us! Below is a quick overview of how to do so.

### Providing Feedback

The development team is available for feedback at our [Discord server](https://tinyurl.com/joinmutorials).

### Reporting Issues / Feature Request

If you've found a bug or would like to propose a feature request, first look at [GitHub Issues](https://github.com/The-Mu-Foundation/Mutorials/issues) to see if someone else has already done so. If so, and if you have additional information, please add that information as a comment. If not, please [open an issue in GitHub](https://github.com/The-Mu-Foundation/Mutorials/issues/new).

- Please file a single issue per problem and feature request. Do not list multiple bugs or feature requests in the same issue.
- Provide as much information as you can. The more information you give us, the more likely we'll be able to fix it.

Please include the following information in each issue:

- Date of bug
- Your operating system
- Your browser (and a list of extensions if possible)
- Reproducible steps that cause the issue (First I did this, then that...)
- A screenshot or screen recording of the issue
- If you can: open the developer console and paste any issues that pop up there.

We might ask for additional information to help us fix the bug. Please check back on your issue every few days. We typically will close issues if there has been no response to follow-up questions within 7 days.

### Contributing to Mutorials as a programmer

Please see [our contributor documentation](/CONTRIBUTING.md) to get started.

Thanks!

Ved Thiru (@PerpetualCreativity on GitHub, vulcan#0604 on Discord)
