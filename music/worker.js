import { HTML } from './frontend.js';
import { MANIFEST_JSON, SW_CODE, handleIcon } from './assets.js';
import { STATE_SCRIPT } from './frontend-js-state.js';
import { UTILS_SCRIPT } from './frontend-js-utils.js';
import { CACHE_SCRIPT } from './frontend-js-cache.js';
import { LYRIC_SCRIPT } from './frontend-js-lyric.js';
import { PLAYER_SCRIPT } from './frontend-js-player.js';
import { PRELOAD_SCRIPT } from './frontend-js-preload.js';
import { RESOLVE_SCRIPT } from './frontend-js-resolve.js';
import { PLAYLISTS_SCRIPT } from './frontend-js-playlists.js';
import { AUTH_SCRIPT } from './frontend-js-auth.js';
import { APP_SCRIPT } from './frontend-js-app.js';
import {
  handleCacheGet, handleCacheSet, handleSearchKg, handleKgLyric, handleCheckAudio, handleProxyFetch, handleMediaProxy,
} from './handlers.js';

const JS_HEADERS = { 'Content-Type': 'application/javascript;charset=UTF-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' };
const JS_ROUTES = {
  '/frontend-js-state.js': STATE_SCRIPT,
  '/frontend-js-utils.js': UTILS_SCRIPT,
  '/frontend-js-cache.js': CACHE_SCRIPT,
  '/frontend-js-lyric.js': LYRIC_SCRIPT,
  '/frontend-js-player.js': PLAYER_SCRIPT,
  '/frontend-js-preload.js': PRELOAD_SCRIPT,
  '/frontend-js-resolve.js': RESOLVE_SCRIPT,
  '/frontend-js-playlists.js': PLAYLISTS_SCRIPT,
  '/frontend-js-auth.js': AUTH_SCRIPT,
  '/frontend-js-app.js': APP_SCRIPT,
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Range',
      }});
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === '/manifest.json') {
      return new Response(JSON.stringify(MANIFEST_JSON), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === '/sw.js') {
      return new Response(SW_CODE, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === '/icon.png') return await handleIcon();
    if (url.pathname === '/api/version') {
      return new Response(JSON.stringify({ version: '20261115.04' }), { headers: {
        'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store'
      }});
    }
    if (JS_ROUTES[url.pathname]) {
      return new Response(JS_ROUTES[url.pathname], { headers: JS_HEADERS });
    }
    if (url.pathname === '/api/cacheGet' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return handleCacheGet(body.key);
    }
    if (url.pathname === '/api/cacheSet' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return handleCacheSet(body.key, body.value);
    }
    if (url.pathname === '/api/searchKg' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return handleSearchKg(body.word || body.keyword || '');
    }
    if (url.pathname === '/api/kgLyric' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return handleKgLyric(body.hash || body.id || '');
    }
    
    if (url.pathname === '/api/checkAudio' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return handleCheckAudio(body.url || '');
    }
    if (url.pathname === '/api/proxyFetch' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return handleProxyFetch(body || {});
    }
    if (url.pathname === '/api/mediaProxy') {
      const u = url.searchParams.get('u') || url.searchParams.get('url') || '';
      return handleMediaProxy(request, u);
    }

    return new Response('Not Found', { status: 404 });
  }
};
