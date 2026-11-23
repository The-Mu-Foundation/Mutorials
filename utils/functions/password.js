const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const pbkdf2 = promisify(crypto.pbkdf2);

// scrypt parameters from the OWASP Password Storage Cheat Sheet
// (N=2^15, r=8, p=3 is one of the listed equivalent configurations, ~32 MiB).
const SCRYPT = { logN: 15, r: 8, p: 3, keyLength: 64 };
const SCRYPT_PREFIX = `scrypt$${SCRYPT.logN}$${SCRYPT.r}$${SCRYPT.p}$`;

// Legacy format used by every account created before this module existed.
const LEGACY = { iterations: 10000, keyLength: 64, digest: 'sha512' };

const MAX_PASSWORD_LENGTH = 128;

function scryptOptions(logN, r, p) {
  const N = 2 ** logN;
  return { N, r, p, maxmem: 256 * N * r };
}

// returns an error message if the password is unacceptable, otherwise null
function passwordPolicyError(password) {
  if (typeof password !== 'string') {
    return 'The password you entered does not meet the requirements.';
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Passwords can be at most ${MAX_PASSWORD_LENGTH} characters long.`;
  }
  if (
    password.length < 7 ||
    !/\d/.test(password) ||
    !/[a-zA-Z]/.test(password)
  ) {
    return 'The password you entered does not meet the requirements.';
  }
  return null;
}

// hashes a plain text password; returns { salt, hash } ready to store on a user
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(
    password,
    salt,
    SCRYPT.keyLength,
    scryptOptions(SCRYPT.logN, SCRYPT.r, SCRYPT.p),
  );
  return { salt, hash: SCRYPT_PREFIX + derived.toString('hex') };
}

// constant-time comparison of two hex strings
function safeEqualHex(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// checks a plain text password against a stored hash (new scrypt or legacy PBKDF2)
async function verifyPassword(password, storedHash, salt) {
  if (
    typeof password !== 'string' ||
    password.length > MAX_PASSWORD_LENGTH * 4 ||
    typeof storedHash !== 'string' ||
    typeof salt !== 'string'
  ) {
    return false;
  }

  if (storedHash.startsWith('scrypt$')) {
    const [, logN, r, p, hex] = storedHash.split('$');
    const derived = await scrypt(
      password,
      salt,
      hex.length / 2,
      scryptOptions(Number(logN), Number(r), Number(p)),
    );
    return safeEqualHex(derived.toString('hex'), hex);
  }

  const derived = await pbkdf2(
    password,
    salt,
    LEGACY.iterations,
    LEGACY.keyLength,
    LEGACY.digest,
  );
  return safeEqualHex(derived.toString('hex'), storedHash);
}

// true if the stored hash predates the current parameters and should be upgraded
function needsRehash(storedHash) {
  return (
    typeof storedHash !== 'string' || !storedHash.startsWith(SCRYPT_PREFIX)
  );
}

module.exports = {
  hashPassword,
  verifyPassword,
  needsRehash,
  passwordPolicyError,
  MAX_PASSWORD_LENGTH,
};
