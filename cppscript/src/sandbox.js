// sandbox.js
import { fail } from './errors.js';

const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|::1|fc|fd|fe80)/i;

export function assertSafeUrl(raw, env) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(400, `invalid URL: ${raw}`, 'E27');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    fail(400, `protocol not allowed: ${url.protocol}`, 'E27');
  }

  const host = url.hostname.toLowerCase();
  if (PRIVATE_HOST_RE.test(host)) {
    fail(403, `private address blocked: ${host}`, 'E27');
  }

  const allowed = (env.ALLOWED_DOMAINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length && !allowed.some((d) => host === d || host.endsWith('.' + d))) {
    fail(403, `domain not in allowlist: ${host}`, 'E27');
  }

  return url;
}