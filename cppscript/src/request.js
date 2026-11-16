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
/** 无协议则补 https://；http:// 升为 https://（localhost/内网除外） */
export function ensureHttps(raw) {
  let s = String(raw || '').trim();
  if (!s) return s;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol === 'http:') {
      const h = u.hostname.toLowerCase();
      if (h !== 'localhost' && h !== '127.0.0.1' && h !== '[::1]') {
        u.protocol = 'https:';
      }
      return u.href;
    }
    return u.href;
  } catch {
    return s;
  }
}

export async function doRequest(url, opts = {}, env) {
  let finalUrl = ensureHttps(url);

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
    signal: opts.signal || AbortSignal.timeout(15000),
  };
  if (opts.body != null && init.method !== 'GET') {
    init.body = opts.body;
  }

  // 5. 请求（浏览器可通过 env.FETCH_VIA 走同源代理，避免 CORS）
  let res;
  if (env && env.FETCH_VIA) {
    try {
      const viaUrl = env.FETCH_VIA + encodeURIComponent(finalUrl);
      const viaInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: finalUrl,
          method: init.method || 'GET',
          headers: headers,
          body: opts.body != null && init.method !== 'GET' ? String(opts.body) : null,
        }),
        signal: AbortSignal.timeout(15000),
      };
      res = await fetch(viaUrl, viaInit);
      // 代理本身 404 时回退直连
      if (res.status === 404) res = null;
    } catch {
      res = null;
    }
  }
  if (!res) {
    res = await fetch(finalUrl, init);
  }

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