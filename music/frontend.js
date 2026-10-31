import { STYLE } from './frontend-style.js';
import { BODY_INNER } from './frontend-body.js';

const SCRIPT_TAGS = [
  '/frontend-js-state.js',
  '/frontend-js-utils.js',
  '/frontend-js-cache.js',
  '/frontend-js-lyric.js',
  '/frontend-js-player.js',
  '/frontend-js-preload.js',
  '/frontend-js-resolve.js',
  '/frontend-js-playlists.js',
  '/frontend-js-auth.js',
  '/frontend-js-app.js',
].map((src) => `<script src="${src}"></script>`).join('\n');

export const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#F7FBF1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#11140F" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Playlet">
<title>Playlet</title>
<link rel="manifest" href="/manifest.json?v=5">
<link rel="icon" type="image/png" href="/icon.png">
<link rel="apple-touch-icon" href="/icon.png">
<link rel="preconnect" href="https://fonts.font.im" crossorigin>
<link rel="stylesheet" href="https://fonts.font.im/css2?family=Roboto:wght@400;500;700&display=swap">
<script src="https://cdn.jsdelivr.net/npm/jsmediatags@3.9.7/dist/jsmediatags.min.js"></script>
${STYLE}
</head>
<body>
${BODY_INNER}
${SCRIPT_TAGS}
</body>
</html>`;
