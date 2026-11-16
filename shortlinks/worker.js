// ===== 工具函数 =====
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function pad2(n) { return n < 10 ? "0" + n : "" + n; }

function fmtDate(ts) {
  var d = new Date(ts);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " +
         pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

function firstLineRemark(s) {
  if (typeof s !== "string" || s === "") return "";
  var v = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  var idx = v.indexOf("\n");
  if (idx === -1) return v;
  return v.slice(0, idx) + "…";
}

function noCacheHeaders(extra) {
  const h = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0"
  };
  if (extra) for (const k in extra) h[k] = extra[k];
  return h;
}

function htmlResponse(body, status) {
  return new Response(body, {
    status: status || 200,
    headers: noCacheHeaders({ "Content-Type": "text/html; charset=utf-8" })
  });
}

function redirectResponse(url, statusCode, extraHeaders) {
  var code = (statusCode === 303 || statusCode === 307) ? statusCode : 302;
  const h = noCacheHeaders({ "Location": url });
  if (extraHeaders) for (const k in extraHeaders) h[k] = extraHeaders[k];
  return new Response(null, { status: code, headers: h });
}

function notFoundResponse() {
  return new Response("Not Found", {
    status: 404,
    headers: noCacheHeaders({ "Content-Type": "text/plain; charset=utf-8" })
  });
}

function applyParam(baseUrl, pValue) {
  if (typeof pValue !== "string" || pValue === "") return baseUrl;
  var safe = pValue.replace(/[\r\n]/g, "");
  var needsSlash = /^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\/[^\/?#]+$/.test(baseUrl);
  var result = baseUrl + (needsSlash ? "/" : "") + safe;
  result = result.replace(/([^:]\/)\/+/g, "$1");
  return result;
}

function normalizeStatusCode(v) {
  if (v === 303 || v === "303") return 303;
  if (v === 307 || v === "307") return 307;
  return 302;
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: noCacheHeaders({ "Content-Type": "application/json; charset=utf-8" })
  });
}

// ===== 数据解析 =====
function parseEntry(raw) {
  if (!raw) return null;
  if (raw.charAt(0) === "{") {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.url === "string") {
        return {
          url: obj.url,
          password: typeof obj.password === "string" ? obj.password : "",
          expiresAt: typeof obj.expiresAt === "number" ? obj.expiresAt : 0,
          paused: obj.paused === true,
          expireAction: obj.expireAction === "delete" ? "delete" : "pause",
          statusCode: normalizeStatusCode(obj.statusCode),
          remark: typeof obj.remark === "string" ? obj.remark : "",
          updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : 0
        };
      }
    } catch (e) {}
  }
  return {
    url: raw, password: "", expiresAt: 0, paused: false,
    expireAction: "pause", statusCode: 302, remark: "", updatedAt: 0
  };
}

function normalizeTarget(value) {
  if (typeof value !== "string") return null;
  var v = value.replace(/^\s+|\s+$/g, "");
  if (!v) return null;
  if (/[\r\n]/.test(v)) return null;
  if (/^(javascript|data|vbscript|file):/i.test(v)) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(v)) return v;
  return "https://" + v;
}

function parseLocalDateTime(s) {
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})$/.exec(s);
  if (!m) return null;
  var d = new Date(
    parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10),
    parseInt(m[4], 10), parseInt(m[5], 10), 0, 0
  );
  var t = d.getTime();
  if (isNaN(t)) return null;
  return t;
}

// ===== 路径规范化与校验 =====
var RESERVED_PREFIXES = ["/l"];

function normalizeKey(key) {
  if (typeof key !== "string") return null;
  var s = key.replace(/^\s+|\s+$/g, "");
  if (!s) return null;
  var stripped = s.replace(/^\/+/, "");
  if (!stripped) return "/";
  return "/" + stripped;
}

function isValidKey(key) {
  if (!key) return false;
  if (key === "/") return true;
  return /^\/[a-zA-Z0-9]+$/.test(key);
}

function isReserved(key) {
  if (!key) return false;
  for (var i = 0; i < RESERVED_PREFIXES.length; i++) {
    var p = RESERVED_PREFIXES[i];
    if (key === p || key.indexOf(p + "/") === 0) return true;
  }
  return false;
}

// ===== Cookie 与角色 =====
function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const parts = cookie.split(";");
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (p.indexOf(name + "=") === 0) {
      try { return decodeURIComponent(p.slice(name.length + 1)); }
      catch (e) { return p.slice(name.length + 1); }
    }
  }
  return null;
}

function getRoleFromPassword(pwd, env) {
  if (!pwd) return null;
  if (env.ADMIN_PASSWORD && pwd === env.ADMIN_PASSWORD) return "admin";
  if (env.GUEST_PASSWORD && pwd === env.GUEST_PASSWORD) return "guest";
  return null;
}

function getRole(request, env) {
  return getRoleFromPassword(getCookie(request, "sl_auth"), env);
}

// ===== MD3 风格样式 =====
function baseCSS() {
  return `
    @import url('https://fonts.font.im/css?family=Roboto:400,500,700&display=swap');
    @import url('https://fonts.font.im/css?family=Noto+Sans+SC:400,500,700&display=swap');

    :root {
      color-scheme: light dark;
      --md-sys-color-primary: #1B5E20;
      --md-sys-color-on-primary: #FFFFFF;
      --md-sys-color-primary-container: #A5D6A7;
      --md-sys-color-on-primary-container: #002106;
      --md-sys-color-secondary: #4A6350;
      --md-sys-color-on-secondary: #FFFFFF;
      --md-sys-color-secondary-container: #CCE8D0;
      --md-sys-color-on-secondary-container: #062014;
      --md-sys-color-tertiary: #3B6653;
      --md-sys-color-error: #BA1A1A;
      --md-sys-color-on-error: #FFFFFF;
      --md-sys-color-error-container: #FFDAD6;
      --md-sys-color-on-error-container: #410002;
      --md-sys-color-surface: #F7FBF1;
      --md-sys-color-on-surface: #191C19;
      --md-sys-color-surface-variant: #DDE5D9;
      --md-sys-color-on-surface-variant: #414941;
      --md-sys-color-outline: #717970;
      --md-sys-color-outline-variant: #C1C9BF;
      --md-sys-color-surface-container: #EBF0E7;
      --md-sys-color-surface-container-low: #F1F6ED;
      --md-sys-color-surface-container-high: #E5EAE1;
      --md-sys-color-surface-container-highest: #DFE4DB;
      --md-sys-color-inverse-surface: #2E312E;
      --md-sys-color-inverse-on-surface: #EFF1EB;
      --md-sys-shape-corner-small: 10px;
      --md-sys-shape-corner-medium: 14px;
      --md-sys-shape-corner-large: 18px;
      --md-sys-shape-corner-extra-large: 28px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --md-sys-color-primary: #81C784;
        --md-sys-color-on-primary: #003910;
        --md-sys-color-primary-container: #0B4A16;
        --md-sys-color-on-primary-container: #A5D6A7;
        --md-sys-color-secondary: #B0CCB4;
        --md-sys-color-on-secondary: #1C3526;
        --md-sys-color-secondary-container: #334B3B;
        --md-sys-color-on-secondary-container: #CCE8D0;
        --md-sys-color-tertiary: #A3CFB8;
        --md-sys-color-error: #FFB4AB;
        --md-sys-color-on-error: #690005;
        --md-sys-color-error-container: #93000A;
        --md-sys-color-on-error-container: #FFDAD6;
        --md-sys-color-surface: #111411;
        --md-sys-color-on-surface: #E1E3DD;
        --md-sys-color-surface-variant: #414941;
        --md-sys-color-on-surface-variant: #C1C9BF;
        --md-sys-color-outline: #8B938A;
        --md-sys-color-outline-variant: #414941;
        --md-sys-color-surface-container: #1B1F1B;
        --md-sys-color-surface-container-low: #161A16;
        --md-sys-color-surface-container-high: #252925;
        --md-sys-color-surface-container-highest: #303430;
        --md-sys-color-inverse-surface: #E1E3DD;
        --md-sys-color-inverse-on-surface: #2E312E;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-text-size-adjust: 100%; height: 100%; }

    body {
      font-family: "Roboto", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 16px;
      line-height: 1.55;
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      box-sizing: border-box;
      min-height: 100%;
      min-height: 100dvh;
      padding: max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
    }
    body.has-bottom-nav {
      padding-bottom: calc(80px + env(safe-area-inset-bottom));
    }

    .wrap { max-width: 800px; margin: 0 auto; width: 100%; }

    h1 { font-size: 1.55rem; font-weight: 700; margin: 0 0 1.1rem; letter-spacing: -0.01em; }
    h2 { font-size: 1.15rem; font-weight: 600; margin: 0 0 0.9rem; }

    .card {
      background: var(--md-sys-color-surface-container-low);
      border-radius: var(--md-sys-shape-corner-large);
      padding: 1.4rem 1.5rem;
      margin-bottom: 1.2rem;
    }

    label {
      display: block;
      margin: 0 0 0.35rem;
      font-size: 0.88rem;
      font-weight: 500;
      color: var(--md-sys-color-on-surface-variant);
    }

    input[type="text"],
    input[type="password"],
    select,
    textarea {
      display: block;
      width: 100%;
      padding: 0.9rem 1.1rem;
      margin: 0 0 1rem;
      font-size: 1rem;
      font-family: inherit;
      border: none;
      border-radius: var(--md-sys-shape-corner-small);
      background: var(--md-sys-color-surface-container-highest);
      color: var(--md-sys-color-on-surface);
      -webkit-appearance: none;
      appearance: none;
      transition: background 0.15s, box-shadow 0.15s;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      box-shadow: 0 0 0 2px var(--md-sys-color-primary);
    }
    textarea { resize: vertical; min-height: 80px; }
    input::placeholder, textarea::placeholder {
      color: var(--md-sys-color-on-surface-variant);
      opacity: 0.65;
    }

    button, .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.85rem 1.5rem;
      font-size: 0.95rem;
      font-weight: 600;
      font-family: inherit;
      border: 0;
      border-radius: var(--md-sys-shape-corner-extra-large);
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
      cursor: pointer;
      -webkit-appearance: none;
      appearance: none;
      margin: 0 0.45rem 0.55rem 0;
      text-decoration: none;
      text-align: center;
      transition: opacity 0.15s, transform 0.1s;
      min-height: 48px;
      line-height: 1.25;
    }
    button:active, .btn:active { opacity: 0.85; transform: scale(0.97); }
    button:hover, .btn:hover { opacity: 0.92; }

    button.del, .btn.del { background: var(--md-sys-color-error); color: var(--md-sys-color-on-error); }
    .btn.edit, .btn.tonal, .btn.refresh {
      background: var(--md-sys-color-secondary-container);
      color: var(--md-sys-color-on-secondary-container);
    }
    button.toggle { background: var(--md-sys-color-tertiary); color: #fff; }
    button.toggle.on { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
    .btn.active { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
    .btn.icon { min-width: 48px; padding: 0.75rem; }

    a.logout {
      float: right;
      background: var(--md-sys-color-surface-container-highest);
      color: var(--md-sys-color-on-surface);
      padding: 0.7rem 1.2rem;
      border-radius: var(--md-sys-shape-corner-extra-large);
      font-size: 0.9rem;
      font-weight: 600;
      text-decoration: none;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
    }

    .item { padding: 1.1rem 0; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
    .item:last-child { border-bottom: 0; }

    .field {
      margin: 0.3rem 0;
      font-size: 0.95rem;
      line-height: 1.5;
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem 0.5rem;
      align-items: baseline;
    }
    .fl {
      color: var(--md-sys-color-on-surface-variant);
      min-width: 4.2em;
      flex-shrink: 0;
      font-size: 0.88rem;
    }
    .fv { word-break: break-all; }
    .key { font-weight: 700; color: var(--md-sys-color-primary); font-size: 1.05rem; }
    .url { color: var(--md-sys-color-on-surface-variant); }
    .pwd { color: #B26A00; }
    .exp { color: #00695C; }
    .remark { color: var(--md-sys-color-on-surface-variant); font-style: italic; word-break: break-all; }
    .updated { color: var(--md-sys-color-on-surface-variant); font-size: 0.82rem; }
    .status-code { color: #5E35B1; font-weight: 600; }
    .status-on { color: #2E7D32; font-weight: 700; }
    .status-off { color: var(--md-sys-color-error); font-weight: 700; }
    .empty { color: var(--md-sys-color-outline); }
    .meta-sep { color: var(--md-sys-color-outline-variant); user-select: none; }

    .actions { margin-top: 0.85rem; display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .actions form { display: inline; margin: 0; }
    .actions button, .actions .btn { margin: 0; }

    .msg { font-size: 0.9rem; margin-top: 0.9rem; min-height: 1.3rem; font-weight: 500; }
    .msg:empty { min-height: 0; margin-top: 0; }
    .msg.err { color: var(--md-sys-color-error); }
    .msg.ok { color: #2E7D32; }

    .hint { font-size: 0.82rem; color: var(--md-sys-color-on-surface-variant); margin: 0.2rem 0 0.8rem; }

    hr { border: 0; height: 1px; background: var(--md-sys-color-outline-variant); margin: 1.1rem 0; }

    .clearfix:after { content: ""; display: table; clear: both; }
    form.inline { display: inline; margin: 0; }
    form.inline button { margin: 0; }

    .btnrow { margin: 0.8rem 0 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }

    .infobox {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      border-radius: var(--md-sys-shape-corner-medium);
      padding: 1rem 1.15rem;
      margin: 0 0 1.1rem;
      font-size: 0.95rem;
      font-weight: 500;
    }
    .infobox .row { margin: 0.25rem 0; }

    .form-row-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .form-row-2col > div { min-width: 0; }
    .form-row-2col label { margin: 0 0 0.35rem; }
    .form-row-2col select {
      margin-bottom: 0;
      padding: 0.85rem 0.9rem;
      width: 100%;
    }

    .copyable {
      cursor: pointer;
      border-bottom: 1.5px dashed var(--md-sys-color-outline);
      transition: color 0.15s, border-color 0.15s;
    }
    .copyable:hover, .copyable:active {
      color: var(--md-sys-color-primary);
      border-bottom-color: var(--md-sys-color-primary);
    }

    #copyTip {
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      min-width: 110px;
      text-align: center;
      padding: 0.7rem 1.3rem;
      border-radius: var(--md-sys-shape-corner-extra-large);
      background: var(--md-sys-color-inverse-surface);
      color: var(--md-sys-color-inverse-on-surface);
      font-size: 0.9rem;
      font-weight: 500;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s;
      z-index: 9999;
    }

    .row1, .row2, .row3 { display: flex; align-items: center; gap: 0.4rem; }
    .row1 { margin-bottom: 0.65rem; }
    .row2 { margin-bottom: 0.65rem; }
    .row3 {
      margin-top: 0.55rem;
      margin-bottom: 0.9rem;
      padding-bottom: 0.7rem;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      flex-wrap: nowrap;
      overflow: hidden;
    }
    .row1 input[type="text"] { flex: 1; margin: 0; min-width: 0; }
    .row1 button, .row2 button, .row3 button { margin: 0; flex-shrink: 0; }

    .row2 .page-size-group {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      flex-shrink: 0;
    }
    .page-size-group label { margin: 0; font-size: 0.82rem; white-space: nowrap; }
    .page-size-group input[type="text"] {
      width: 3.2rem;
      margin: 0;
      padding: 0.55rem 0.4rem;
      text-align: center;
      font-size: 0.9rem;
      min-width: 0;
    }

    .row3 .pageinfo {
      flex: 0 0 auto;
      color: var(--md-sys-color-on-surface-variant);
      font-weight: 500;
      font-size: 0.88rem;
      white-space: nowrap;
      padding: 0 0.1rem;
    }
    .row3 input[type="text"] {
      width: 3.2rem;
      margin: 0;
      padding: 0.55rem 0.4rem;
      text-align: center;
      font-size: 0.9rem;
      min-width: 0;
    }
    .row3 .btn.icon { min-width: 40px; padding: 0.5rem; min-height: 42px; }

    .bottom-nav {
      position: fixed;
      bottom: calc(20px + env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      display: flex;
      gap: 16px;
      background: transparent;
      border: 0;
      padding: 0;
      pointer-events: none;
    }
    .bottom-nav a {
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface-variant);
      text-decoration: none;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
      transition: background 0.2s, color 0.2s, transform 0.15s, box-shadow 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    .bottom-nav a:active { transform: scale(0.9); }
    .bottom-nav a.active {
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
      box-shadow: 0 4px 14px rgba(27, 94, 32, 0.35);
    }
    .bottom-nav a svg { width: 24px; height: 24px; }

    .back-to-top-btn {
      position: fixed;
      bottom: calc(20px + env(safe-area-inset-bottom));
      left: calc(50% + 108px);
      transform: translateX(-50%);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface-variant);
      border: 0;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s, background 0.2s, transform 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .back-to-top-btn.visible { opacity: 1; pointer-events: auto; }
    .back-to-top-btn:active { transform: translateX(-50%) scale(0.9); }
    .back-to-top-btn svg { width: 24px; height: 24px; }

    @media (max-width: 600px) {
      body {
        padding: 12px 12px 12px 12px;
        font-size: 15.5px;
      }
      body.has-bottom-nav {
        padding-bottom: calc(80px + env(safe-area-inset-bottom));
      }
      .wrap { max-width: 100%; }
      h1 { font-size: 1.35rem; }
      .card { padding: 1.15rem; }
      button, .btn {
        padding: 0.75rem 1.15rem;
        font-size: 0.92rem;
        min-height: 44px;
      }
      .btn.icon { min-width: 44px; padding: 0.7rem; }
      .field { font-size: 0.9rem; }
      a.logout { padding: 0.65rem 1.1rem; font-size: 0.88rem; }
    }

    @media (max-width: 400px) {
      .form-row-2col { gap: 0.5rem; }
      .form-row-2col select {
        padding: 0.7rem 0.5rem;
        font-size: 0.82rem;
      }
    }

    @media (max-width: 520px) and (max-height: 520px), (max-width: 360px) {
      body {
        padding: 8px 8px 8px 8px;
        font-size: 14px;
        line-height: 1.4;
      }
      body.has-bottom-nav {
        padding-bottom: calc(70px + env(safe-area-inset-bottom));
      }
      h1 { font-size: 1.1rem; margin-bottom: 0.6rem; }
      h2 { font-size: 0.98rem; }
      .card { padding: 0.85rem; margin-bottom: 0.7rem; border-radius: 14px; }
      label { font-size: 0.78rem; }
      input[type="text"], input[type="password"], select, textarea {
        padding: 0.55rem 0.7rem;
        margin-bottom: 0.55rem;
        font-size: 0.88rem;
      }
      button, .btn {
        padding: 0.5rem 0.85rem;
        font-size: 0.85rem;
        min-height: 38px;
        margin: 0 0.3rem 0.35rem 0;
      }
      .btn.icon { min-width: 38px; padding: 0.45rem; }
      .actions { gap: 0.3rem; }
      .field { font-size: 0.85rem; }
      .fl { min-width: 3.4em; font-size: 0.78rem; }
      .hint { font-size: 0.75rem; }
      .infobox { padding: 0.7rem; font-size: 0.85rem; }
      .item { padding: 0.6rem 0; }
      a.logout { padding: 0.5rem 0.85rem; font-size: 0.8rem; min-height: 34px; }
      .row1, .row2, .row3 { gap: 0.3rem; }
      .row1 { margin-bottom: 0.45rem; }
      .row2 { margin-bottom: 0.45rem; }
      .row3 {
        margin-top: 0.4rem;
        margin-bottom: 0.5rem;
        padding-bottom: 0.5rem;
      }
      .row3 .btn.icon { min-width: 34px; padding: 0.4rem; min-height: 36px; }
      .row3 input[type="text"], .page-size-group input[type="text"] { width: 2.8rem; padding: 0.4rem; }
      .bottom-nav { gap: 12px; bottom: calc(14px + env(safe-area-inset-bottom)); }
      .bottom-nav a { width: 48px; height: 48px; }
      .bottom-nav a svg { width: 20px; height: 20px; }
      .back-to-top-btn {
        width: 48px;
        height: 48px;
        left: calc(50% + 90px);
        bottom: calc(14px + env(safe-area-inset-bottom));
      }
      .back-to-top-btn svg { width: 20px; height: 20px; }
      .form-row-2col select { padding: 0.55rem 0.5rem; font-size: 0.8rem; }
      #copyTip { bottom: 80px; }
    }

    @media (min-width: 900px) {
      .wrap { max-width: 860px; }
      .card { padding: 1.6rem 1.7rem; }
    }
  `;
}

function pageHTML(title, body, maxWidth, bodyClass) {
  const w = maxWidth ? "max-width:" + maxWidth + ";margin-left:auto;margin-right:auto;" : "";
  const bc = bodyClass ? " " + bodyClass : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#1B5E20" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111411" media="(prefers-color-scheme: dark)">
<title>${esc(title)}</title>
<style>${baseCSS()}</style>
</head>
<body class="${bc.trim()}">
<div class="wrap" style="${w}">${body}</div>
</body>
</html>`;
}

// ===== 图标 =====
function icon(name) {
  const paths = {
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    save: '<path d="M20 6L9 17l-5-5"/>',
    refresh: '<path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',
    time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sort: '<path d="M3 6h18M3 12h12M3 18h6"/>',
    prev: '<path d="M15 18l-6-6 6-6"/>',
    next: '<path d="M9 18l6-6-6-6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z"/>',
    play: '<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    delete: '<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    enter: '<path d="M9 10l-5 5 5 5"/><path d="M20 4v7a4 4 0 01-4 4H4"/>',
    up: '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>'
  };
  const p = paths[name] || '';
  return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;flex-shrink:0;display:inline-block">' + p + '</svg>';
}

// ===== 状态码选择框 =====
function statusSelectHTML(name, current) {
  var c = normalizeStatusCode(current);
  return `<select name="${esc(name)}" title="跳转状态码">
    <option value="302"${c === 302 ? " selected" : ""}>302 默认</option>
    <option value="303"${c === 303 ? " selected" : ""}>303 强制GET</option>
    <option value="307"${c === 307 ? " selected" : ""}>307 强制保留</option>
  </select>`;
}

// ===== 登录页 =====
function renderLogin(errMsg) {
  return pageHTML("登录", `
    <div style="max-width:360px;margin:48px auto 0">
      <div class="card">
        <h1>短链接管理登录</h1>
        <form method="POST" action="/l/login">
          <label>访问密码</label>
          <input type="password" name="pwd" placeholder="回车键确认" autocomplete="current-password" autofocus>
          <button type="submit" style="width:100%">登录</button>
        </form>
        <div class="msg err">${errMsg ? esc(errMsg) : ""}</div>
      </div>
    </div>
  `);
}

// ===== 访问密码页 =====
function passwordPage(hasError, path) {
  const errMsg = hasError ? "密码错误，请重试" : "";
  return pageHTML("需要访问密码", `
    <div style="max-width:360px;margin:48px auto 0">
      <div class="card">
        <h1>需要访问密码</h1>
        <form method="GET" action="${esc(path)}">
          <label>访问密码</label>
          <input type="password" name="__slpwd" placeholder="回车键确认" autocomplete="current-password" autofocus>
          <button type="submit" style="width:100%">确认密码</button>
        </form>
        <div class="msg err">${errMsg}</div>
      </div>
    </div>
  `);
}

// ===== 游客页（精简文案 + 删除态显示） =====
async function renderGuest(env, params) {
  const raw = await env.SHORTLINKS_KV.get("/");
  const exists = !!raw;
  const e = parseEntry(raw) || {
    url: "", password: "", expiresAt: 0, paused: false,
    expireAction: "pause", statusCode: 302, remark: "", updatedAt: 0
  };
  const ok = params.get("ok") || "";
  const err = params.get("err") || "";

  const nextPaused = e.paused ? "false" : "true";
  const toggleText = e.paused ? "启用" : "暂停";
  const toggleClass = e.paused ? "toggle on" : "toggle";
  const pwdPlaceholder = exists && e.password ? "留空保持原密码" : "必填";

  let infoRows;
  if (exists) {
    infoRows =
      '<div class="row"><span class="fl">状态</span>' +
        (e.paused ? '<span class="status-off">已暂停</span>' : '<span class="status-on">正常</span>') +
      '</div>' +
      '<div class="row"><span class="fl">过期</span><span class="exp">' +
        (e.expiresAt ? esc(fmtDate(e.expiresAt)) : "无") +
      '</span></div>' +
      '<div class="row"><span class="fl">状态码</span><span class="status-code">' +
        e.statusCode +
      '</span></div>';
  } else {
    infoRows =
      '<div class="row"><span class="fl">状态</span><span class="status-off">已删除</span></div>' +
      '<div class="row"><span class="fl">过期</span><span class="empty">无</span></div>' +
      '<div class="row"><span class="fl">状态码</span><span class="empty">无</span></div>';
  }

  const deleteBtn = exists ? `
    <form class="inline" method="POST" action="/l/delete" onsubmit="return confirm('确定要删除根路径短链接吗？\\n删除后无法恢复。');">
      <input type="hidden" name="key" value="/">
      <input type="hidden" name="back" value="/l">
      <button type="submit" class="del">删除</button>
    </form>
  ` : "";

  const toggleBtn = exists ? `
    <form class="inline" method="POST" action="/l/toggle">
      <input type="hidden" name="key" value="/">
      <input type="hidden" name="paused" value="${nextPaused}">
      <button type="submit" class="${toggleClass}">${toggleText}</button>
    </form>
  ` : "";

  return pageHTML("根路径设置", `
    <div class="clearfix">
      <h1 style="display:inline-block;margin:0 0 16px">根路径设置</h1>
      <a class="logout" href="/l/logout">${icon("logout")} 退出</a>
    </div>

    <div class="card">
      <div class="infobox">
        ${infoRows}
      </div>

      ${toggleBtn || deleteBtn ? `
        <div class="btnrow">
          ${toggleBtn}
          ${deleteBtn}
        </div>
        <hr>
      ` : ""}

      <form method="POST" action="/l/save">
        <input type="hidden" name="isEdit" value="1">
        <input type="hidden" name="editKey" value="/">
        <input type="hidden" name="key" value="">
        <label>目标链接</label>
        <input type="text" name="url" placeholder="${exists ? "留空不修改" : "必填"}" autocomplete="off">
        <label>访问密码</label>
        <input type="text" name="password" placeholder="${pwdPlaceholder}" autocomplete="off">
        <label>过期时间</label>
        <input type="text" name="expiresAt" placeholder="YYYY-MM-DD HH:MM" autocomplete="off">
        <div class="form-row-2col">
          <div>
            <label>过期操作</label>
            <select name="expireAction">
              <option value="pause"${e.expireAction === "pause" ? " selected" : ""}>暂停</option>
              <option value="delete"${e.expireAction === "delete" ? " selected" : ""}>删除</option>
            </select>
          </div>
          <div>
            <label>状态码</label>
            ${statusSelectHTML("statusCode", e.statusCode)}
          </div>
        </div>
        <button type="submit">保存</button>
      </form>

      <div class="msg ${ok ? 'ok' : 'err'}">${ok ? esc(ok) : (err ? esc(err) : "")}</div>
    </div>
    ${copyFeatureHTML()}
  `);
}

// ===== 复制功能 =====
function copyFeatureHTML() {
  return `
    <div id="copyTip">已复制</div>
    <script>
    (function () {
      function showTip(text) {
        var tip = document.getElementById("copyTip");
        if (!tip) return;
        tip.textContent = text;
        tip.style.opacity = "1";
        if (tip._t) clearTimeout(tip._t);
        tip._t = setTimeout(function () { tip.style.opacity = "0"; }, 1200);
      }

      function fallbackCopy(text) {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "readonly");
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        showTip(ok ? "已复制" : "复制失败");
      }

      function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { showTip("已复制"); })["catch"](function () { fallbackCopy(text); });
        } else {
          fallbackCopy(text);
        }
      }

      document.addEventListener("click", function (e) {
        var el = e.target;
        while (el && el !== document.body) {
          if (el.getAttribute && el.getAttribute("data-copy") !== null) {
            copyText(el.getAttribute("data-copy"));
            return;
          }
          el = el.parentNode;
        }
      }, false);
    })();
    </script>
  `;
}

// ===== 并行加载所有短链接 =====
async function loadAllEntries(env) {
  const items = [];
  const now = Date.now();
  let cursor = undefined;
  let listComplete = false;
  const maxRounds = 10;
  let rounds = 0;

  while (!listComplete && rounds < maxRounds) {
    const opts = { limit: 1000 };
    if (cursor) opts.cursor = cursor;
    const listResult = await env.SHORTLINKS_KV.list(opts);
    const keys = listResult.keys || [];
    listComplete = !!listResult.list_complete;
    cursor = listResult.cursor;
    rounds++;

    if (keys.length === 0) continue;

    const raws = await Promise.all(keys.map(k => env.SHORTLINKS_KV.get(k.name)));

    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const raw = raws[i];
      if (isReserved(k.name)) continue;
      const e = parseEntry(raw);
      if (!e || !e.url) continue;

      let paused = e.paused;
      if (e.expiresAt > 0 && now > e.expiresAt) {
        if (e.expireAction === "delete") {
          env.SHORTLINKS_KV.delete(k.name).catch(() => {});
          continue;
        } else {
          paused = true;
          if (!e.paused) {
            e.paused = true;
            e.updatedAt = Date.now();
            env.SHORTLINKS_KV.put(k.name, JSON.stringify(e)).catch(() => {});
          }
        }
      }

      items.push({
        key: k.name,
        value: e.url,
        url: e.url,
        password: e.password,
        expiresAt: e.expiresAt,
        paused: paused,
        expireAction: e.expireAction,
        statusCode: e.statusCode,
        remark: e.remark,
        updatedAt: e.updatedAt
      });
    }
  }
  return items;
}

// ===== 过滤 + 分页 =====
async function loadAndFilterItems(env, params) {
  let page = parseInt(params.get("page"), 10);
  if (isNaN(page) || page < 1) page = 1;
  let pageSize = parseInt(params.get("size"), 10);
  if (isNaN(pageSize) || pageSize < 1) pageSize = 20;
  if (pageSize > 1000) pageSize = 1000;
  const search = (params.get("search") || "").replace(/^\s+|\s+$/g, "");
  const searchLower = search.toLowerCase();
  const sortParam = params.get("sort") || "edited";
  const sortMode = (sortParam === "dict") ? "dict" : "edited";

  let items = await loadAllEntries(env);

  if (searchLower) {
    items = items.filter(function (it) {
      const kl = it.key.toLowerCase();
      const ul = (it.value || "").toLowerCase();
      const rl = (it.remark || "").toLowerCase();
      return kl.indexOf(searchLower) !== -1 || ul.indexOf(searchLower) !== -1 || rl.indexOf(searchLower) !== -1;
    });
  }

  if (sortMode === "dict") {
    items.sort(function (a, b) {
      if (a.key < b.key) return -1;
      if (a.key > b.key) return 1;
      return 0;
    });
  } else {
    items.sort(function (a, b) {
      if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
      if (a.key < b.key) return -1;
      if (a.key > b.key) return 1;
      return 0;
    });
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = items.slice(startIdx, startIdx + pageSize);

  return { pageItems, total, totalPages, currentPage, pageSize, search, sortMode };
}

// ===== 列表项 HTML =====
function renderListItemHTML(it, host) {
  const keyText = it.key === "/" ? "/ （根路径）" : it.key;
  const copyPath = "https://" + host + (it.key === "/" ? "/" : it.key);
  const keyClickable = '<span class="fv key copyable" data-copy="' + esc(copyPath) + '" title="点击复制完整短链接">' + esc(keyText) + '</span>';
  const urlClickable = it.value
    ? '<span class="fv url copyable" data-copy="' + esc(it.value) + '" title="点击复制原链接">' + esc(it.value) + '</span>'
    : '<span class="empty">（无）</span>';
  const pwdHtml = it.password ? esc(it.password) : '<span class="empty">（无）</span>';
  const expHtml = it.expiresAt ? esc(fmtDate(it.expiresAt)) : '<span class="empty">（无）</span>';
  const statusHtml = it.paused ? '<span class="status-off">已暂停</span>' : '<span class="status-on">正常</span>';
  const statusCodeHtml = '<span class="status-code">' + it.statusCode + '</span>';
  const expireActionHtml = '<span class="fv">过期' + (it.expireAction === "delete" ? "删除" : "暂停") + '</span>';
  const updatedHtml = it.updatedAt ? '<span class="updated">' + esc(fmtDate(it.updatedAt)) + '</span>' : '<span class="empty">（无）</span>';
  const remarkFirst = firstLineRemark(it.remark);
  const remarkHtml = remarkFirst
    ? '<span class="remark" title="' + esc(it.remark) + '">' + esc(remarkFirst) + '</span>'
    : '<span class="empty">（无）</span>';
  const keyEsc = esc(it.key);
  const toggleIcon = it.paused ? icon("play") : icon("pause");
  const toggleTitle = it.paused ? "启用" : "暂停";
  const toggleClass = it.paused ? "toggle on icon" : "toggle icon";

  return '<div class="item" data-key="' + keyEsc + '">' +
    '<div class="field"><span class="fl">路径</span>' + keyClickable + '</div>' +
    '<div class="field"><span class="fl">原链接</span>' + urlClickable + '</div>' +
    '<div class="field"><span class="fl">备注</span>' + remarkHtml + '</div>' +
    '<div class="field"><span class="fl">密码</span><span class="fv pwd">' + pwdHtml + '</span></div>' +
    '<div class="field"><span class="fl">过期</span><span class="fv exp">' + expHtml + '</span></div>' +
    '<div class="field">' +
      '<span class="fl">状态</span>' +
      statusHtml +
      '<span class="meta-sep">·</span>' +
      statusCodeHtml +
      '<span class="meta-sep">·</span>' +
      expireActionHtml +
    '</div>' +
    '<div class="field"><span class="fl">编辑于</span>' + updatedHtml + '</div>' +
    '<div class="actions">' +
    '<button type="button" class="btn edit icon btn-edit" data-key="' + keyEsc + '" title="编辑" aria-label="编辑">' + icon("edit") + '</button>' +
    '<button type="button" class="' + toggleClass + ' btn-toggle" data-key="' + keyEsc + '" data-paused="' + (it.paused ? "false" : "true") + '" title="' + toggleTitle + '" aria-label="' + toggleTitle + '">' + toggleIcon + '</button>' +
    '<button type="button" class="del icon btn-delete" data-key="' + keyEsc + '" title="删除" aria-label="删除">' + icon("delete") + '</button>' +
    '</div></div>';
}

// ===== 底部导航（含回到顶部按钮） =====
function bottomNavHTML() {
  return `<nav class="bottom-nav">
    <a href="javascript:void(0)" data-tab="form" class="active" title="编辑" aria-label="编辑">${icon("edit")}</a>
    <a href="javascript:void(0)" data-tab="list" title="列表" aria-label="列表">${icon("list")}</a>
  </nav>
  <button type="button" id="back-to-top" class="back-to-top-btn" title="回到顶部" aria-label="回到顶部">${icon("up")}</button>`;
}

// ===== 管理员 SPA 脚本 =====
function adminSPAScript(currentPage, pageSize, search, sortMode) {
  return `<script>
(function(){
  var state = { page: 1, size: 20, search: "", sort: "edited" };
  var formPanel = document.getElementById("panel-form");
  var listPanel = document.getElementById("panel-list");
  var formMsg = document.getElementById("form-msg");
  var backToTopBtn = document.getElementById("back-to-top");

  function showMsg(el, text, ok) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "msg " + (ok ? "ok" : (text ? "err" : ""));
  }

  function isListVisible() {
    return listPanel && listPanel.style.display !== "none";
  }

  function updateBackToTop() {
    if (!backToTopBtn) return;
    if (isListVisible() && window.scrollY > 200) {
      backToTopBtn.classList.add("visible");
    } else {
      backToTopBtn.classList.remove("visible");
    }
  }

  function switchTab(tab) {
    var isForm = tab === "form";
    formPanel.style.display = isForm ? "" : "none";
    listPanel.style.display = isForm ? "none" : "";
    document.querySelectorAll(".bottom-nav a").forEach(function(a){
      a.classList.toggle("active", a.getAttribute("data-tab") === tab);
    });
    window.scrollTo(0, 0);
    updateBackToTop();
  }

  document.querySelectorAll(".bottom-nav a").forEach(function(a){
    a.addEventListener("click", function(e){
      e.preventDefault();
      switchTab(a.getAttribute("data-tab"));
    });
  });

  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", function(){
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  window.addEventListener("scroll", updateBackToTop, { passive: true });

  function api(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(path, opts).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, status: r.status, data: j }; }); });
  }

  function loadList() {
    var q = "page=" + state.page + "&size=" + state.size + "&search=" + encodeURIComponent(state.search) + "&sort=" + state.sort;
    return api("/l/api/list?" + q).then(function(res){
      if (!res.ok) { showMsg(formMsg, res.data.error || "加载失败", false); return; }
      var d = res.data;
      state.page = d.currentPage;
      state.size = d.pageSize;
      document.getElementById("page-info").textContent = d.currentPage + " / " + d.totalPages;
      document.getElementById("q-page").value = d.currentPage;
      document.getElementById("q-size").value = d.pageSize;
      document.getElementById("btn-prev").disabled = d.currentPage <= 1;
      document.getElementById("btn-next").disabled = d.currentPage >= d.totalPages;
      document.getElementById("btn-sort-edited").className = "btn refresh icon" + (d.sortMode === "edited" ? " active" : "");
      document.getElementById("btn-sort-dict").className = "btn refresh icon" + (d.sortMode === "dict" ? " active" : "");
      document.getElementById("list-body").innerHTML = d.html || '<div class="msg">暂无短链接</div>';
      updateBackToTop();
      return d;
    });
  }

  function resetForm() {
    document.getElementById("f-isEdit").value = "0";
    document.getElementById("f-editKey").value = "";
    document.getElementById("f-key").value = "";
    document.getElementById("f-url").value = "";
    document.getElementById("f-remark").value = "";
    document.getElementById("f-password").value = "";
    document.getElementById("f-expiresAt").value = "";
    document.getElementById("f-expireAction").value = "pause";
    document.getElementById("f-statusCode").value = "302";
    document.getElementById("form-hint").style.display = "none";
    document.getElementById("btn-reset").style.display = "none";
    showMsg(formMsg, "", true);
  }

  function fillEdit(item) {
    document.getElementById("f-isEdit").value = "1";
    document.getElementById("f-editKey").value = item.key || "";
    document.getElementById("f-key").value = item.key === "/" ? "/" : (item.key || "").replace(/^\\//, "");
    document.getElementById("f-url").value = item.value || item.url || "";
    document.getElementById("f-remark").value = item.remark || "";
    document.getElementById("f-password").value = item.password || "";
    document.getElementById("f-expiresAt").value = item.expiresAtFmt || "";
    document.getElementById("f-expireAction").value = item.expireAction || "pause";
    document.getElementById("f-statusCode").value = String(item.statusCode || 302);
    document.getElementById("form-hint").style.display = "";
    document.getElementById("form-hint").textContent = "正在编辑：" + (item.key || "/");
    document.getElementById("btn-reset").style.display = "";
    showMsg(formMsg, "", true);
    switchTab("form");
  }

  document.getElementById("btn-reset").addEventListener("click", resetForm);

  document.getElementById("btn-save").addEventListener("click", function(){
    var payload = {
      isEdit: document.getElementById("f-isEdit").value === "1",
      editKey: document.getElementById("f-editKey").value,
      key: document.getElementById("f-key").value,
      url: document.getElementById("f-url").value,
      remark: document.getElementById("f-remark").value,
      password: document.getElementById("f-password").value,
      expiresAt: document.getElementById("f-expiresAt").value,
      expireAction: document.getElementById("f-expireAction").value,
      statusCode: document.getElementById("f-statusCode").value
    };
    var btn = document.getElementById("btn-save");
    btn.disabled = true;
    showMsg(formMsg, "保存中…", true);
    api("/l/api/save", { method: "POST", body: payload }).then(function(res){
      if (!res.ok) {
        showMsg(formMsg, res.data.error || "保存失败", false);
        btn.disabled = false;
        return;
      }
      var savedKey = res.data.key;
      showMsg(formMsg, "正在验证…", true);
      var tries = 0;
      function poll() {
        tries++;
        api("/l/api/get?key=" + encodeURIComponent(savedKey)).then(function(r){
          if (r.ok && r.data && r.data.url) {
            showMsg(formMsg, "保存成功", true);
            btn.disabled = false;
            resetForm();
            state.page = 1;
            state.sort = "edited";
            loadList().then(function(){ switchTab("list"); });
            return;
          }
          if (tries < 15) { setTimeout(poll, 400); }
          else {
            showMsg(formMsg, "已保存，同步稍慢，请手动打开列表查看", true);
            btn.disabled = false;
            loadList();
          }
        }).catch(function(){
          if (tries < 15) setTimeout(poll, 400);
          else { showMsg(formMsg, "已保存", true); btn.disabled = false; }
        });
      }
      setTimeout(poll, 300);
    }).catch(function(e){
      showMsg(formMsg, "网络错误", false);
      btn.disabled = false;
    });
  });

  var qSearch = document.getElementById("q-search");
  var qSize = document.getElementById("q-size");
  var qPage = document.getElementById("q-page");
  if (qSearch) qSearch.addEventListener("keydown", function(e){
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("btn-search").click(); }
  });
  if (qSize) qSize.addEventListener("keydown", function(e){
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("btn-size").click(); }
  });
  if (qPage) qPage.addEventListener("keydown", function(e){
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("btn-goto").click(); }
  });

  document.getElementById("btn-search").addEventListener("click", function(){
    state.search = document.getElementById("q-search").value.trim();
    state.page = 1;
    loadList();
  });
  document.getElementById("btn-search-reset").addEventListener("click", function(){
    document.getElementById("q-search").value = "";
    state.search = "";
    state.page = 1;
    loadList();
  });
  document.getElementById("btn-size").addEventListener("click", function(){
    var n = parseInt(document.getElementById("q-size").value, 10);
    if (!isNaN(n) && n > 0) state.size = Math.min(n, 1000);
    state.page = 1;
    loadList();
  });
  document.getElementById("btn-prev").addEventListener("click", function(){
    if (state.page > 1) { state.page--; loadList(); }
  });
  document.getElementById("btn-next").addEventListener("click", function(){
    state.page++; loadList();
  });
  document.getElementById("btn-goto").addEventListener("click", function(){
    var n = parseInt(document.getElementById("q-page").value, 10);
    if (!isNaN(n) && n > 0) { state.page = n; loadList(); }
  });
  document.getElementById("btn-sort-edited").addEventListener("click", function(){
    state.sort = "edited"; state.page = 1; loadList();
  });
  document.getElementById("btn-sort-dict").addEventListener("click", function(){
    state.sort = "dict"; state.page = 1; loadList();
  });

  document.getElementById("list-body").addEventListener("click", function(e){
    var t = e.target;
    while (t && t !== this) {
      if (t.classList && t.classList.contains("btn-edit")) {
        var key = t.getAttribute("data-key");
        api("/l/api/get?key=" + encodeURIComponent(key)).then(function(res){
          if (res.ok && res.data) fillEdit(res.data);
          else showMsg(formMsg, "加载失败", false);
        });
        return;
      }
      if (t.classList && t.classList.contains("btn-toggle")) {
        var key2 = t.getAttribute("data-key");
        var paused = t.getAttribute("data-paused") === "true";
        api("/l/api/toggle", { method: "POST", body: { key: key2, paused: paused } }).then(function(res){
          if (res.ok) loadList();
          else alert(res.data.error || "操作失败");
        });
        return;
      }
      if (t.classList && t.classList.contains("btn-delete")) {
        var key3 = t.getAttribute("data-key");
        if (!confirm("确定删除 " + key3 + " 吗？")) return;
        api("/l/api/delete", { method: "POST", body: { key: key3 } }).then(function(res){
          if (res.ok) loadList();
          else alert(res.data.error || "删除失败");
        });
        return;
      }
      t = t.parentNode;
    }
  });

  state.page = ${currentPage};
  state.size = ${pageSize};
  state.search = ${JSON.stringify(search)};
  state.sort = ${JSON.stringify(sortMode)};

  updateBackToTop();
})();
</script>`;
}

// ===== 管理员 SPA 页面 =====
async function renderAdmin(env, params, host) {
  const { pageItems, total, totalPages, currentPage, pageSize, search, sortMode } =
    await loadAndFilterItems(env, params);

  let listHTML = "";
  if (!pageItems.length) {
    listHTML = '<div class="msg">' + (total === 0 ? "暂无短链接" : "无匹配结果") + '</div>';
  } else {
    for (let i = 0; i < pageItems.length; i++) {
      listHTML += renderListItemHTML(pageItems[i], host);
    }
  }

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;
  const sortEditedClass = (sortMode === "edited") ? "btn refresh icon active" : "btn refresh icon";
  const sortDictClass = (sortMode === "dict") ? "btn refresh icon active" : "btn refresh icon";

  return pageHTML("短链接管理", `
    <div class="clearfix">
      <h1 style="display:inline-block;margin:0 0 1rem">短链接管理</h1>
      <a class="logout" href="/l/logout" title="退出登录">${icon("logout")} 退出</a>
    </div>

    <div id="panel-form" class="panel">
      <div class="card">
        <h2 id="form-title" style="display:none"></h2>
        <p class="hint" id="form-hint" style="display:none"></p>
        <div id="form-msg" class="msg"></div>
        <form id="sl-form" onsubmit="return false;">
          <input type="hidden" id="f-isEdit" value="0">
          <input type="hidden" id="f-editKey" value="">
          <label>短链接路径</label>
          <input type="text" id="f-key" placeholder="留空即为根路径" autocomplete="off" title="仅允许大小写字母和数字">
          <label>目标链接</label>
          <input type="text" id="f-url" placeholder="https://example.com 或 weixin://" autocomplete="off" title="新路径必须填写；编辑时留空不修改">
          <label>备注</label>
          <input type="text" id="f-remark" placeholder="可选，可被搜索" autocomplete="off">
          <label>访问密码</label>
          <input type="text" id="f-password" placeholder="根路径必须设置密码" autocomplete="off" title="根路径必须设置密码；其他路径留空表示不设置或清空密码">
          <label>过期时间</label>
          <input type="text" id="f-expiresAt" placeholder="YYYY-MM-DD HH:MM" autocomplete="off" title="留空表示不设置过期">
          <div class="form-row-2col">
            <div>
              <label>过期操作</label>
              <select id="f-expireAction" title="过期后的行为">
                <option value="pause">暂停（保留记录）</option>
                <option value="delete">删除（不留记录）</option>
              </select>
            </div>
            <div>
              <label>跳转状态码</label>
              ${statusSelectHTML("statusCode", 302).replace('name="statusCode"', 'id="f-statusCode"')}
            </div>
          </div>
          <div class="btnrow">
            <button type="button" id="btn-save">${icon("save")} 保存</button>
            <button type="button" id="btn-reset" class="btn tonal" style="display:none">${icon("refresh")} 取消编辑</button>
          </div>
        </form>
      </div>
    </div>

    <div id="panel-list" class="panel" style="display:none">
      <div class="card">
        <div class="row1">
          <input type="text" id="q-search" value="${esc(search)}" placeholder="搜索路径 / 备注 / 原链接" autocomplete="off" title="回车搜索">
          <button type="button" id="btn-search" class="btn refresh icon" title="搜索" aria-label="搜索">${icon("search")}</button>
          <button type="button" id="btn-search-reset" class="btn refresh icon" title="清空搜索" aria-label="清空搜索">${icon("close")}</button>
        </div>

        <div class="row2">
          <button type="button" class="${sortEditedClass}" id="btn-sort-edited" data-sort="edited" title="按最近编辑排序" aria-label="按最近编辑排序">${icon("time")}</button>
          <button type="button" class="${sortDictClass}" id="btn-sort-dict" data-sort="dict" title="按路径字典序" aria-label="按路径字典序">${icon("sort")}</button>
          <span class="page-size-group">
            <label for="q-size">每页</label>
            <input type="text" id="q-size" value="${pageSize}" inputmode="numeric" title="每页条数（回车应用）">
            <button type="button" id="btn-size" class="btn refresh icon" title="应用每页条数" aria-label="应用每页条数">${icon("save")}</button>
          </span>
        </div>

        <div class="row3">
          <button type="button" class="btn refresh icon" id="btn-prev" ${prevDisabled ? "disabled" : ""} title="上一页" aria-label="上一页">${icon("prev")}</button>
          <span class="pageinfo" id="page-info">${currentPage} / ${totalPages}</span>
          <button type="button" class="btn refresh icon" id="btn-next" ${nextDisabled ? "disabled" : ""} title="下一页" aria-label="下一页">${icon("next")}</button>
          <input type="text" id="q-page" value="${currentPage}" inputmode="numeric" title="跳转到页（回车跳转）" style="margin-left:auto">
          <button type="button" class="btn refresh icon" id="btn-goto" title="跳转到该页" aria-label="跳转到该页">${icon("enter")}</button>
        </div>

        <div id="list-body">${listHTML}</div>
      </div>
    </div>

    ${bottomNavHTML()}
    ${copyFeatureHTML()}
    ${adminSPAScript(currentPage, pageSize, search, sortMode)}
  `, null, "has-bottom-nav");
}

// ===== 暂停或过期页 =====
function unavailablePage() {
  return pageHTML("链接已暂停或过期", `
    <div style="max-width:360px;margin:48px auto 0">
      <div class="card" style="text-align:center">
        <h1 style="font-size:1.25rem;margin-bottom:0.5rem">链接已暂停或过期</h1>
        <p style="font-size:0.9rem;color:var(--md-sys-color-on-surface-variant);margin:0">该短链接当前不可访问。</p>
      </div>
    </div>
  `);
}

// ===== 保存逻辑 =====
async function handleSave(form, role, env) {
  const isEdit = form.get("isEdit") === "1";
  const editKey = form.get("editKey") || "";
  const rawKey = (form.get("key") || "").replace(/^\s+|\s+$/g, "");
  const urlVal = (form.get("url") || "").replace(/^\s+|\s+$/g, "");
  const actionVal = form.get("expireAction") || "";

  let key;
  if (role === "guest") {
    key = "/";
  } else {
    if (isEdit && editKey && rawKey === "") {
      key = editKey;
    } else {
      key = rawKey === "" ? "/" : normalizeKey(rawKey);
      if (!key || !isValidKey(key)) return "路径只能由大小写字母和数字组成";
      if (isReserved(key)) return "该路径为系统保留，不能使用";
    }
  }

  if (isEdit && editKey && key !== editKey) {
    const existing = await env.SHORTLINKS_KV.get(key);
    if (existing) return "目标路径已被占用，请换一个路径";
  }

  const raw = await env.SHORTLINKS_KV.get(key);
  const current = parseEntry(raw) || {
    url: "", password: "", expiresAt: 0, paused: false,
    expireAction: "pause", statusCode: 302, remark: "", updatedAt: 0
  };

  let base = current;
  if (isEdit && editKey && key !== editKey) {
    const oldRaw = await env.SHORTLINKS_KV.get(editKey);
    base = parseEntry(oldRaw) || current;
  }

  let newUrl = base.url;
  if (urlVal) {
    const n = normalizeTarget(urlVal);
    if (!n) return "目标链接不合法";
    newUrl = n;
  }

  let newPwd = base.password;
  const pwdRaw = form.get("password");
  if (pwdRaw !== null && pwdRaw !== undefined) {
    if (role === "guest" && key === "/" && base.password && pwdRaw === "") {
      // 保持原密码
    } else {
      newPwd = pwdRaw === "-" ? "" : pwdRaw;
    }
  }

  if (key === "/" && !newPwd) {
    return "根路径必须设置访问密码";
  }

  let newExp = base.expiresAt;
  const expRaw = form.get("expiresAt");
  if (expRaw !== null && expRaw !== undefined) {
    const s = expRaw.replace(/^\s+|\s+$/g, "");
    if (s === "-" || s === "") {
      newExp = 0;
    } else {
      const t = parseLocalDateTime(s);
      if (t === null) return "时间格式错误，应为 YYYY-MM-DD HH:MM";
      newExp = t;
    }
  }

  let newAction = base.expireAction;
  if (actionVal === "delete") newAction = "delete";
  else if (actionVal === "pause") newAction = "pause";
  else if (!newAction) newAction = "pause";

  let newStatus = base.statusCode;
  const statusRaw = form.get("statusCode");
  if (statusRaw !== null && statusRaw !== undefined) {
    newStatus = normalizeStatusCode(statusRaw);
  }

  let newRemark = base.remark;
  const remarkRaw = form.get("remark");
  if (remarkRaw !== null && remarkRaw !== undefined) newRemark = remarkRaw;

  if (!newUrl) return "该路径还没有目标链接，请先填写目标链接";

  await env.SHORTLINKS_KV.put(key, JSON.stringify({
    url: newUrl,
    password: newPwd,
    expiresAt: newExp,
    paused: base.paused === true,
    expireAction: newAction,
    statusCode: newStatus,
    remark: newRemark,
    updatedAt: Date.now()
  }));

  if (isEdit && editKey && key !== editKey) {
    try { await env.SHORTLINKS_KV.delete(editKey); } catch (e) {}
  }
  return null;
}

// ===== 管理 JSON API =====
async function handleAdminAPI(request, env, path, params, host) {
  if (path === "/l/api/list" && request.method === "GET") {
    const data = await loadAndFilterItems(env, params);
    let html = "";
    if (!data.pageItems.length) {
      html = '<div class="msg">' + (data.total === 0 ? "暂无短链接" : "无匹配结果") + '</div>';
    } else {
      for (let i = 0; i < data.pageItems.length; i++) {
        html += renderListItemHTML(data.pageItems[i], host);
      }
    }
    return jsonResponse({
      total: data.total,
      totalPages: data.totalPages,
      currentPage: data.currentPage,
      pageSize: data.pageSize,
      search: data.search,
      sortMode: data.sortMode,
      html: html
    });
  }

  if (path === "/l/api/get" && request.method === "GET") {
    const key = normalizeKey(params.get("key") || "");
    if (!key || !isValidKey(key)) return jsonResponse({ error: "路径无效" }, 400);
    const raw = await env.SHORTLINKS_KV.get(key);
    if (!raw) return jsonResponse({ error: "不存在" }, 404);
    const e = parseEntry(raw);
    if (!e || !e.url) return jsonResponse({ error: "不存在" }, 404);
    return jsonResponse({
      key: key,
      url: e.url,
      value: e.url,
      password: e.password,
      expiresAt: e.expiresAt,
      expiresAtFmt: e.expiresAt ? fmtDate(e.expiresAt) : "",
      paused: e.paused,
      expireAction: e.expireAction,
      statusCode: e.statusCode,
      remark: e.remark,
      updatedAt: e.updatedAt
    });
  }

  if (path === "/l/api/save" && request.method === "POST") {
    let body = {};
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: "JSON 解析失败" }, 400); }
    const form = {
      get: function(k) {
        if (k === "isEdit") return body.isEdit ? "1" : "0";
        if (k === "editKey") return body.editKey || "";
        if (k === "key") return body.key != null ? body.key : "";
        if (k === "url") return body.url != null ? body.url : "";
        if (k === "password") return body.password != null ? body.password : "";
        if (k === "expiresAt") return body.expiresAt != null ? body.expiresAt : "";
        if (k === "expireAction") return body.expireAction || "";
        if (k === "statusCode") return body.statusCode != null ? body.statusCode : "";
        if (k === "remark") return body.remark != null ? body.remark : "";
        return null;
      }
    };
    const errMsg = await handleSave(form, "admin", env);
    if (errMsg) return jsonResponse({ error: errMsg }, 400);
    let key;
    const rawKey = (body.key || "").replace(/^\s+|\s+$/g, "");
    if (body.isEdit && body.editKey && rawKey === "") key = body.editKey;
    else key = rawKey === "" ? "/" : normalizeKey(rawKey);
    return jsonResponse({ ok: true, key: key });
  }

  if (path === "/l/api/delete" && request.method === "POST") {
    let body = {};
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: "JSON 解析失败" }, 400); }
    const key = normalizeKey(body.key || "");
    if (!key || !isValidKey(key) || isReserved(key)) return jsonResponse({ error: "路径无效" }, 400);
    await env.SHORTLINKS_KV.delete(key);
    return jsonResponse({ ok: true });
  }

  if (path === "/l/api/toggle" && request.method === "POST") {
    let body = {};
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: "JSON 解析失败" }, 400); }
    const key = normalizeKey(body.key || "");
    const paused = body.paused === true || body.paused === "true";
    if (!key || !isValidKey(key) || isReserved(key)) return jsonResponse({ error: "路径无效" }, 400);
    const raw = await env.SHORTLINKS_KV.get(key);
    if (!raw) return jsonResponse({ error: "短链接不存在" }, 404);
    const e = parseEntry(raw);
    if (!e || !e.url) return jsonResponse({ error: "短链接不存在" }, 404);
    e.paused = paused;
    e.updatedAt = Date.now();
    await env.SHORTLINKS_KV.put(key, JSON.stringify(e));
    return jsonResponse({ ok: true, paused: paused });
  }

  return jsonResponse({ error: "Not Found" }, 404);
}

// ===== Worker 入口 =====
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    if (path === "/l" || path === "/l/") {
      const role = getRole(request, env);
      if (!role) {
        const err = params.get("err");
        return htmlResponse(renderLogin(err === "1" ? "密码错误，请重试" : ""));
      }
      if (role === "admin") return htmlResponse(await renderAdmin(env, params, url.hostname));
      return htmlResponse(await renderGuest(env, params));
    }

    if (path.startsWith("/l/api/")) {
      const role = getRole(request, env);
      if (role !== "admin") {
        return new Response(JSON.stringify({ error: "未登录或无权限" }), {
          status: 401,
          headers: noCacheHeaders({ "Content-Type": "application/json; charset=utf-8" })
        });
      }
      return handleAdminAPI(request, env, path, params, url.hostname);
    }

    if (path === "/l/login" && request.method === "POST") {
      let form = null;
      try { form = await request.formData(); } catch (e) {}
      const pwd = form ? form.get("pwd") : "";
      const role = getRoleFromPassword(pwd, env);
      if (!role) return redirectResponse("/l?err=1", 302);
      return redirectResponse("/l", 302, {
        "Set-Cookie": "sl_auth=" + encodeURIComponent(pwd) + "; Path=/l; HttpOnly; SameSite=Lax; Max-Age=86400"
      });
    }

    if (path === "/l/logout") {
      return redirectResponse("/l", 302, {
        "Set-Cookie": "sl_auth=; Path=/l; HttpOnly; SameSite=Lax; Max-Age=0"
      });
    }

    if (path === "/l/save" && request.method === "POST") {
      const role = getRole(request, env);
      if (!role) return redirectResponse("/l", 302);
      let form = null;
      try { form = await request.formData(); } catch (e) {}
      if (!form) return redirectResponse("/l?err=" + encodeURIComponent("表单解析失败"), 302);

      const isEdit = form.get("isEdit") === "1";
      const sortQ = form.get("sort") || "edited";
      const pageQ = form.get("page") || "1";
      const sizeQ = form.get("size") || "20";
      const searchQ = form.get("search") || "";

      if (role === "admin" && !isEdit) {
        const rawKey = (form.get("key") || "").replace(/^\s+|\s+$/g, "");
        const checkKey = rawKey === "" ? "/" : normalizeKey(rawKey);
        if (checkKey && isValidKey(checkKey) && !isReserved(checkKey)) {
          const existing = await env.SHORTLINKS_KV.get(checkKey);
          if (existing) {
            return redirectResponse("/l?err=" + encodeURIComponent("路径已被占用"), 302);
          }
        }
      }

      const errMsg = await handleSave(form, role, env);
      const backBase = "/l?sort=" + encodeURIComponent(sortQ) +
        "&page=" + encodeURIComponent(pageQ) +
        "&size=" + encodeURIComponent(sizeQ) +
        "&search=" + encodeURIComponent(searchQ);
      if (errMsg) return redirectResponse(backBase + "&err=" + encodeURIComponent(errMsg), 302);
      return redirectResponse(backBase + "&ok=" + encodeURIComponent("保存成功"), 302);
    }

    if (path === "/l/delete" && request.method === "POST") {
      const role = getRole(request, env);
      if (!role) return redirectResponse("/l", 302);
      let form = null;
      try { form = await request.formData(); } catch (e) {}
      const back = (form && form.get("back")) || "/l";
      const key = normalizeKey(form ? form.get("key") : "");
      if (!key || !isValidKey(key) || isReserved(key)) {
        return redirectResponse("/l?err=" + encodeURIComponent("路径无效"), 302);
      }
      if (role === "guest" && key !== "/") {
        return redirectResponse("/l?err=" + encodeURIComponent("无权限"), 302);
      }
      await env.SHORTLINKS_KV.delete(key);
      const sep = back.indexOf("?") === -1 ? "?" : "&";
      return redirectResponse(back + sep + "ok=" + encodeURIComponent("已删除"), 302);
    }

    if (path === "/l/toggle" && request.method === "POST") {
      const role = getRole(request, env);
      if (!role) return redirectResponse("/l", 302);
      let form = null;
      try { form = await request.formData(); } catch (e) {}
      const back = (form && form.get("back")) || "/l";
      const key = normalizeKey(form ? form.get("key") : "");
      const paused = form ? form.get("paused") === "true" : false;

      if (!key || !isValidKey(key) || isReserved(key)) {
        return redirectResponse("/l?err=" + encodeURIComponent("路径无效"), 302);
      }
      if (role === "guest" && key !== "/") return redirectResponse("/l", 302);

      const raw = await env.SHORTLINKS_KV.get(key);
      if (!raw) return redirectResponse("/l?err=" + encodeURIComponent("短链接不存在"), 302);
      const e = parseEntry(raw);
      if (!e || !e.url) return redirectResponse("/l?err=" + encodeURIComponent("短链接不存在"), 302);

      e.paused = paused;
      e.updatedAt = Date.now();
      await env.SHORTLINKS_KV.put(key, JSON.stringify(e));
      const sep = back.indexOf("?") === -1 ? "?" : "&";
      return redirectResponse(back + sep + "ok=" + encodeURIComponent(paused ? "已暂停" : "已启用"), 302);
    }

    let raw;
    try {
      raw = await env.SHORTLINKS_KV.get(path);
    } catch (e) {
      return new Response("Server Error", {
        status: 500,
        headers: noCacheHeaders({ "Content-Type": "text/plain; charset=utf-8" })
      });
    }

    if (!raw) return notFoundResponse();
    const entry = parseEntry(raw);
    if (!entry || !entry.url) return notFoundResponse();

    if (entry.paused) return htmlResponse(unavailablePage());

    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      if (entry.expireAction === "delete") {
        try { await env.SHORTLINKS_KV.delete(path); } catch (e) {}
        return htmlResponse(unavailablePage());
      } else {
        entry.paused = true;
        entry.updatedAt = Date.now();
        try { await env.SHORTLINKS_KV.put(path, JSON.stringify(entry)); } catch (e) {}
        return htmlResponse(unavailablePage());
      }
    }

    const pValue = params.get("p");
    const target = applyParam(entry.url, pValue);

    if (!entry.password) {
      return redirectResponse(target, entry.statusCode);
    }

    const provided = params.get("__slpwd");
    if (provided === entry.password) {
      return redirectResponse(target, entry.statusCode);
    }

    return htmlResponse(passwordPage(provided !== null, path));
  }
};