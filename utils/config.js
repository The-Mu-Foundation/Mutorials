// Central, validated runtime configuration. All environment access that affects
// security or deployment behavior should go through this module.
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// Same heuristic the app has always used (any non-default PORT means a hosted
// deployment), plus the standard NODE_ENV switch.
const isTest = process.env.NODE_ENV === 'test';
const isProduction =
  !isTest && (process.env.NODE_ENV === 'production' || Number(PORT) !== 3000);

// Session secret: never fall back to a publicly known value in production.
// If it is missing we generate an ephemeral one (sessions reset on restart)
// and complain loudly rather than taking the site down.
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProduction) {
    console.error(
      '[config] SESSION_SECRET is not set. Using a random per-process secret; ' +
        'all sessions will be invalidated on every restart. Set SESSION_SECRET.',
    );
    sessionSecret = crypto.randomBytes(32).toString('hex');
  } else {
    sessionSecret = 'insecure-development-secret';
  }
}

// Database: no credentials are ever embedded in source. Production must provide
// DB_URL; development defaults to a local MongoDB.
function getDatabaseUrl() {
  if (process.env.DB_URL) {
    return process.env.DB_URL;
  }
  if (isProduction) {
    throw new Error(
      'DB_URL is not set. Refusing to start without an explicit database URL.',
    );
  }
  return 'mongodb://127.0.0.1:27017/mutorials';
}

module.exports = {
  PORT,
  isProduction,
  isTest,
  sessionSecret,
  getDatabaseUrl,
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  sessionMaxAgeMs: 14 * 24 * 60 * 60 * 1000,
};
