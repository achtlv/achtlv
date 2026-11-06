// index.js
import { fail, HttpError } from './errors.js';
import { parse } from './parser.js';
import { Interpreter } from './interpreter.js';
import { resolveInput, InputStream } from './input.js';

/** 文档 HTML：优先 env.DOCS_URL，否则 GitHub raw */
const DEFAULT_DOCS_URL =
  'https://raw.githubusercontent.com/achtlv/achtlv.github.io/main/cppscript/index.html';

const THEME_CSS = `
:root {
  color-scheme: light dark;
  --bg: #f6f8fb;
  --panel: #ffffff;
  --text: #1a2332;
  --muted: #5a6a82;
  --accent: #2563eb;
  --code-bg: #eef2f7;
  --border: #d0d7e2;
  --ok: #15803d;
  --err: #b91c1c;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1419;
    --panel: #1a2332;
    --text: #e7ecf3;
    --muted: #8b9bb4;
    --accent: #3d8bfd;
    --code-bg: #0b1220;
    --border: #2a3548;
    --ok: #3dd68c;
    --err: #f87171;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.55;
}
.wrap { max-width: 920px; margin: 0 auto; padding: 1.25rem 1rem 3rem; }
header {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem 1rem;
  margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border);
}
header h1 { font-size: 1.15rem; margin: 0; font-weight: 650; }
header .meta { color: var(--muted); font-size: 0.85rem; }
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  margin-bottom: 0.85rem;
}
.card h2 { font-size: 0.8rem; margin: 0 0 0.5rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.card pre, .out {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.88rem;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--code-bg);
  border-radius: 8px;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--border);
  min-height: 1.5em;
}
a { color: var(--accent); }
.badge {
  display: inline-block; font-size: 0.75rem; padding: 0.15rem 0.5rem;
  border-radius: 999px; border: 1px solid var(--border); color: var(--muted);
}
.badge.ok { color: var(--ok); border-color: var(--ok); }
.badge.err { color: var(--err); border-color: var(--err); }
.foot { margin-top: 1rem; color: var(--muted); font-size: 0.8rem; }
label { display: block; font-size: 0.8rem; color: var(--muted); margin: 0.6rem 0 0.3rem; font-weight: 600; }
input[type=text], textarea {
  width: 100%;
  box-sizing: border-box;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.88rem;
  background: var(--code-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.65rem 0.8rem;
}
textarea { min-height: 8rem; resize: vertical; line-height: 1.45; }
button.run {
  margin-top: 0.9rem;
  cursor: pointer;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.55rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
}
button.run:hover { filter: brightness(1.08); }
.hint { color: var(--muted); font-size: 0.78rem; margin-top: 0.35rem; }
`.trim();

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 扫描 AST：脚本是否用到 key / 标准输入 */
function analyzeNeeds(ast) {
  let needsKey = false;
  let needsIn = false;
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    // 内置变量 key
    if (n.type === 'Ident' && n.name === 'key') needsKey = true;
    // q_get("key") / q_get('key')
    if (
      n.type === 'Call' &&
      n.callee &&
      n.callee.type === 'Ident' &&
      n.callee.name === 'q_get' &&
      n.args &&
      n.args[0] &&
      n.args[0].type === 'String' &&
      n.args[0].value === 'key'
    ) {
      needsKey = true;
    }
    if (n.type === 'In') needsIn = true;
    if (n.type === 'Call' && n.callee && n.callee.type === 'Ident') {
      if (n.callee.name === 'getchar') needsIn = true;
    }
    if (n.type === 'InputRead' || n.type === 'Extract' || n.type === 'StreamExtract') needsIn = true;
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') walk(v);
    }
  };
  walk(ast);
  return { needsKey, needsIn };
}

function formPageShell({ ruleUrl, needsIn, needsKey, prefillIn, prefillKey }) {
  const inField = needsIn
    ? `<label for="fld-in">输入 in（可多行，可留空）</label>
<textarea id="fld-in" name="in" rows="6">${escapeHtml(prefillIn || '')}</textarea>
<p class="hint">可留空；换行直接回车</p>`
    : '';
  const keyField = needsKey
    ? `<label for="fld-key">参数 key（可留空）</label>
<input type="text" id="fld-key" name="key" value="${escapeHtml(prefillKey || '')}" placeholder="例如 2^3" autocomplete="off" />
<p class="hint">可留空后点运行</p>`
    : '';

  // 点击运行：用 JS 拼好 query（空值也带上），再 location.assign 整页打开结果
  // 不用 fetch/document.write，避免点运行后白屏
  const boot =
    '<script>(function(){' +
    'var ruleUrl=' + JSON.stringify(ruleUrl || '') + ';' +
    'var needsKey=' + (needsKey ? 'true' : 'false') + ';' +
    'var needsIn=' + (needsIn ? 'true' : 'false') + ';' +
    'var form=document.getElementById("run-form");' +
    'if(!form)return;' +
    'form.addEventListener("submit",function(e){' +
    'e.preventDefault();' +
    'var btn=document.getElementById("run-btn");' +
    'if(btn){btn.disabled=true;btn.textContent="\\u8fd0\\u884c\\u4e2d...";}' +
    'var u=new URL(window.location.origin+window.location.pathname);' +
    'u.searchParams.set("url",ruleUrl);' +
    'u.searchParams.set("run","1");' +
    'if(needsKey){' +
    'var k=document.getElementById("fld-key");' +
    'u.searchParams.set("key",k?String(k.value):"");' +
    '}' +
    'if(needsIn){' +
    'var n=document.getElementById("fld-in");' +
    'u.searchParams.set("in",n?String(n.value):"");' +
    '}' +
    'window.location.assign(u.toString());' +
    '});' +
    '})();</scr' + 'ipt>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>CppScript · 填写参数</title>
<style>${THEME_CSS}</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>CppScript</h1>
    <span class="badge">填写参数</span>
    <span class="meta">主题随系统自动切换</span>
  </header>
  <div class="card">
    <h2>规则</h2>
    <pre>${escapeHtml(ruleUrl || '')}</pre>
  </div>
  <div class="card">
    <h2>运行参数</h2>
    <form id="run-form" method="get" action="/">
      <input type="hidden" name="url" value="${escapeHtml(ruleUrl || '')}" />
      <input type="hidden" name="run" value="1" />
      ${keyField}
      ${inField}
      <button class="run" id="run-btn" type="submit">运行</button>
    </form>
  </div>
  <p class="foot"><a href="/">文档</a> · CppScript v14.2</p>
</div>
${boot}
</body>
</html>`;
}

function runPageShell({ title, statusLabel, statusClass, ruleUrl, inputPreview, bodyHtml, redirectUrl }) {
  const redirectScript = redirectUrl
    ? `<script>setTimeout(function(){ location.replace(${JSON.stringify(String(redirectUrl))}); }, 800);</script>`
    : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>${escapeHtml(title || 'CppScript')}</title>
<style>${THEME_CSS}</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>CppScript</h1>
    <span class="badge ${statusClass || ''}">${escapeHtml(statusLabel || '')}</span>
    <span class="meta">主题随系统自动切换（prefers-color-scheme）</span>
  </header>
  <div class="card">
    <h2>规则 ?url=</h2>
    <pre>${escapeHtml(ruleUrl || '')}</pre>
  </div>
  ${
    inputPreview != null && String(inputPreview) !== ''
      ? `<div class="card"><h2>输入</h2><pre>${escapeHtml(inputPreview)}</pre></div>`
      : ''
  }
  <div class="card">
    <h2>输出</h2>
    <pre class="out" id="out">${bodyHtml || ''}</pre>
  </div>
  ${
    redirectUrl
      ? `<div class="card"><h2>即将跳转</h2><pre><a href="${escapeHtml(String(redirectUrl))}">${escapeHtml(String(redirectUrl))}</a></pre></div>`
      : ''
  }
  <p class="foot"><a href="/">文档</a> · CppScript v14.2</p>
</div>
${redirectScript}
</body>
</html>`;
}

async function serveDocs(env) {
  const docsUrl = (env && env.DOCS_URL) || DEFAULT_DOCS_URL;
  try {
    const res = await fetch(docsUrl, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      let html = await res.text();
      if (!/color-scheme/i.test(html.slice(0, 800))) {
        html = html.replace(
          /<head[^>]*>/i,
          (m) => `${m}\n<meta name="color-scheme" content="light dark" />`,
        );
      }
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
        },
      });
    }
  } catch {
    // fall through
  }
  const fallback = `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="UTF-8"/><meta name="color-scheme" content="light dark"/>
<title>CppScript</title><style>${THEME_CSS}</style></head><body>
<div class="wrap"><header><h1>CppScript v14.2</h1></header>
<div class="card"><h2>用法</h2>
<pre>/?url=&lt;规则文件URL&gt;&amp;key=...&amp;in=...</pre></div>
<p class="foot">文档加载失败，请检查 DOCS_URL 或仓库 index.html</p>
</div></body></html>`;
  return new Response(fallback, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let ruleUrl = url.searchParams.get('url');

    // POST 表单可能把 url/in/key 放在 body（只能读一次）
    let formIn = null;
    let formKey = null;
    let formRun = false;
    let bodyConsumed = false; // formData() 后禁止再 request.text()
    const method = request.method.toUpperCase();
    if (method === 'POST') {
      const ctype = (request.headers.get('content-type') || '').toLowerCase();
      if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
        try {
          const fd = await request.formData();
          bodyConsumed = true;
          if (!ruleUrl && fd.get('url')) ruleUrl = String(fd.get('url'));
          // 表单字段：有 name 就读（即使空字符串）
          if (fd.has('in')) formIn = String(fd.get('in') ?? '');
          if (fd.has('key')) formKey = String(fd.get('key') ?? '');
          if (String(fd.get('run') || '') === '1') formRun = true;
          if (formKey !== null) url.searchParams.set('key', formKey);
          if (formIn !== null) url.searchParams.set('in', formIn);
          url.searchParams.set('run', '1');
        } catch {
          // 读失败则不标记 consumed，留给 resolveInput
        }
      }
    }

    // 无 ?url=：文档
    if (!ruleUrl && (url.pathname === '/' || url.pathname === '/index.html')) {
      return serveDocs(env);
    }

    try {
      if (!ruleUrl) fail(400, 'missing ?url=', 'E41');

      let ruleText;
      try {
        const ruleRes = await fetch(ruleUrl, { signal: AbortSignal.timeout(10000) });
        if (!ruleRes.ok) fail(502, `rule fetch failed: ${ruleRes.status}`);
        ruleText = await ruleRes.text();
      } catch (e) {
        if (e instanceof HttpError) throw e;
        fail(502, `rule fetch error: ${e.message}`);
      }
      if (ruleText.length > 100 * 1024) fail(502, 'rule exceeds 100KB');

      const ast = parse(ruleText);
      const { needsKey, needsIn } = analyzeNeeds(ast);

      // 是否已在 URL/表单中出现该参数（允许值为空）
      const hasInParam = url.searchParams.has('in') || formIn !== null;
      const hasKeyParam = url.searchParams.has('key') || formKey !== null;

      // 脚本未用到 → 直接跑
      // 用到且缺对应参数 → 出表单
      // ?run=1 或表单提交 → 强制跑（空 key/in 也照跑）
      const missingKey = needsKey && !hasKeyParam;
      const missingIn = needsIn && !hasInParam;
      const wantRun =
        formRun ||
        url.searchParams.get('run') === '1' ||
        (!needsIn && !needsKey) ||
        (!missingKey && !missingIn);

      if (!wantRun) {
        const page = formPageShell({
          ruleUrl,
          needsIn: needsIn, // 用到才显示框
          needsKey: needsKey,
          prefillIn: url.searchParams.get('in') ?? '',
          prefillKey: url.searchParams.get('key') ?? '',
        });
        return new Response(page, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      // 输入：优先表单 in；body 若已被 formData 消费则不可再读
      let inputText;
      if (formIn !== null) {
        if (formIn.length > 1024 * 1024) fail(502, 'in exceeds 1MB', 'E51');
        inputText = formIn;
      } else if (bodyConsumed) {
        // 表单提交但没有 in 字段：用查询串 ?in=（若有），否则空
        const qin = url.searchParams.get('in');
        inputText = qin !== null ? qin : '';
      } else {
        inputText = await resolveInput(request, url, env);
      }
      const inputStream = new InputStream(inputText);

      return await executeAndRespond(ast, {
        url,
        env,
        inputStream,
        ruleUrl,
        inputPreview: inputText.length > 4000 ? inputText.slice(0, 4000) + '\n…' : inputText,
      });
    } catch (e) {
      const msg = (e && e.message) ? String(e.message) : String(e);
      const code = (e && e.code) ? String(e.code) : '';
      const status = (e && e.status) ? Number(e.status) : 500;
      try {
        const page = runPageShell({
          title: `CppScript · ${code || status}`,
          statusLabel: code ? `错误 ${code}` : '内部错误',
          statusClass: 'err',
          ruleUrl: ruleUrl || '',
          bodyHtml: escapeHtml(msg),
        });
        return new Response(page, {
          status: Number.isFinite(status) && status >= 400 && status < 600 ? status : 500,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      } catch (_) {
        return new Response('CppScript error: ' + msg, {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }
  },
};

/**
 * 执行规则 → 完整 HTML（禁止流式，避免空 body / 1101）
 */
async function executeAndRespond(ast, ctx) {
  try {
    const interp = new Interpreter(ast, {
      url: ctx.url,
      env: ctx.env,
      inputStream: ctx.inputStream,
      onChunk: null,
    });

    const result = await interp.run();
    const output = interp.output != null ? String(interp.output) : '';

    if (result && result.redirect && result.url) {
      const page = runPageShell({
        title: 'CppScript · redirect',
        statusLabel: '跳转 ' + String(result.status || 302),
        statusClass: 'ok',
        ruleUrl: ctx.ruleUrl,
        inputPreview: ctx.inputPreview,
        bodyHtml: escapeHtml(output || '(无 body 输出)'),
        redirectUrl: String(result.url),
      });
      return new Response(page, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    let st = 200;
    if (result && result.status != null) {
      const n = Number(result.status);
      if (Number.isFinite(n) && n >= 200 && n <= 599) st = n;
    }

    const page = runPageShell({
      title: 'CppScript · result',
      statusLabel: '完成 ' + String(st),
      statusClass: 'ok',
      ruleUrl: ctx.ruleUrl,
      inputPreview: ctx.inputPreview,
      bodyHtml: escapeHtml(output),
    });
    return new Response(page, {
      status: st,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (e) {
    const msg = (e && e.message) ? String(e.message) : String(e);
    const page = runPageShell({
      title: 'CppScript · error',
      statusLabel: '执行错误',
      statusClass: 'err',
      ruleUrl: ctx.ruleUrl || '',
      bodyHtml: escapeHtml(msg),
    });
    return new Response(page, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
