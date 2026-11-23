// Small HTTP helpers shared by routes.

// returns the value only if it is a plain string, otherwise ''
function asString(value) {
  return typeof value === 'string' ? value : '';
}

// only same-site, path-only redirect targets are allowed (prevents open redirects)
function safeLocalPath(target, fallback = '/') {
  if (
    typeof target !== 'string' ||
    !target.startsWith('/') ||
    target.startsWith('//') ||
    target.startsWith('/\\') ||
    /[\r\n\t]/.test(target)
  ) {
    return fallback;
  }
  return target;
}

// replacement for the removed res.redirect('back'): only follows a same-host Referer
function redirectBack(req, res, fallback = '/') {
  const referer = req.get('Referer');
  if (referer) {
    try {
      const url = new URL(referer);
      if (url.host === req.get('host')) {
        return res.redirect(url.pathname + url.search);
      }
    } catch {
      // fall through to the fallback
    }
  }
  return res.redirect(fallback);
}

// wraps an async handler so rejections reach Express' error handler
function wrap(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = { asString, safeLocalPath, redirectBack, wrap };
