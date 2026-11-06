export const STATE_SCRIPT = String.raw`
var $=function(id){return document.getElementById(id)};
var LF=String.fromCharCode(10);
var CR=String.fromCharCode(13);
var BS=String.fromCharCode(92);

var DEFAULT_ICON='/icon.png';
var SITE_TITLE='Playlet';
var LYRIC_RESUME_DELAY=5000;

var ICON={
play:'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
pause:'<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
prev:'<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>',
next:'<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>',
shuffle:'<svg viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>',
repeat:'<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>',
repeatOne:'<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/></svg>',
list:'<svg viewBox="0 0 24 24"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>',
download:'<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
share:'<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>',
add:'<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
del:'<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
star:'<svg viewBox="0 0 24 24"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/></svg>',
starFilled:'<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
clearAll:'<svg viewBox="0 0 24 24"><path d="M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12z"/></svg>',
exportIco:'<svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>',
importIco:'<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
arrow:'<svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>',
arrowUp:'<svg viewBox="0 0 24 24"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>',
arrowDown:'<svg viewBox="0 0 24 24"><path d="M12 16l6-6-1.41-1.41L12 13.17l-4.59-4.58L6 10z"/></svg>',
edit:'<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
check:'<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
refresh:'<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
copy:'<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>'
};

var state={
playlist:[],current:-1,playing:false,mode:'order',playlists:[],activePlaylistId:null,listHistory:[],theme:'green',tab:'player',user:null,syncPlaylists:true,syncSettings:true,lastLocalChangeAt:0,lastCloudChangeAt:0,
showLyric:false,lyric:'',audioUrl:'',quality:'',
lyricTrans:'',lyricRoma:'',
transEnabled:true,romaEnabled:false,
lyricLoading:false,
retrying:false,
lyricLines:[],lyricHasTime:false,lyricCurrent:-1,lyricUserScrolled:false,
editingOrder:false,
_lastLyricKey:null,_lastMediaKey:null,_lyricScrollTimer:null
};

var audio=document.createElement('video');
audio.style.position='absolute';
audio.style.left='-9999px';
audio.style.top='0';
audio.style.width='1px';
audio.style.height='1px';
audio.style.opacity='0';
audio.style.pointerEvents='none';
audio.setAttribute('playsinline','');
audio.setAttribute('webkit-playsinline','');
audio.preload='metadata';
if(document.body)document.body.appendChild(audio);
else document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(audio)});

var playToken=0,isSeeking=false,pendingSong=null;
var refreshToken=0;
var refreshingUrl=false;

var LEVELS=['exhigh','standard'];
var OFFICIAL_PREFIX='https://ebnr.xiyang6666.top/resolve/https://music.163.com/song?id=';
var COOKIE_NAME='m3_playlist';
var COOKIE_PLAYLISTS='m3_playlists';
var COOKIE_SETTINGS='m3_settings';
var COOKIE_HISTORY='m3_history';
var COOKIE_AUTH='m3_auth';
var COOKIE_LIST_HIST='m3_listhist';
var COOKIE_MAX=3800;
var HLS_CDN='https://fastly.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
var FLV_CDN='https://fastly.jsdelivr.net/npm/flv.js@1.6.2/dist/flv.min.js';

var QUALITY_LABEL={exhigh:'极高',standard:'标准',official:'官方',lossless:'无损'};
var QUALITY_RANK={lossless:4,exhigh:3,standard:2,official:1};
var MAX_PLAY_RANK=3;
var DETECT_TIMES=3;
var PRELOAD_DELAY=5000;
var PRELOAD_RETRY=10000;
var URL_SAFETY_BUFFER=60;
var DEFAULT_EXPI=1200;
var COVER_LYRIC_TTL_MS=7*24*3600*1000;

var AUDIO_FORMATS=['mp3','m4a','aac','flac','wav','ogg','opus','wma','weba','oga','mka','aiff','aif','ape','alac','amr','3ga'];
var VIDEO_FORMATS=['m3u8','mp4','flv','wmv','mkv','webm','mov','avi','m4v','ts','3gp','3g2','ogv','mpg','mpeg','m2ts','f4v','rm','rmvb','asf'];

var DOWNLOAD_LEVELS=[
{key:'lossless',label:'无损'},
{key:'exhigh',label:'极高'},
{key:'standard',label:'标准'},
{key:'official',label:'官方'}
];
var NETEASE_HOSTS=['music.163.com','163cn.tv','y.music.163.com','music.126.net','music.163.cn'];

var hlsInstance=null;
var hlsLoading=null;
var flvInstance=null;
var flvLoading=null;

var ALL_SCRIMS=['addScrim','clearScrim','renameScrim','shareScrim','downloadScrim','exportScrim','importScrim','listScrim','favScrim','loginScrim','changePassScrim','syncChoiceScrim','plImportScrim','urlKeyScrim','logoutScrim','plExportScrim','plNameScrim'];

function setIcon(id,html){var el=$(id);if(el&&html)el.innerHTML=html;}
setIcon('shareBtn',ICON.share);
setIcon('prevBtn',ICON.prev);
setIcon('nextBtn',ICON.next);
setIcon('playBtn',ICON.play);
setIcon('modeBtn',ICON.repeat);
setIcon('listBtn',ICON.list);
setIcon('downloadBtn',ICON.download);
setIcon('favBtn',ICON.star);
setIcon('addGo',ICON.arrow);
setIcon('sheetAdd',ICON.add);
setIcon('sheetClear',ICON.clearAll);
setIcon('sheetExport',ICON.exportIco);
setIcon('sheetImport',ICON.importIco);
setIcon('sheetEdit','<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>');
setIcon('retryBtn',ICON.refresh);
setIcon('downloadRetryBtn',ICON.refresh);
setIcon('exportCopy',ICON.copy);
setIcon('importGo',ICON.arrow);
setIcon('renameGo',ICON.check);
setIcon('plSortBtn','<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>');
setIcon('plImportBtn','<svg viewBox="0 0 24 24"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/></svg>');
setIcon('plAddBtn','<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/></svg>');
setIcon('plDetailExport','<svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>');
setIcon('plDetailSort','<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>');
setIcon('plDetailExport','<svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>');
setIcon('plDetailPlay',ICON.play);
setIcon('plDetailRename',ICON.edit);
setIcon('plDetailDelete',ICON.del);

setIcon('renameGo',ICON.check);
setIcon('plSortBtn','<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>');
setIcon('plImportBtn','<svg viewBox="0 0 24 24"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/></svg>');
setIcon('plAddBtn','<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/></svg>');
setIcon('plDetailExport','<svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>');
setIcon('plDetailSort','<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>');
setIcon('plDetailExport','<svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>');
setIcon('plDetailPlay',ICON.play);
setIcon('plDetailRename',ICON.edit);
setIcon('plDetailDelete',ICON.del);


function closeOtherScrims(exceptId){
for(var i=0;i<ALL_SCRIMS.length;i++){
if(ALL_SCRIMS[i]===exceptId)continue;
var el=$(ALL_SCRIMS[i]);
if(el)el.classList.remove('show');
}
}



function __bindTabBar(){
var bar=document.getElementById('tabbar');
if(!bar)return;
bar.querySelectorAll('.tab-item').forEach(function(btn){
btn.onclick=function(ev){
if(ev){try{ev.preventDefault();}catch(e){}}
var tab=btn.getAttribute('data-tab');
if(!tab)return;
if(typeof switchTab==='function'){
try{switchTab(tab);}catch(err){console.error(err);}
}else{
window.__pendingTab=tab;
}
};
});
}
__bindTabBar();
`;
