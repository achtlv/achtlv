import { STYLE } from './frontend-style.js';
import { BODY_INNER } from './frontend-body.js';
const SCRIPT_TAGS = [
  '/frontend-js-state.js','/frontend-js-utils.js','/frontend-js-cache.js','/frontend-js-lyric.js',
  '/frontend-js-player.js','/frontend-js-preload.js','/frontend-js-resolve.js','/frontend-js-playlists.js',
  '/frontend-js-auth.js','/frontend-js-app.js',
].map(function(src){ return '<script src="'+src+'"></script>'; }).join('\n');
export const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="referrer" content="no-referrer">
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
<script src="https://fastly.jsdelivr.net/npm/jsmediatags@3.9.7/dist/jsmediatags.min.js"></script>
${STYLE}
</head>
<body>
<script>
(function(){
try{
var p=new URLSearchParams(location.search||'');
var a=p.get('add');var k=p.get('key');
if(a)sessionStorage.setItem('m3_pending_add',a);
if(k)sessionStorage.setItem('m3_pending_key',k);
}catch(e){}
})();
</script>

<script>
/* 先加载列表，再渲染首页：在任何业务脚本之前同步读取 storage */
(function(){
try{
var keys=['m3_playlist','m3_playlist_bak'];
var raw=null;
for(var i=0;i<keys.length;i++){
try{raw=localStorage.getItem(keys[i]);}catch(e){}
if(raw)break;
}
if(!raw){try{raw=sessionStorage.getItem('m3_playlist');}catch(e){}}
if(raw){window.__PLAYLET_PL_RAW__=raw;}
}catch(e){}
})();
</script>

${BODY_INNER}
${SCRIPT_TAGS}

<script>
/* 不依赖 app boot：脚本全部加载后强制恢复列表并结束「加载中」 */
(function(){
function forceDone(){
try{if(typeof restorePlaylist==='function')restorePlaylist();}catch(e){}
try{if(window.state){state.playlistLoading=false;if(state.playlist&&state.playlist.length&&state.current<0)state.current=0;}}catch(e){}
try{if(typeof render==='function')render();}catch(e){}
try{if(typeof triggerPreloadNeighbors==='function')triggerPreloadNeighbors();}catch(e){}
try{if(typeof resetProgressUI==='function'&&window.state&&!state.playing)resetProgressUI();}catch(e){}
try{
var loading=document.getElementById('emptyLoading');
var actions=document.getElementById('emptyActions');
var has=window.state&&state.playlist&&state.playlist.length>0;
if(loading)loading.style.display='none';
if(actions)actions.style.display=has?'none':'flex';
}catch(e){}
}
// 多次尝试，覆盖 boot 抛错 / storage 延迟
setTimeout(forceDone,0);
setTimeout(forceDone,100);
setTimeout(forceDone,300);
setTimeout(forceDone,800);
setTimeout(forceDone,1500);
})();
</script>

</body>
</html>`;
