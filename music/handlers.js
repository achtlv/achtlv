function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";
async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
    catch { return { ok: res.ok, status: res.status, data: null, text }; }
  } catch (e) {
    return { ok: false, status: 0, data: null, error: String(e.message || e) };
  } finally { clearTimeout(timer); }
}

export async function handleCacheGet(key) {
  const safeKey = String(key || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeKey) return json({ ok: false, msg: "无效 key" });
  try {
    const res = await fetch("https://textdb.online/" + encodeURIComponent(safeKey), { headers: { "User-Agent": UA } });
    if (!res.ok) return json({ ok: false, msg: "HTTP " + res.status });
    let val = (await res.text());
    if (val.indexOf('{"v":2') === 0) {
      try {
        const o = JSON.parse(val);
        if (o && o.v === 2 && o.n > 1) {
          const parts = [];
          for (let i = 0; i < o.n; i++) {
            const r2 = await fetch("https://textdb.online/" + encodeURIComponent(safeKey + "_c" + i), { headers: { "User-Agent": UA } });
            if (!r2.ok) return json({ ok: false, msg: "分片缺失" });
            parts.push(await r2.text());
          }
          val = parts.join("");
        }
      } catch (e) {}
    }
    return json({ ok: true, value: val });
  } catch (e) {
    return json({ ok: false, msg: String(e.message || e) });
  }
}

export async function handleCacheSet(key, value) {
  if (!key || value == null) return json({ ok: false, msg: "缺少参数" });
  const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeKey) return json({ ok: false, msg: "无效 key" });
  const val = String(value);
  const CHUNK = 1500;
  async function putOne(k, v) {
    const url = "https://textdb.online/update/?key=" + encodeURIComponent(k) + "&value=" + encodeURIComponent(String(v));
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    return res.ok;
  }
  try {
    if (val.length <= CHUNK) {
      return json({ ok: !!(await putOne(safeKey, val)) });
    }
    const n = Math.ceil(val.length / CHUNK);
    if (!(await putOne(safeKey, JSON.stringify({ v: 2, n: n })))) return json({ ok: false, msg: "meta fail" });
    for (let i = 0; i < n; i++) {
      if (!(await putOne(safeKey + "_c" + i, val.substring(i * CHUNK, (i + 1) * CHUNK))))
        return json({ ok: false, msg: "chunk " + i });
    }
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, msg: String(e.message || e) });
  }
}

export async function handleSearchKg(word) {
  const q = String(word || "").trim();
  if (!q) return json({ code: 400, msg: "空关键词" }, 400);
  try {
    const url = "https://songsearch.kugou.com/song_search_v2?keyword=" + encodeURIComponent(q) + "&page=1&pagesize=5&userid=-1&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0";
    const r = await fetchJson(url, { headers: { "User-Agent": UA } });
    const lists = (r.data && r.data.data && r.data.data.lists) || [];
    const songs = (lists || []).slice(0, 5).map((it) => {
      let pic = "";
      if (it.Image) pic = String(it.Image).replace("{size}", "400");
      if (pic && /stdmusic\/\d+\//.test(pic)) pic = pic.replace(/stdmusic\/\d+\//, "stdmusic/400/");
      const hash = (it.FileHash || it.HQFileHash || "").toLowerCase();
      return {
        id: "kg" + hash,
        name: it.SongName || it.OriSongName || "",
        artist: it.SingerName || "",
        pic,
        source: "kg",
      };
    }).filter((s) => s.id && s.id.length > 4);
    const first = songs[0] || null;
    if (first) {
      return json({
        code: 200,
        id: first.id,
        name: first.name,
        artist: first.artist,
        pic: first.pic || "",
        duration: first.duration || 0,
        source: "kg",
        data: { songs },
      });
    }
    return json({ code: 404, msg: "未找到酷狗歌曲" });
  } catch (e) {
    return json({ code: 500, msg: String(e.message || e) }, 500);
  }
}

export async function handleGetSongLyric(id) {
  return json({ code: 200, data: { lrc: { lyric: "" }, tlyric: { lyric: "" }, romalrc: { lyric: "" } } });
}
export async function handleGetSongUrl() { return json({ code: 404, msg: "client-side" }, 404); }
export async function handleGetSongInfo() { return json({ code: 404, msg: "client-side" }, 404); }
export async function handleDownload() { return json({ code: 404 }, 404); }
export async function handleOfficialResolve() { return json({ code: 404 }, 404); }
export async function proxy() { return new Response("not found", { status: 404 }); }



export async function handleKgLyric(hash) {
  let h = String(hash || "").toLowerCase().replace(/^kg/, "").replace(/[^a-f0-9]/g, "");
  if (h.length !== 32) return json({ code: 400, msg: "无效 hash: " + String(hash) }, 400);
  const headers = { "User-Agent": UA, "Referer": "https://www.kugou.com/", "Accept": "*/*" };

  async function downloadLrc(id, accesskey) {
    const dl = "https://lyrics.kugou.com/download?ver=1&client=pc&id=" + encodeURIComponent(id) +
      "&accesskey=" + encodeURIComponent(accesskey || "") + "&fmt=lrc&charset=utf8";
    const dr = await fetchJson(dl, { headers }, 10000);
    let content = (dr.data && dr.data.content) || "";
    if (!content) return "";
    if (!/\[\d{1,2}:\d{2}/.test(content)) {
      try {
        const bin = atob(content);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        content = new TextDecoder("utf-8").decode(bytes);
      } catch (e) { return ""; }
    }
    return content.replace(/^\uFEFF/, "");
  }

  function scoreCandidate(c) {
    let s = Number(c.score) || 0;
    if (Number(c.transuid) > 0) s += 1000;
    if (c.transname) s += 100;
    if (c.language && /中|译/.test(String(c.language))) s += 50;
    return s;
  }

  // 从 LRC 里拆出可能的翻译行：同一时间戳两行，或 日文/中文 并用
  function splitMainTrans(lrc) {
    if (!lrc) return { main: "", trans: "" };
    const lines = String(lrc).split(/\r?\n/);
    const byTime = {};
    const order = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\[(\d{1,2}:\d{2}(?:\.\d+)?)\](.*)$/);
      if (!m) continue;
      const t = m[1], text = (m[2] || "").trim();
      if (!text) continue;
      if (!byTime[t]) { byTime[t] = []; order.push(t); }
      byTime[t].push(text);
    }
    let hasPair = false;
    const mainLines = [];
    const transLines = [];
    for (let i = 0; i < order.length; i++) {
      const t = order[i];
      const arr = byTime[t];
      if (arr.length >= 2) {
        hasPair = true;
        mainLines.push("[" + t + "]" + arr[0]);
        transLines.push("[" + t + "]" + arr[1]);
      } else {
        mainLines.push("[" + t + "]" + arr[0]);
      }
    }
    if (hasPair) return { main: mainLines.join("\n"), trans: transLines.join("\n") };
    return { main: lrc, trans: "" };
  }

  try {
    const searchUrl = "https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=&duration=&hash=" + encodeURIComponent(h);
    const sr = await fetchJson(searchUrl, { headers }, 10000);
    let list = (sr.data && sr.data.candidates) || [];
    if (!Array.isArray(list)) list = [];
    list = list.slice().sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

    let bestMain = "";
    let bestTrans = "";
    for (let i = 0; i < Math.min(list.length, 8); i++) {
      const c = list[i];
      const id = c.id || c.kid || c.lyric_id;
      if (!id) continue;
      const content = await downloadLrc(id, c.accesskey || c.accessKey || "");
      if (!content || !/\[\d{1,2}:\d{2}/.test(content)) continue;
      const sp = splitMainTrans(content);
      if (!bestMain) bestMain = sp.main || content;
      if (sp.trans && !bestTrans) bestTrans = sp.trans;
      // 若 candidate 自带 transuid，再拉一次（有的接口同 id 不同 accesskey）
      if (Number(c.transuid) > 0 && !bestTrans) {
        try {
          const tcontent = await downloadLrc(c.transuid, c.accesskey || "");
          if (tcontent && /\[\d{1,2}:\d{2}/.test(tcontent)) bestTrans = tcontent;
        } catch (e) {}
      }
      if (bestMain && bestTrans) break;
    }

    if (bestMain) {
      return json({
        code: 200,
        data: {
          lyric: bestMain,
          tlyric: bestTrans || "",
          romalrc: "",
        },
      });
    }
  } catch (e) {}

  // 回退 krc.php
  const krcUrls = [
    "https://m.kugou.com/app/i/krc.php?cmd=100&hash=" + encodeURIComponent(h) + "&timelength=999999&d=0.1",
    "https://m3ws.kugou.com/app/i/krc.php?cmd=100&hash=" + encodeURIComponent(h) + "&timelength=999999&d=0.1",
  ];
  for (let i = 0; i < krcUrls.length; i++) {
    try {
      const r = await fetchJson(krcUrls[i], { headers }, 12000);
      let raw = "";
      if (r.text && String(r.text).trim()) raw = r.text;
      else if (typeof r.data === "string") raw = r.data;
      else if (r.data && r.data.lyric) raw = r.data.lyric;
      if (raw) {
        raw = String(raw).replace(/^\uFEFF/, "");
        if (/\[\d{1,2}:\d{2}/.test(raw)) {
          const sp = splitMainTrans(raw);
          return json({ code: 200, data: { lyric: sp.main || raw, tlyric: sp.trans || "", romalrc: "" } });
        }
      }
    } catch (e) {}
  }
  return json({ code: 404, msg: "暂无歌词" });
}






export async function handleCheckAudio(url) {
  let u = String(url || "").trim();
  if (!u) return json({ ok: false, msg: "缺少 url" }, 400);
  if (u.indexOf("//") === 0) u = "https:" + u;
  if (/^http:\/\//i.test(u)) u = u.replace(/^http:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) return json({ ok: false, msg: "无效链接" }, 400);
  const isBili = /bilivideo\.com|bilibili\.com/i.test(u);
  const headers = {
    "User-Agent": UA,
    "Range": "bytes=0-2047",
    "Accept": "*/*",
    "Referer": isBili ? "https://www.bilibili.com/" : "https://www.google.com/",
  };
  try {
    const res = await fetch(u, { method: "GET", headers, redirect: "follow" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const ok = res.ok || res.status === 206;
    let format = "";
    const path = u.split("?")[0].toLowerCase();
    const m = path.match(/\.([a-z0-9]+)$/);
    if (m) format = m[1];
    if (!format && /bilivideo|\.m4s/i.test(u)) format = "m4s";
    if (!ok) {
      return json({ ok: false, status: res.status, msg: "无法访问（HTTP " + res.status + "）", format, contentType: ct, needProxy: isBili });
    }
    // needProxy: 浏览器直连会丢 Referer 被 403 的源
    const needProxy = isBili || /upos-sz|bilivideo/i.test(u);
    let name = "外部音源";
    try {
      const segs = path.split("/");
      const last = segs[segs.length - 1] || "";
      if (last && last.length < 80) name = decodeURIComponent(last);
    } catch (e) {}
    return json({
      ok: true,
      url: u,
      format: format || "",
      contentType: ct,
      status: res.status,
      name,
      needProxy: !!needProxy,
    });
  } catch (e) {
    return json({ ok: false, msg: String(e.message || e) });
  }
}


export async function handleProxyFetch(body) {
  const url = String((body && body.url) || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) return json({ ok: false, msg: "无效 url" }, 400);
  const method = (body && body.method) || "GET";
  const headers = Object.assign({
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Charset": "utf-8",
  }, (body && body.headers) || {});
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), body.timeoutMs || 15000);
    const res = await fetch(url, { method, headers, body: body.body, signal: ctrl.signal });
    clearTimeout(timer);
    const buf = await res.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buf);
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}
    return json({
      ok: res.ok,
      status: res.status,
      data: data,
      text: text,
    });
  } catch (e) {
    return json({ ok: false, status: 0, msg: String(e.message || e) });
  }
}


export async function handleMediaProxy(request, urlParam) {
  let u = String(urlParam || "").trim();
  if (!u) {
    try {
      const body = await request.json();
      u = String(body.url || "").trim();
    } catch (e) {}
  }
  if (!u) return json({ ok: false, msg: "缺少 url" }, 400);
  if (u.indexOf("//") === 0) u = "https:" + u;
  if (/^http:\/\//i.test(u)) u = u.replace(/^http:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) return json({ ok: false, msg: "无效链接" }, 400);

  const headers = {
    "User-Agent": UA,
    "Referer": /bilivideo\.com|bilibili\.com/i.test(u) ? "https://www.bilibili.com/" : "https://www.google.com/",
    "Origin": /bilivideo\.com|bilibili\.com/i.test(u) ? "https://www.bilibili.com" : undefined,
    "Accept": "*/*",
  };
  // clean undefined
  Object.keys(headers).forEach(k => headers[k] === undefined && delete headers[k]);

  // forward range for seeking
  const range = request.headers.get("Range");
  if (range) headers["Range"] = range;

  try {
    const upstream = await fetch(u, { headers, redirect: "follow" });
    if (!upstream.ok && upstream.status !== 206) {
      return json({ ok: false, status: upstream.status, msg: "上游 " + upstream.status }, upstream.status);
    }
    const outHeaders = new Headers();
    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    outHeaders.set("Content-Type", ct);
    const cl = upstream.headers.get("content-length");
    if (cl) outHeaders.set("Content-Length", cl);
    const cr = upstream.headers.get("content-range");
    if (cr) outHeaders.set("Content-Range", cr);
    const ar = upstream.headers.get("accept-ranges");
    if (ar) outHeaders.set("Accept-Ranges", ar);
    outHeaders.set("Access-Control-Allow-Origin", "*");
    outHeaders.set("Cache-Control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
  } catch (e) {
    return json({ ok: false, msg: String(e.message || e) }, 502);
  }
}
