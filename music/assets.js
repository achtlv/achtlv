export const MANIFEST_JSON = {
  name: "Playlet", short_name: "Playlet", start_url: "/", scope: "/",
  display: "standalone", background_color: "#F7FBF1", theme_color: "#386A20",
  orientation: "portrait",
  icons: [{ src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" }]
};
export const SW_CODE = [
  "const CACHE_NAME = 'playlet-shell-v18';",
  "var SHELL = ['/', '/index.html', '/manifest.json', '/icon.png'];",
  "self.addEventListener('install', function(e){",
  "  e.waitUntil(caches.open(CACHE_NAME).then(function(c){ return c.addAll(SHELL).catch(function(){}); }).then(function(){ return self.skipWaiting(); }));",
  "});",
  "self.addEventListener('activate', function(e){",
  "  e.waitUntil(caches.keys().then(function(keys){",
  "    return Promise.all(keys.filter(function(k){ return k!==CACHE_NAME; }).map(function(k){ return caches.delete(k); }));",
  "  }).then(function(){ return self.clients.claim(); }));",
  "});",
  "self.addEventListener('fetch', function(event){",
  "  var req = event.request;",
  "  if (req.method !== 'GET') return;",
  "  var url; try { url = new URL(req.url); } catch (e) { return; }",
  "  if (url.origin !== self.location.origin) return;",
  "  // API / SW 本身走网络",
  "  if (url.pathname.indexOf('/api/') === 0) return;",
  "  if (url.pathname === '/sw.js') return;",
  "  // 前端壳：缓存优先，后台更新（打开页面不强制打 Worker）",
  "  event.respondWith(",
  "    caches.open(CACHE_NAME).then(function(cache){",
  "      return cache.match(req).then(function(cached){",
  "        var net = fetch(req).then(function(res){",
  "          try{ if(res && res.ok){ cache.put(req, res.clone()); } }catch(e){}",
  "          return res;",
  "        }).catch(function(){ return cached; });",
  "        // 有缓存先返回缓存",
  "        return cached || net;",
  "      });",
  "    })",
  "  );",
  "});"
].join("\n");

const ICON_URL = "https://a1.boltp.com/2026/10/17/6ad2fcb06efbe.png";
export async function handleIcon() {
  try {
    const res = await fetch(ICON_URL, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
    if (!res.ok) throw new Error("icon");
    return new Response(res.body, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
  } catch (e) {
    return new Response(null, { status: 404 });
  }
}
