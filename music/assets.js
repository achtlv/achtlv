const FALLBACK_ICON_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export const MANIFEST_JSON = {
  name: "音乐播放器",
  short_name: "播放器",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#F7FBF1",
  theme_color: "#386A20",
  orientation: "portrait",
  icons: [
    {
      src: "/icon.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any"
    },
    {
      src: "/icon.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any"
    }
  ]
};

export const SW_CODE = [
  "const CACHE_NAME = 'music-player-v5';",
  "const ASSETS = ['/'];",
  "",
  "self.addEventListener('install', function(event){",
  "  event.waitUntil(",
  "    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(ASSETS); })",
  "  );",
  "  self.skipWaiting();",
  "});",
  "",
  "self.addEventListener('activate', function(event){",
  "  event.waitUntil(",
  "    caches.keys().then(function(keys){",
  "      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));",
  "    })",
  "  );",
  "  self.clients.claim();",
  "});",
  "",
  "self.addEventListener('fetch', function(event){",
  "  var req = event.request;",
  "  if (req.method !== 'GET') return;",
  "  var url;",
  "  try { url = new URL(req.url); } catch (e) { return; }",
  "  if (url.origin !== self.location.origin) return;",
  "  if (url.pathname.indexOf('/api/') === 0) return;",
  "  var isHtml = (url.pathname === '/' || url.pathname === '/index.html');",
  "  var isManifest = (url.pathname === '/manifest.json');",
  "  var isSw = (url.pathname === '/sw.js');",
  "  var isIcon = (url.pathname === '/icon.png');",
  "  if (isHtml || isManifest || isSw || isIcon) {",
  "    event.respondWith(",
  "      fetch(req).then(function(res){",
  "        try {",
  "          var copy = res.clone();",
  "          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });",
  "        } catch (e) {}",
  "        return res;",
  "      }).catch(function(){ return caches.match(req); })",
  "    );",
  "    return;",
  "  }",
  "  event.respondWith(",
  "    caches.match(req).then(function(cached){",
  "      if (cached) return cached;",
  "      return fetch(req).then(function(res){",
  "        try {",
  "          if (res && res.status === 200) {",
  "            var copy = res.clone();",
  "            caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });",
  "          }",
  "        } catch (e) {}",
  "        return res;",
  "      });",
  "    })",
  "  );",
  "});"
].join("\n");

const ICON_URL = "https://a1.boltp.com/2026/10/17/6ad2fcb06efbe.png";

export async function handleIcon() {
  try {
    const res = await fetch(ICON_URL, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/png,image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) return iconFallback();
    const ct = (res.headers.get("Content-Type") || "").toLowerCase();
    if (ct.indexOf("image") !== 0 && ct.indexOf("octet-stream") === -1) return iconFallback();
    const headers = new Headers();
    headers.set("Content-Type", "image/png");
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(res.body, { status: 200, headers });
  } catch (e) {
    return iconFallback();
  }
}

function iconFallback() {
  const bin = atob(FALLBACK_ICON_B64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Response(arr, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}