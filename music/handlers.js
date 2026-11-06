function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
function upgradeNeteaseUrl(url) {
  if (!url || typeof url !== "string") return url;
  return url.replace(/^http:\/\/(([a-z0-9.-]+)\.music\.126\.net)\//i, "https://$1/");
}
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
function qualitiesForLevel(level) {
  const lv = String(level || "").toLowerCase();
  if (lv === "lossless" || lv === "flac") return ["flac"];
  if (lv === "exhigh" || lv === "320k") return ["320k"];
  if (lv === "standard" || lv === "128k") return ["128k"];
  return ["320k"];
}
export async function handleGetSongUrl(id, level = "exhigh") {
  const songId = String(id || "").trim();
  if (!songId || !/^\d+$/.test(songId)) return json({ code: 400, msg: "无效歌曲 ID" }, 400);
  const qualities = qualitiesForLevel(level);
  for (const q of qualities) {
    for (const fn of [
      async () => {
        const r = await fetchJson("https://yy.zddyr.top/lx/api/?source=wy&songmid=" + encodeURIComponent(songId) + "&quality=" + encodeURIComponent(q));
        return (r.data && (r.data.url || (r.data.data && r.data.data.url))) || "";
      },
      async () => {
        const r = await fetchJson("https://c.wwwweb.top/music/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "wy", musicId: songId, quality: q }),
        });
        return r.data && Number(r.data.code) === 200 ? r.data.url : "";
      },
    ]) {
      try {
        let url = upgradeNeteaseUrl(await fn());
        if (url && /^https?:\/\//i.test(url)) return json({ code: 200, data: { url, expi: 1200, level: q } });
      } catch (e) {}
    }
  }
  return json({ code: 404, msg: "暂无可用音源" }, 404);
}
export async function handleGetSongInfo(id) {
  const songId = String(id || "").trim();
  if (!songId || !/^\d+$/.test(songId)) return json({ code: 400, msg: "无效歌曲 ID" }, 400);
  try {
    const r = await fetchJson("https://api.paugram.com/netease/?id=" + encodeURIComponent(songId));
    const d = r.data;
    if (d && (d.title || d.cover)) {
      return json({ code: 200, data: { songs: [{ id: Number(songId) || songId, name: d.title || "", ar: [{ name: d.artist || "" }], al: { picUrl: d.cover || "" }, dt: 0 }] } });
    }
  } catch (e) {}
  return json({ code: 200, data: { songs: [{ id: Number(songId) || songId, name: "", ar: [{ name: "" }], al: { picUrl: "" }, dt: 0 }] } });
}
export async function handleGetSongLyric(id) {
  const songId = String(id || "").trim();
  if (!songId || !/^\d+$/.test(songId)) return json({ code: 400, msg: "无效歌曲 ID" }, 400);
  try {
    const r = await fetchJson("https://api.vkeys.cn/v2/music/netease/lyric?id=" + encodeURIComponent(songId));
    const d = r.data && r.data.data;
    if (d && (d.lrc || d.trans || d.roma)) {
      return json({ code: 200, data: { lrc: { lyric: d.lrc || "" }, tlyric: { lyric: d.trans || "" }, romalrc: { lyric: d.roma || "" } } });
    }
  } catch (e) {}
  try {
    const r = await fetchJson("https://api.paugram.com/netease/?id=" + encodeURIComponent(songId));
    if (r.data && (r.data.lyric || r.data.sub_lyric)) {
      return json({ code: 200, data: { lrc: { lyric: r.data.lyric || "" }, tlyric: { lyric: r.data.sub_lyric || "" }, romalrc: { lyric: "" } } });
    }
  } catch (e) {}
  return json({ code: 200, data: { lrc: { lyric: "" }, tlyric: { lyric: "" }, romalrc: { lyric: "" } } });
}
export async function proxy(endpoint, body) {
  if (endpoint === "getSongUrl") return handleGetSongUrl(body.id, body.level || "exhigh");
  if (endpoint === "getSongInfo") return handleGetSongInfo(body.id);
  if (endpoint === "getSongLyric") return handleGetSongLyric(body.id);
  return json({ code: 404, msg: "未知接口" }, 404);
}
export async function handleCacheGet(key) {
  if (!key) return json({ ok: false, msg: "缺少 key" });
  const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeKey) return json({ ok: false, msg: "无效 key" });
  try {
    const res = await fetch("https://textdb.online/" + safeKey, { headers: { "User-Agent": UA } });
    if (!res.ok) return json({ ok: false, msg: "HTTP " + res.status });
    return json({ ok: true, value: (await res.text()).trim() });
  } catch (e) { return json({ ok: false, msg: String(e.message || e) }); }
}
export async function handleCacheSet(key, value) {
  if (!key || value == null) return json({ ok: false, msg: "缺少参数" });
  const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeKey) return json({ ok: false, msg: "无效 key" });
  try {
    await fetch("https://textdb.online/update/?key=" + encodeURIComponent(safeKey) + "&value=" + encodeURIComponent(String(value)), { headers: { "User-Agent": UA } });
    return json({ ok: true });
  } catch (e) { return json({ ok: false, msg: String(e.message || e) }); }
}
export async function handleSearch(word) {
  if (!word) return json({ code: 400, msg: "缺少搜索关键词" }, 400);
  const res = await fetch("https://api.vkeys.cn/v2/music/netease?word=" + encodeURIComponent(word));
  const data = await res.json();
  const d = data && data.data;
  let item = null;
  if (Array.isArray(d)) item = d[0];
  else if (d && Array.isArray(d.list)) item = d.list[0];
  else if (d && (d.id || d.songId)) item = d;
  if (!item) return json({ code: 404, msg: "未找到歌曲" }, 404);
  const id = item.id || item.songId;
  const name = item.name || item.song || item.title || word;
  let artist = item.singer || item.artist || "";
  if (Array.isArray(artist)) artist = artist.map((a) => (a && a.name ? a.name : a)).filter(Boolean).join(" / ");
  return json({ code: 200, id: String(id), name, artist: String(artist), pic: item.cover || item.pic || item.picUrl || "" });
}
function extractIdFromUrl(input) {
  const s = String(input || "");
  let m = s.match(/[?&]id=(\d+)/) || s.match(/song\/(\d+)/);
  if (m) return m[1];
  if (/^\d+$/.test(s.trim())) return s.trim();
  return "";
}
export async function handleResolve(rawUrl) {
  if (!rawUrl) return json({ code: 400, msg: "缺少链接" }, 400);
  let id = extractIdFromUrl(rawUrl);
  if (id) return json({ code: 200, id });
  try {
    const res = await fetch(String(rawUrl), { redirect: "follow", headers: { "User-Agent": UA } });
    id = extractIdFromUrl(res.url || "");
    if (id) return json({ code: 200, id });
    id = extractIdFromUrl(await res.text());
    if (id) return json({ code: 200, id });
  } catch (e) { return json({ code: 500, msg: String(e.message || e) }, 500); }
  return json({ code: 404, msg: "无法提取歌曲 ID" }, 404);
}
export async function handleCheckAudio(url) {
  if (!url || !/^https?:\/\//i.test(url)) return json({ ok: false, msg: "无效链接" });
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-2047", "User-Agent": UA }, redirect: "follow" });
    try { if (res.body) { const r = res.body.getReader(); await r.read(); await r.cancel(); } } catch (e) {}
    const ct = (res.headers.get("Content-Type") || "").toLowerCase();
    let format = "";
    if (ct.indexOf("mpeg") !== -1 || ct.indexOf("mp3") !== -1) format = "mp3";
    else if (ct.indexOf("flac") !== -1) format = "flac";
    else if (ct.indexOf("mp4") !== -1 || ct.indexOf("m4a") !== -1) format = "m4a";
    return json({ ok: res.ok || res.status === 206, format, url: res.url || url, status: res.status, contentType: ct });
  } catch (e) { return json({ ok: false, msg: String(e.message || e) }); }
}
export async function handleDownload(targetUrl, name, req) {
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) return json({ ok: false, msg: "无效下载链接" }, 400);
  const headers = { "User-Agent": UA };
  const range = req && req.headers && req.headers.get("Range");
  if (range) headers["Range"] = range;
  const res = await fetch(targetUrl, { headers, redirect: "follow" });
  const respHeaders = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = res.headers.get(h); if (v) respHeaders.set(h, v);
  }
  respHeaders.set("Access-Control-Allow-Origin", "*");
  let fname = String(name || "download").replace(/[\r\n"\\]/g, "_");
  respHeaders.set("Content-Disposition", 'attachment; filename="' + fname.replace(/[^\x20-\x7E]/g, "_") + '"');
  return new Response(res.body, { status: res.status, headers: respHeaders });
}
export async function handleOfficialResolve(id) {
  const songId = String(id || "").trim();
  if (!songId || !/^\d+$/.test(songId)) return json({ ok: false, msg: "无效歌曲 ID" });
  const resolveUrl = "https://ebnr.xiyang6666.top/resolve/https://music.163.com/song?id=" + encodeURIComponent(songId);
  try {
    const res = await fetch(resolveUrl, { redirect: "manual", headers: { "User-Agent": UA } });
    let audioUrl = res.headers.get("Location") || "";
    if (!audioUrl && res.ok) {
      try { const data = await res.json(); audioUrl = data.url || (data.data && data.data.url) || ""; } catch (e) {}
    }
    if (!audioUrl) audioUrl = resolveUrl;
    return json({ ok: true, url: upgradeNeteaseUrl(audioUrl), expi: 1200, level: "official" });
  } catch (e) { return json({ ok: false, msg: String(e.message || e) }); }
}
