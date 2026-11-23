// Security middleware: headers, CSRF defense, operator-injection guard, rate limits.
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { isProduction, isTest } = require('../config');

// Helmet defaults, plus a CSP limited to directives that cannot break existing
// pages (the views still rely on inline scripts and several CDNs).
function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      // deliberately no default-src: see the comment above
      directives: {
        defaultSrc: helmet.contentSecurityPolicy.dangerouslyDisableDefaultSrc,
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProduction,
  });
}

// redirects plain HTTP to HTTPS in production (trust proxy must be enabled)
function enforceHttps(req, res, next) {
  if (isProduction && !req.secure) {
    return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
  }
  next();
}

// CSRF defense for cookie-authenticated, state-changing requests. Combined with
// SameSite=Lax session cookies this blocks cross-site form posts without
// requiring a token in every template: browsers always send Sec-Fetch-Site /
// Origin on cross-site unsafe requests.
function sameOriginGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const fetchSite = req.get('Sec-Fetch-Site');
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) {
    return res.status(403).send('Cross-site request blocked.');
  }
  const origin = req.get('Origin');
  if (origin && origin !== 'null') {
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      return res.status(403).send('Cross-site request blocked.');
    }
    if (originHost !== req.get('host')) {
      return res.status(403).send('Cross-site request blocked.');
    }
  } else if (origin === 'null') {
    return res.status(403).send('Cross-site request blocked.');
  }
  next();
}

// finds MongoDB operator keys ($where, $ne, ...) anywhere in a parsed structure
function containsOperatorKey(value, depth = 0) {
  if (depth > 10 || value === null || typeof value !== 'object') {
    return false;
  }
  return Object.keys(value).some(
    (key) => key.startsWith('$') || containsOperatorKey(value[key], depth + 1),
  );
}

// rejects NoSQL operator injection in request bodies and query strings and makes
// sure req.body is always an object (Express 5 leaves it undefined otherwise)
function rejectOperatorInjection(req, res, next) {
  req.body = req.body || {};
  if (containsOperatorKey(req.body) || containsOperatorKey(req.query)) {
    return res.status(400).send('Invalid request.');
  }
  next();
}

// builds a rate limiter; disabled under test unless a test opts in
function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message:
      message || 'Too many requests. Please slow down and try again later.',
    skip: () => isTest && !process.env.TEST_RATE_LIMIT,
  });
}

const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

const passwordResetLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: 'Too many reset attempts. Please try again in an hour.',
});

const contactLimiter = limiter({ windowMs: 60 * 60 * 1000, limit: 5 });

const generalLimiter = limiter({ windowMs: 60 * 1000, limit: 300 });

module.exports = {
  securityHeaders,
  enforceHttps,
  sameOriginGuard,
  rejectOperatorInjection,
  containsOperatorKey,
  limiter,
  authLimiter,
  passwordResetLimiter,
  contactLimiter,
  generalLimiter,
};
