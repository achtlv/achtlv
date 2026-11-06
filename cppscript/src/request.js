// request.js
import { fail } from './errors.js';
import { assertSafeUrl } from './sandbox.js';

/* ---------- 主函数 return 的 URL 规范化 ---------- */
export function normalizeReturnUrl(raw) {
  if (!raw) fail(400, 'main return string is empty', 'E43');

  let protocol = null;
  let rest = raw;

  const m = /^(https?):\/\//i.exec(raw);
  if (m) {
    protocol = m[1].toLowerCase();
    rest = raw.slice(m[0].length);
  }

  let end = rest.length;
  const slash = rest.indexOf('/');
  if (slash >= 0 && slash < end) end = slash;
  const colon = rest.indexOf(':');
  if (colon >= 0 && colon < end) end = colon;
  const hostRaw = rest.slice(0, end);

  if (hostRaw.length === 0) fail(400, 'empty host', 'E43');

  const HOST_ILLEGAL = /[\s\x00-\x1F\x7F<>"{}|\\^\[\]`@#?]/;
  if (HOST_ILLEGAL.test(hostRaw)) {
    fail(400, `illegal character in host: ${hostRaw}`, 'E43');
  }

  if (colon >= 0 && colon < slashOrEnd(rest, colon)) {
    const portStr = rest.slice(colon + 1, endAfterPort(rest, colon));
    if (!/^\d+$/.test(portStr)) fail(400, `illegal port: ${portStr}`, 'E43');
    const port = parseInt(portStr, 10);
    if (port < 1 || port > 65535) fail(400, `port out of range: ${port}`, 'E43');
  }

  if (!protocol) {
    const h = hostRaw.toLowerCase();
    protocol = (h.endsWith('.onion') || h.endsWith('.i2p')) ? 'http' : 'https';
  }

  let url;
  try {
    url = new URL(protocol + '://' + rest);
  } catch {
    fail(400, `cannot parse return URL: ${raw}`, 'E43');
  }
  return url.href;
}

function slashOrEnd(s, colon) {
  const slash = s.indexOf('/');
  return slash < 0 ? s.length : slash;
}

function endAfterPort(s, colon) {
  const slash = s.indexOf('/', colon);
  return slash < 0 ? s.length : slash;
}

/* ---------- 请求执行 ---------- */
export async function doRequest(url, opts = {}, env) {
  let finalUrl = url;

  // 1. 合并 params 到 URL
  if (opts.params && Object.keys(opts.params).length > 0) {
    let u;
    try {
      u = new URL(finalUrl);
    } catch {
      fail(400, `cannot parse URL for params: ${finalUrl}`, 'E27');
    }
    for (const [k, v] of Object.entries(opts.params)) {
      u.searchParams.set(k, v);
    }
    finalUrl = u.toString();
  }

  // 2. 拼接 proxy 前缀
  if (opts.proxy) {
    finalUrl = opts.proxy.replace(/\/+$/, '') + '/' + finalUrl;
  }

  // 3. SSRF 检查（检查最终 URL）
  assertSafeUrl(finalUrl, env);

  // 4. 组装 headers
  const headers = { ...(opts.headers || {}) };
  if (opts.ua) headers['User-Agent'] = opts.ua;

  const init = {
    method: opts.method || 'GET',
    headers,
    signal: AbortSignal.timeout(10000),
  };
  if (opts.body != null && init.method !== 'GET') {
    init.body = opts.body;
  }

  // 5. 请求
  const res = await fetch(finalUrl, init);

  // 6. 读取响应体（限制 5MB）
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 5 * 1024 * 1024) fail(502, 'response exceeds 5MB', 'E51');
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  const text = new TextDecoder().decode(buf);

  return { status: res.status, body: text, headers: res.headers };
}