const UPSTREAM = "https://nextmusic.toubiec.cn";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function proxy(endpoint, body) {
  const res = await fetch(`${UPSTREAM}/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return json(data, res.status);
}

export async function handleCacheGet(key) {
  if (!key) return json({ ok: false, msg: "缺少 key" });
  const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeKey) return json({ ok: false, msg: "无效 key" });
  try {
    const res = await fetch("https://textdb.online/" + safeKey, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      },
      redirect: "follow",
    });
    if (!res.ok) return json({ ok: false, msg: "HTTP " + res.status });
    const text = await res.text();
    return json({ ok: true, value: text.trim() });
  } catch (e) {
    return json({ ok: false, msg: String(e.message || e) });
  }
}

export async function handleCacheSet(key, value) {
  if (!key || value === undefined || value === null) return json({ ok: false, msg: "缺少参数" });
  const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeKey) return json({ ok: false, msg: "无效 key" });
  const val = String(value);
  try {
    const url =
      "https://textdb.online/update/?key=" +
      encodeURIComponent(safeKey) +
      "&value=" +
      encodeURIComponent(val);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      },
      redirect: "follow",
    });
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch (e) {}
    // 回读校验是否写入成功
    const check = await fetch("https://textdb.online/" + safeKey, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      },
      redirect: "follow",
    });
    const got = (await check.text()).trim();
    const ok = got === val.trim() || got.indexOf(val.trim().slice(0, Math.min(80, val.length))) === 0;
    if (!ok) {
      return json({ ok: false, msg: "写入校验失败", debug: (bodyText || "").slice(0, 120) });
    }
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, msg: String(e.message || e) });
  }
}

function extractUrlFromText(text) {
  if (!text) return null;
  const t = String(text);
  const idx1 = t.indexOf("http://");
  const idx2 = t.indexOf("https://");
  let start = -1;
  if (idx1 === -1 && idx2 === -1) return null;
  if (idx1 === -1) start = idx2;
  else if (idx2 === -1) start = idx1;
  else start = Math.min(idx1, idx2);
  const s = t.substring(start);
  let end = s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10 || c === 13) {
      end = i;
      break;
    }
  }
  return s.substring(0, end);
}

function extractIdFromUrl(url) {
  if (!url) return null;
  const s = String(url);
  const keys = ["?id=", "&id=", "song?id="];
  for (let i = 0; i < keys.length; i++) {
    const idx = s.indexOf(keys[i]);
    if (idx === -1) continue;
    const start = idx + keys[i].length;
    let end = start;
    while (end < s.length) {
      const c = s.charCodeAt(end);
      if (c < 48 || c > 57) break;
      end++;
    }
    const num = s.substring(start, end);
    if (num.length >= 5) return num;
  }
  const idx2 = s.indexOf("/song/");
  if (idx2 !== -1) {
    const start2 = idx2 + 6;
    let end2 = start2;
    while (end2 < s.length) {
      const c = s.charCodeAt(end2);
      if (c < 48 || c > 57) break;
      end2++;
    }
    const num2 = s.substring(start2, end2);
    if (num2.length >= 5) return num2;
  }
  return null;
}

function getFormatFromUrl(url) {
  if (!url) return "";
  let s = String(url).toLowerCase();
  const qi = s.indexOf("?");
  if (qi !== -1) s = s.substring(0, qi);
  const hi = s.indexOf("#");
  if (hi !== -1) s = s.substring(0, hi);
  const exts = [
    "mp3","m4a","aac","flac","wav","ogg","opus","wma","weba","oga","mka","aiff","aif","ape","alac","amr","3ga",
    "m3u8","mp4","flv","wmv","mkv","webm","mov","avi","m4v","ts","3gp","3g2","ogv","mpg","mpeg","m2ts","f4v","rm","rmvb","asf"
  ];
  for (let i = 0; i < exts.length; i++) {
    const ext = exts[i];
    const needLen = ext.length + 1;
    if (s.length >= needLen) {
      const tail = s.substring(s.length - needLen);
      if (tail === "." + ext) return ext;
    }
  }
  return "";
}

function stripExtension(s) {
  if (!s) return "";
  const idx = s.lastIndexOf(".");
  if (idx > 0) return s.substring(0, idx);
  return s;
}

function replaceDashes(s) {
  if (!s) return "";
  let out = "";
  let prevWasDash = false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (c === "-" || c === "_") {
      if (!prevWasDash) {
        out += " ";
        prevWasDash = true;
      }
    } else {
      out += c;
      prevWasDash = false;
    }
  }
  return out.trim();
}

export async function handleSearch(word) {
  if (!word) return json({ code: 400, msg: "缺少搜索关键词" }, 400);

  const res = await fetch(
    "https://api.vkeys.cn/v2/music/netease?word=" + encodeURIComponent(word)
  );
  const data = await res.json();

  const d = data && data.data;
  let item = null;
  if (Array.isArray(d)) item = d[0];
  else if (d && Array.isArray(d.list)) item = d.list[0];
  else if (d && Array.isArray(d.songs)) item = d.songs[0];
  else if (d && (d.id || d.songId)) item = d;
  else if (d && d.data && (d.data.id || d.data.songId)) item = d.data;

  if (!item) return json({ code: 404, msg: "未找到歌曲" }, 404);

  const id = item.id || item.songId || item.song_id;
  const name = item.name || item.song || item.title || item.songName || word;

  let artist = item.singer || item.artist || item.artists || item.ar || "";
  if (Array.isArray(artist)) {
    artist = artist.map((a) => (a && a.name ? a.name : a)).filter(Boolean).join(" / ");
  } else if (artist && typeof artist === "object") {
    artist = artist.name || "";
  }

  const pic =
    item.cover ||
    item.pic ||
    item.picUrl ||
    item.picture ||
    item.coverUrl ||
    (item.al && item.al.picUrl) ||
    (item.album && item.album.picUrl) ||
    "";

  return json({ code: 200, id: String(id), name, artist: String(artist), pic });
}

export async function handleResolve(rawUrl) {
  if (!rawUrl) return json({ code: 400, msg: "缺少链接" }, 400);

  const link = extractUrlFromText(rawUrl) || String(rawUrl);

  let id = extractIdFromUrl(link);
  if (id) return json({ code: 200, id });

  const UA =
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

  try {
    const res = await fetch(link, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": UA },
    });
    const location = res.headers.get("Location");
    if (location) {
      id = extractIdFromUrl(location);
      if (id) return json({ code: 200, id });
    }
    try { if (res.body) await res.body.cancel(); } catch (e) {}
  } catch (e) {}

  try {
    const res = await fetch(link, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": UA },
    });
    id = extractIdFromUrl(res.url || "");
    if (id) {
      try { if (res.body) await res.body.cancel(); } catch (e) {}
      return json({ code: 200, id });
    }
    const finalUrl = String(res.url || "").toLowerCase();
    const isNetease =
      finalUrl.indexOf("music.163.com") !== -1 ||
      finalUrl.indexOf("163cn.tv") !== -1 ||
      finalUrl.indexOf("y.music.163.com") !== -1;
    if (isNetease) {
      try {
        const text = await res.text();
        id = extractIdFromUrl(text);
        if (id) return json({ code: 200, id });
      } catch (e) {}
    } else {
      try { if (res.body) await res.body.cancel(); } catch (e) {}
    }
  } catch (e) {
    return json({ code: 500, msg: "链接解析失败: " + e.message }, 500);
  }

  return json({ code: 404, msg: "无法从链接中提取歌曲 ID" }, 404);
}

export async function handleCheckAudio(url) {
  if (!url) return json({ ok: false, msg: "缺少链接" });
  const u = String(url).toLowerCase();
  if (u.indexOf("http://") !== 0 && u.indexOf("https://") !== 0) {
    return json({ ok: false, msg: "无效链接" });
  }

  try {
    const urlLower0 = String(url).toLowerCase();
    const reqHeaders = {
      Range: "bytes=0-2047",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    };
    if (
      urlLower0.indexOf("bilivideo.com") !== -1 ||
      urlLower0.indexOf("bilibili.com") !== -1 ||
      urlLower0.indexOf("hdslb.com") !== -1
    ) {
      reqHeaders["Referer"] = "https://www.bilibili.com/";
      reqHeaders["Origin"] = "https://www.bilibili.com";
    }
    const res = await fetch(url, {
      method: "GET",
      headers: reqHeaders,
      redirect: "follow",
    });

    try {
      if (res.body) {
        const reader = res.body.getReader();
        await reader.read();
        try { await reader.cancel(); } catch (e) {}
      }
    } catch (e) {}

    const rawCt = res.headers.get("Content-Type") || "";
    const ct = rawCt.toLowerCase().split(";")[0].trim();
    const finalUrl = res.url || url;
    const urlLower = finalUrl.toLowerCase();

    const CT_MAP = {
      "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/x-mp3": "mp3",
      "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a",
      "audio/aac": "aac", "audio/x-aac": "aac", "audio/aacp": "aac",
      "audio/flac": "flac", "audio/x-flac": "flac",
      "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/vnd.wave": "wav",
      "audio/ogg": "ogg", "application/ogg": "ogg", "application/x-ogg": "ogg",
      "audio/opus": "opus", "audio/x-opus+ogg": "opus",
      "audio/x-ms-wma": "wma", "audio/wma": "wma",
      "audio/webm": "weba", "audio/x-matroska": "mka",
      "audio/aiff": "aiff", "audio/x-aiff": "aiff",
      "video/mp4": "mp4", "video/x-m4v": "m4v",
      "video/x-flv": "flv", "video/flv": "flv",
      "video/x-ms-wmv": "wmv", "video/wmv": "wmv", "video/x-ms-asf": "wmv",
      "video/x-matroska": "mkv",
      "video/webm": "webm",
      "video/quicktime": "mov",
      "video/x-msvideo": "avi", "video/avi": "avi",
      "video/mp2t": "ts",
      "video/3gpp": "3gp",
      "video/3gpp2": "3g2",
      "video/ogg": "ogv",
      "video/mpeg": "mpg",
      "video/x-ms-vob": "vob",
      "application/vnd.apple.mpegurl": "m3u8",
      "application/x-mpegurl": "m3u8",
      "application/mpegurl": "m3u8",
      "audio/mpegurl": "m3u8",
      "audio/x-mpegurl": "m3u8",
      "application/vnd.apple.mpegurl.audio": "m3u8",
    };

    const extFormat = getFormatFromUrl(urlLower);
    let format = CT_MAP[ct] || "";

    if (!format) {
      const isGeneric =
        !ct ||
        ct === "application/octet-stream" ||
        ct === "binary/octet-stream" ||
        ct === "application/download" ||
        ct === "application/force-download" ||
        ct === "application/x-download";
      if (isGeneric && extFormat) format = extFormat;
    }
    if (!format && (ct.indexOf("audio/") === 0 || ct.indexOf("video/") === 0) && extFormat) {
      format = extFormat;
    }
    if (!format && urlLower.indexOf(".m3u8") !== -1) format = "m3u8";
    if (!format && urlLower.indexOf(".flv") !== -1) format = "flv";
    if (!format && ct.indexOf("audio/") === 0) format = "audio";
    if (!format && ct.indexOf("video/") === 0) format = "video";
    if (!format && extFormat && ct.indexOf("text/html") === -1) {
      format = extFormat;
    }

    if (!format) {
      return json({ ok: false, msg: "不是音频或视频文件 (" + (rawCt || "未知类型") + ")" });
    }

    let name = "";
    try {
      const u2 = new URL(finalUrl);
      const segments = u2.pathname.split("/");
      const last = decodeURIComponent(segments[segments.length - 1] || "");
      name = replaceDashes(stripExtension(last)).trim();
    } catch (e) {}
    if (!name) name = "外部音源";
    if (name.length > 60) name = name.slice(0, 60);

    return json({ ok: true, name, contentType: ct, url: finalUrl, format });
  } catch (e) {
    return json({ ok: false, msg: "请求失败: " + e.message });
  }
}

export async function handleDownload(targetUrl, name, req) {
  if (!targetUrl) return new Response("缺少 url", { status: 400 });
  const u = String(targetUrl).toLowerCase();
  if (u.indexOf("http://") !== 0 && u.indexOf("https://") !== 0) {
    return new Response("无效 url", { status: 400 });
  }

  const forwardHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
  };

  const range = req.headers.get("Range");
  if (range) forwardHeaders["Range"] = range;

  if (
    u.indexOf("bilivideo.com") !== -1 ||
    u.indexOf("bilibili.com") !== -1 ||
    u.indexOf("hdslb.com") !== -1
  ) {
    forwardHeaders["Referer"] = "https://www.bilibili.com/";
    forwardHeaders["Origin"] = "https://www.bilibili.com";
  }

  let res;
  try {
    res = await fetch(targetUrl, {
      method: "GET",
      headers: forwardHeaders,
      redirect: "follow",
    });
  } catch (e) {
    return new Response("下载失败: " + e.message, { status: 502 });
  }

  const rawCt = res.headers.get("Content-Type") || "";
  const ct = rawCt.toLowerCase().split(";")[0].trim();
  if (ct === "text/html" || ct.indexOf("application/json") === 0) {
    try { if (res.body) await res.body.cancel(); } catch (e) {}
    return new Response("目标不是音频/视频文件 (" + (rawCt || "未知类型") + ")", { status: 502 });
  }

  const respHeaders = new Headers();
  respHeaders.set("Access-Control-Allow-Origin", "*");
  respHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  respHeaders.set(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, Content-Type, Content-Disposition"
  );

  const passHeaders = [
    "Content-Type",
    "Content-Length",
    "Content-Range",
    "Accept-Ranges",
    "Last-Modified",
    "ETag",
  ];
  for (const h of passHeaders) {
    const v = res.headers.get(h);
    if (v) respHeaders.set(h, v);
  }
  if (!respHeaders.get("Accept-Ranges")) respHeaders.set("Accept-Ranges", "bytes");

  let fname = String(name || "").trim();
  if (!fname) {
    try {
      const uo = new URL(res.url || targetUrl);
      const segs = uo.pathname.split("/");
      fname = decodeURIComponent(segs[segs.length - 1] || "") || "download";
    } catch (e) {
      fname = "download";
    }
  }
  fname = fname.replace(/[\r\n"\\]/g, "_");
  const asciiFallback = fname.replace(/[^\x20-\x7E]/g, "_");
  respHeaders.set(
    "Content-Disposition",
    "attachment; filename=\"" + asciiFallback + "\"; filename*=UTF-8''" + encodeURIComponent(fname)
  );

  return new Response(res.body, {
    status: res.status,
    headers: respHeaders,
  });
}

export async function handleOfficialResolve(id) {
  const songId = String(id || "").trim();
  if (!songId || !/^\d+$/.test(songId)) {
    return json({ ok: false, msg: "无效歌曲 ID" });
  }
  const resolveUrl =
    "https://ebnr.xiyang6666.top/resolve/https://music.163.com/song?id=" +
    encodeURIComponent(songId);
  try {
    const res = await fetch(resolveUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      },
    });
    let audioUrl = "";
    if (res.status >= 300 && res.status < 400) {
      audioUrl = res.headers.get("Location") || res.headers.get("location") || "";
    } else if (res.ok) {
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.indexOf("json") !== -1) {
        try {
          const data = await res.json();
          audioUrl = data.url || data.data?.url || data.audio || "";
        } catch (e) {}
      } else if (ct.indexOf("audio") !== -1 || ct.indexOf("mpeg") !== -1) {
        audioUrl = resolveUrl;
      } else {
        // may still be redirect body empty
        audioUrl = res.headers.get("Location") || "";
      }
    }
    if (!audioUrl || !/^https?:\/\//i.test(audioUrl)) {
      // fallback: use resolve proxy URL itself
      audioUrl = resolveUrl;
    }
    // NetEase CDN links typically ~20min; default 1200s
    let expi = 1200;
    try {
      const m = audioUrl.match(/\/(20\d{12})\//);
      if (m) {
        // timestamp in path is generation time; assume ~2h validity remaining unknown → keep default
        expi = 1200;
      }
    } catch (e) {}
    return json({ ok: true, url: audioUrl, expi: expi, level: "official" });
  } catch (e) {
    return json({ ok: false, msg: String(e.message || e) });
  }
}
