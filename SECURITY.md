# Security

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through GitHub's "Report a vulnerability" button on the Security tab of this repository, or email the maintainers listed on the project website. We aim to acknowledge reports within a few days.

## Security model

- **Secrets**: no credentials in source. Database URL, session secret, mail and webhook credentials come from environment variables (see the README). Production refuses to start without `DB_URL`.
- **Passwords**: scrypt (N=2^15, r=8, p=3) with per-user salts and constant-time comparison. Accounts created before this scheme (PBKDF2-SHA512, 10,000 iterations) still log in and are upgraded to scrypt on their next successful login. Passwords are limited to 128 characters.
- **Password reset**: 10-character codes from an unambiguous alphabet, stored only as SHA-256 hashes, valid for 15 minutes, limited to 5 attempts, and consumed on use. Responses never reveal whether an email is registered.
- **Injection**: request bodies containing MongoDB operator keys (`$ne`, `$where`, ...) are rejected, and handlers coerce inputs to strings and validate object ids.
- **CSRF**: session cookies are `HttpOnly` and `SameSite=Lax` (plus `Secure` in production), and state-changing requests carrying a cross-site `Sec-Fetch-Site` or `Origin` header are refused.
- **Headers and abuse controls**: helmet defaults, HTTPS redirect in production, rate limits on login, registration, password reset, contact and AI endpoints.
- **Authorization**: admin access requires an admin email address and a verified email; class management requires owning the class; contributors can read only their own statistics; authors cannot review their own questions.
- **AI features**: models run locally, the generative model has no tools, contributor-authored text is passed as fenced data, output is validated before display and rendered with `textContent`. See [docs/AI.md](docs/AI.md).

## Known limitations

- The Content-Security-Policy is deliberately partial (`object-src`, `base-uri`, `frame-ancestors`, `form-action`). The views still rely on inline scripts and several CDNs, so a strict `script-src` is future work.
- Passwords still require a letter and a digit, as before. Current NIST guidance prefers length over composition rules; this is a product decision left unchanged.
- Admin addresses are listed in the public repository as a default. Set `ADMIN_EMAILS` in production.
- Credentials that were committed before this branch (MongoDB URI, Discord webhook) remain in git history until rotated and the history is purged.
