import { HTML } from './frontend.js';
import { handleIcon, MANIFEST_JSON, SW_CODE } from './assets.js';
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
  handleSearch,
  handleResolve,
  handleCheckAudio,
  handleCacheGet,
  handleCacheSet,
  handleDownload,
  handleOfficialResolve,
  proxy,
} from './handlers.js';

const JS_HEADERS = {
  'Content-Type': 'application/javascript;charset=UTF-8',
  'Cache-Control': 'no-cache',
};

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
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range',
        },
      });
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(HTML, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    if (url.pathname === '/manifest.json') {
      return new Response(JSON.stringify(MANIFEST_JSON), {
        headers: {
          'Content-Type': 'application/manifest+json;charset=UTF-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    if (url.pathname === '/sw.js') {
      return new Response(SW_CODE, {
        headers: {
          'Content-Type': 'application/javascript;charset=UTF-8',
          'Cache-Control': 'no-cache',
          'Service-Worker-Allowed': '/',
        },
      });
    }

    if (url.pathname === '/icon.png') {
      return await handleIcon();
    }

    if (JS_ROUTES[url.pathname]) {
      return new Response(JS_ROUTES[url.pathname], { headers: JS_HEADERS });
    }

    if (url.pathname === '/api/download') {
      return await handleDownload(
        url.searchParams.get('u') || '',
        url.searchParams.get('name') || '',
        request
      );
    }

    if (request.method !== 'POST') {
      return new Response('Not Found', { status: 404 });
    }

    let body = {};
    try {
      body = await request.json();
    } catch (e) {}

    const action = url.pathname.replace(/^\/api\//, '');
    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

    try {
      if (action === 'search') return await handleSearch(body.word || '');
      if (action === 'resolve') return await handleResolve(body.url || '');
      if (action === 'checkAudio') return await handleCheckAudio(body.url || '');
      if (action === 'cacheGet') return await handleCacheGet(body.key || '');
      if (action === 'cacheSet') return await handleCacheSet(body.key || '', body.value || '');
      if (action === 'officialResolve') return await handleOfficialResolve(body.id || '');

      if (action === 'getSongInfo') {
        return await proxy('getSongInfo', { id: body.id, timestamp: Date.now(), ip });
      }
      if (action === 'getSongUrl') {
        return await proxy('getSongUrl', {
          id: body.id,
          level: body.level || 'exhigh',
          timestamp: Date.now(),
          ip,
        });
      }
      if (action === 'getSongLyric') {
        return await proxy('getSongLyric', { id: body.id, timestamp: Date.now(), ip });
      }
    } catch (e) {
      return new Response(JSON.stringify({ code: 500, msg: e.message || 'Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
