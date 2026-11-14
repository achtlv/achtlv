export const APP_SCRIPT = String.raw`var APP_VERSION='20261115.04';
function blurControl(el){
try{if(el&&el.blur)el.blur();}catch(e){}
try{if(document.activeElement&&document.activeElement!==document.body)document.activeElement.blur();}catch(e){}
}
function showScrim(id){
var el=typeof id==='string'?$(id):id;
if(!el)return;
var wasOpen=el.classList.contains('show')||(el.style.display&&el.style.display!=='none'&&el.style.display!=='');
el.style.display='flex';
requestAnimationFrame(function(){el.classList.add('show');});
// 打开弹窗时压入历史，返回键优先关弹窗而不是退出页面
if(!wasOpen){
try{history.pushState({app:1,scrim:1},'');}catch(e){}
}
}

function hideScrim(id){
var el=typeof id==='string'?$(id):id;
if(!el)return;
el.classList.remove('show');
el.style.display='none';
try{el.style.removeProperty&&el.style.removeProperty('display');el.style.display='none';}catch(e){}
}
function clearUrlShareParams(){
try{
var u=new URL(location.href);
u.searchParams.delete('add');
u.searchParams.delete('key');
var q=u.searchParams.toString();
history.replaceState(null,'',u.pathname+(q?('?'+q):'')+u.hash);
}catch(e){
try{history.replaceState(null,'',location.pathname);}catch(e2){}
}
try{sessionStorage.removeItem('m3_pending_add');}catch(e){}
try{sessionStorage.removeItem('m3_pending_key');}catch(e){}
window._urlShareHandled=true;
}
// ==================== Media Session ====================
function bindMediaSessionActions(){
if(!('mediaSession' in navigator))return;
try{
navigator.mediaSession.setActionHandler('play',function(){
try{if(!state.playing)togglePlay();}catch(e){}
try{updateMediaSessionPlaybackState();}catch(e){}
});
}catch(e){}
try{
navigator.mediaSession.setActionHandler('pause',function(){
try{if(state.playing)togglePlay();}catch(e){}
try{updateMediaSessionPlaybackState();}catch(e){}
});
}catch(e){}
try{
navigator.mediaSession.setActionHandler('previoustrack',function(){
if(typeof prevSong==='function')prevSong();
});
}catch(e){}
try{
navigator.mediaSession.setActionHandler('nexttrack',function(){
if(typeof nextSong==='function')nextSong();
});
}catch(e){}
try{
navigator.mediaSession.setActionHandler('stop',function(){
try{if(state.playing)togglePlay();}catch(e){}
try{navigator.mediaSession.playbackState='paused';}catch(e){}
});
}catch(e){}
}

function setupMediaSession(){
if(!('mediaSession' in navigator))return;
try{
bindMediaSessionActions();
navigator.mediaSession.setActionHandler('stop',function(){
try{audio.pause();audio.currentTime=0;}catch(e){}
});
try{navigator.mediaSession.setActionHandler('seekbackward',function(d){
var t=audio.currentTime-(d&&d.seekOffset?d.seekOffset:10);
audio.currentTime=Math.max(0,t);
});}catch(e){}
try{navigator.mediaSession.setActionHandler('seekforward',function(d){
var t=audio.currentTime+(d&&d.seekOffset?d.seekOffset:10);
if(audio.duration)audio.currentTime=Math.min(audio.duration,t);
});}catch(e){}
try{navigator.mediaSession.setActionHandler('seekto',function(d){
if(d&&d.seekTime!==undefined)audio.currentTime=d.seekTime;
});}catch(e){}
}catch(e){}
updateMediaSessionMetadata();
}

// ==================== 分享链接 ====================
function buildShareLink(song){
if(!song)return '';
var base=location.origin+location.pathname;
var val='';
if(song.external){val=song.url||'';}
else{val=song.id||'';}
return base+'?add='+encodeURIComponent(val);
}

// ==================== 重新检测音源（只升不降） ====================
async function retryQuality(){
var song=state.playlist[state.current];
if(!song||song.external)return;
if(state.retrying)return;
state.retrying=true;
render();
var q='';
try{
q=await detectNeteaseQuality(song.id,song.duration);
}catch(e){
q='';
}
state.retrying=false;

var curRank=qualityRank(state.quality);
var newRank=qualityRank(q);

if(q&&newRank>curRank){
state.quality=q;
toast('已找到更高音质：'+(QUALITY_LABEL[q]||q));
var pos=0;
try{pos=audio.currentTime||0;}catch(e){}
playIndex(state.current,q,pos);
return;
}
if(q&&newRank===curRank){
toast('当前已是最优音源');
}else if(q){
toast('当前音源已是最优，保持现有音质');
}else{
if(curRank>0){
toast('新检测无可用音源，保持当前音质');
}else{
state.quality='unavailable';
toast('仍然没有可用音源');
}
}
render();
}

// ==================== 渲染 ====================

function updateMediaSessionMetadata(){
if(!('mediaSession' in navigator))return;
try{
var song=state.playlist[state.current];
if(!song){
try{navigator.mediaSession.metadata=null;}catch(e){}
return;
}
var title=song.name||'未知歌曲';
var artist=song.artist||'未知歌手';
var album=song.album||'Playlet';
var artwork=[];
var pic=song.pic||song.cover||'';
if(pic){
if(String(pic).indexOf('//')===0)pic='https:'+pic;
if(/^http:\/\//i.test(pic))pic=String(pic).replace(/^http:\/\//i,'https://');
if(/^https?:\/\//i.test(pic)){
artwork=[
{src:pic,sizes:'96x96',type:'image/jpeg'},
{src:pic,sizes:'256x256',type:'image/jpeg'},
{src:pic,sizes:'512x512',type:'image/jpeg'}
];
}
}
navigator.mediaSession.metadata=new MediaMetadata({
title:title,
artist:artist,
album:album,
artwork:artwork
});
}catch(e){}
try{navigator.mediaSession.playbackState=state.playing?'playing':'paused';}catch(e){}
}

function updateMediaSessionPlaybackState(){
if(!('mediaSession' in navigator))return;
try{
var ps=state.playing?'playing':'paused';
try{navigator.mediaSession.playbackState=ps==='playing'?'paused':'playing';}catch(e0){}
navigator.mediaSession.playbackState=ps;
}catch(e){}
try{
if(typeof audio!=='undefined'&&audio&&audio.duration&&isFinite(audio.duration)&&audio.duration>0){
navigator.mediaSession.setPositionState({
duration:audio.duration,
playbackRate:audio.playbackRate||1,
position:Math.min(Math.max(0,audio.currentTime||0),audio.duration)
});
}
}catch(e){}
}

function syncMediaSessionFromUi(){
try{updateMediaSessionPlaybackState();}catch(e){}
setTimeout(function(){try{updateMediaSessionPlaybackState();}catch(e){}},40);
setTimeout(function(){try{updateMediaSessionPlaybackState();}catch(e){}},150);
}

function scheduleMediaSessionUpdate(){
var song=state.playlist[state.current];
var key=state.current+'|'+(song?(song.id||''):'')+'|'+(song?(song.name||''):'')+'|'+(song?(song.artist||''):'')+'|'+(song?(song.pic||''):'');
if(state._lastMediaKey===key)return;
state._lastMediaKey=key;
updateMediaSessionMetadata();
}

function render(){
try{updateMediaSessionPlaybackState();}catch(e){}
// 首屏空白根因：boot 时读到空 storage，真正数据稍后才可读；每次 render 前若空则再读一次
try{
if(!state.playlist||!state.playlist.length){
if(typeof restorePlaylist==='function')restorePlaylist();
}
if(state.playlist&&state.playlist.length&&state.current<0)state.current=0;
}catch(e){}
var song=(state.current>=0)?state.playlist[state.current]:null;
var hasSongs=!!(state.playlist&&state.playlist.length>0);

$('title').textContent=song?(song.name||'未知歌曲'):(state.playlistLoading?'加载中':'未在播放');
$('artist').textContent=song?(song.artist||'未知歌手'):'—';

var qlabel=song?getQualityText(song,state.quality):'';
if(qlabel){
$('qualityBadge').textContent=qlabel;
var extCls=(state.quality==='external'||state.quality==='unavailable')?' ext':'';
$('qualityBadge').className='badge'+extCls;
$('qualityBadge').style.display='inline-block';
}else{
$('qualityBadge').style.display='none';
}

var showRetry=!!(song&&!song.external);
if(showRetry){
$('retryBtn').style.display='flex';
if(state.retrying)$('retryBtn').classList.add('spinning');
else $('retryBtn').classList.remove('spinning');
$('retryBtn').disabled=!!state.retrying;
}else{
$('retryBtn').style.display='none';
}

// 三态：加载中 / 有歌 / 确认空
var loadingPl=!!state.playlistLoading&&!hasSongs;
if($('emptyLoading'))$('emptyLoading').style.display=loadingPl?'flex':'none';
if($('emptyActions'))$('emptyActions').style.display=(!hasSongs&&!loadingPl)?'flex':'none';
$('coverBox').style.display=(hasSongs&&!state.showLyric)?'block':'none';
$('lyricBox').style.display=(hasSongs&&state.showLyric)?'block':'none';

var hasTrans=!!(state.lyricTrans&&state.lyricTrans.trim());
var hasRoma=!!(state.lyricRoma&&state.lyricRoma.trim());
var showLyricToolbar=!!(hasSongs&&state.showLyric&&(hasTrans||hasRoma));
$('lyricToolbar').style.display=showLyricToolbar?'flex':'none';

try{updateCoverDisplay();}catch(e){}
try{scheduleMediaSessionUpdate();}catch(e){}

try{
var lyrKey=(state.lyricLoading?'L':'l')+'|'+(state.lyric||'')+'|'+
(state.lyricTrans||'')+'|'+(state.lyricRoma||'')+'|'+
(state.transEnabled?'T':'t')+'|'+(state.romaEnabled?'R':'r');
if(state._lastLyricKey!==lyrKey){
state._lastLyricKey=lyrKey;
buildLyricView();
}
if(state.showLyric){
setTimeout(function(){updateLyricScroll(true)},30);
}
}catch(e){}

if($('playBtn'))// 与通知栏一致：只跟 state.playing（取链中也显示暂停键）
$('playBtn').innerHTML=state.playing?ICON.pause:ICON.play;
$('prevBtn').disabled=!hasSongs;
$('nextBtn').disabled=!hasSongs;
try{updateMediaSessionPlaybackState();}catch(e){}

var modeIcon=state.mode==='single'?ICON.repeatOne:(state.mode==='shuffle'?ICON.shuffle:ICON.repeat);
var modeText=state.mode==='single'?'单曲循环':(state.mode==='shuffle'?'随机播放':'顺序播放');
if($('modeBtn')){$('modeBtn').innerHTML=modeIcon||ICON.repeat;$('modeBtn').title=modeText;$('modeBtn').setAttribute('aria-label',modeText);}
if($('downloadBtn'))$('downloadBtn').innerHTML=ICON.download;
if($('listBtn'))$('listBtn').innerHTML=ICON.list||'<svg viewBox="0 0 24 24"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>';
$('listBtn').title=hasSongs?('列表 ('+state.playlist.length+')'):'列表';
$('listBtn').setAttribute('aria-label',$('listBtn').title);

$('sheetClear').disabled=!hasSongs;
$('sheetExport').disabled=!hasSongs;
$('sheetEdit').disabled=!hasSongs;
$('sheetTitle').textContent='当前'+(hasSongs?' ('+state.playlist.length+')':'');

renderList();
}

function renderList(){
var box=$('sheetList');
if(!state.playlist.length){
box.innerHTML='<div class="sheet-empty">当前列表为空</div>';
return;
}
var html='';
state.playlist.forEach(function(s,i){
var playing=i===state.current?' playing':'';
var tag='';
if(s.external){
var fm=s.format?s.format.toUpperCase():'外部';
var isVid=isVideoFormat(s.format);
tag='<span class="ext-tag'+(isVid?' vid':'')+'">'+(isVid?'▶ '+fm:fm)+'</span>';
}
html+='<div class="song-row'+playing+'" data-i="'+i+'">'+
'<div class="song-row-info">'+
'<div class="song-row-name"><span class="name-text">'+(s.name||'未知歌曲')+'</span>'+tag+'</div>'+
'<div class="song-row-artist">'+(s.artist||'未知歌手')+'</div>'+
'</div>';
if(state.editingOrder){
html+='<div class="song-row-actions">'+
'<button class="song-row-move" data-up="'+i+'" '+(i===0?'disabled':'')+' aria-label="上移">'+ICON.arrowUp+'</button>'+
'<button class="song-row-move" data-down="'+i+'" '+(i===state.playlist.length-1?'disabled':'')+' aria-label="下移">'+ICON.arrowDown+'</button>'+
'</div>';
}
if(s.external){
html+='<button class="song-row-rename" data-rename="'+i+'" aria-label="重命名">'+ICON.edit+'</button>';
}
html+='<button class="song-row-del" data-del="'+i+'" aria-label="删除">'+ICON.del+'</button>'+
'</div>';
});
box.innerHTML=html;
}

// ==================== 改名 ====================
var renamingIndex=-1;

function openRename(idx){
if(idx<0||idx>=state.playlist.length)return;
var song=state.playlist[idx];
if(!song||!song.external)return;
renamingIndex=idx;
$('renameInput').value=song.name||'';
closeOtherScrims('renameScrim');
showScrim('renameScrim');
setTimeout(function(){
$('renameInput').focus();
try{$('renameInput').select()}catch(e){}
},120);
}

function closeRename(){
hideScrim('renameScrim');
$('renameInput').blur();
renamingIndex=-1;
}

function confirmRename(){
if(renamingIndex<0||renamingIndex>=state.playlist.length){closeRename();return}
var newName=$('renameInput').value.trim();
if(!newName){toast('名称不能为空');return}
var song=state.playlist[renamingIndex];
if(!song){closeRename();return}
song.name=newName;
savePlaylist();
closeRename();
render();
toast('已重命名');
}

// ==================== 播放 ====================
async function playIndex(i,forcedQuality,startPos,opts){
if(i<0||i>=state.playlist.length)return;
opts=opts||{};
// opts.play: 明确指定是否播放；默认 true（点列表/确认添加等）；切歌时传入当前播放状态
var wantPlay=(opts.play!=null)?!!opts.play:true;
var token=++playToken;

// 先锁定播放意图，再 stopAudio
state.playing=wantPlay;
// loadingUrl 仅表示「因要播放而等待链接」，暂停切歌后台预取不占 loading
state.loadingUrl=!!wantPlay;

try{state._ignorePause=true;}catch(e){}
stopAudio();
setTimeout(function(){try{state._ignorePause=false;}catch(e){}},80);

// 换歌时清空「用户在取链中拖动」的标记（除非显式带了 startPos）
if(!(typeof startPos==='number'&&startPos>0)){
pendingSeekFromUser=false;
pendingSeekRatio=null;
}
resetProgressUI();
try{if($('seek'))$('seek').value='0';}catch(e){}
try{updateSeekBg(0);}catch(e){}

state.current=i;
try{savePlaylist();}catch(e){}
if(typeof updateFavBtn==='function')updateFavBtn();
state.showLyric=false;
state.audioUrl='';state.quality='';
// 再次确认，防止 stopAudio 期间被改掉
state.playing=wantPlay;
state.loadingUrl=!!wantPlay;

var song=state.playlist[i];
var pe=preloadCache[song.id];

if(pe&&pe.url&&pe.quality&&!song.external){
if(shouldRefreshUrl(pe,song)){
pe.url='';
pe.quality='';
pe.urlDone=false;
pe.urlExpireAt=0;
}
}

if(pe&&pe.lyricDone&&pe.lyric&&String(pe.lyric).trim()&&String(pe.lyric).trim()!=='暂无歌词'){
state.lyric=pe.lyric;
state.lyricTrans=pe.lyricTrans||'';
if(state.lyricTrans&&String(state.lyricTrans).trim()&&!state._transUserSet)state.transEnabled=true;
state.lyricRoma=pe.lyricRoma||'';
state.lyricLoading=false;
state._lastLyricKey=null;
}else{
state.lyric='';state.lyricTrans='';state.lyricRoma='';
state.lyricLoading=true;
state._lastLyricKey=null;
if(pe){pe.lyricDone=false;}
}

if(pe&&pe.pic&&!song.pic){
song.pic=pe.pic;
preloadCover(pe.pic);
}

// 切歌即取歌词/封面（与预加载邻居）
try{
if(typeof preloadSongLyric==='function')preloadSongLyric(song);
if(typeof preloadSongPic==='function')preloadSongPic(song);
if(typeof triggerPreloadNeighbors==='function')triggerPreloadNeighbors();
}catch(e){}

render();

var result;
try{
if(song.external){
result={url:song.url,level:'external',expi:0};
}else if(forcedQuality){
var u=await fetchPlayUrlLevel(song.id,forcedQuality,(song.duration||360)+URL_SAFETY_BUFFER);
if(!u)throw new Error('音源加载失败');
result={url:u,level:forcedQuality,expi:0};
}else if(pe&&pe.url&&isHttpUrl(pe.url)&&(pe.quality==='exhigh'||pe.quality==='320k'||pe.quality==='higher')){
result={url:(typeof upgradeMediaUrl==='function'?upgradeMediaUrl(pe.url):pe.url),level:'exhigh',expi:0};
}else if(pe&&pe.url&&isHttpUrl(pe.url)&&(pe.quality==='standard'||pe.quality==='128k')){
// 预加载仅有标准也先用，避免闪「无法加载」
result={url:(typeof upgradeMediaUrl==='function'?upgradeMediaUrl(pe.url):pe.url),level:'standard',expi:0};
}else{
result=await fetchPlayUrl(song.id,song.duration);
}
if(token!==playToken)return;
if(!result||!result.url){
// 再试一次本地（极宽松）
try{
if(typeof getLocalAudioUrlOnly==='function'){
var loc=await getLocalAudioUrlOnly(song.id,'exhigh',5);
if(!loc)loc=await getLocalAudioUrlOnly(song.id,'standard',5);
if(!loc)loc=await getLocalAudioUrlOnly(song.id,'lossless',5);
if(loc&&loc.url)result={url:upgradeMediaUrl(loc.url),level:'exhigh',expi:30,fromLocal:true};
}
}catch(e){}
}
if(!result||!result.url)throw new Error('音源无法加载');
state.audioUrl=result.url;
state.quality=result.level;
if(!song.external&&result.level!=='external'){
var e2=getPreloadEntry(song.id);
if(e2&&(!e2.quality||qualityRank(result.level)>=qualityRank(e2.quality))){
e2.url=result.url;
e2.quality=result.level;
e2.urlExpireAt=Date.now()+((result.expi||DEFAULT_EXPI)*1000);
}
}
render();
try{
await setAudioSource(result.url,song.format);
// 换源后强制从 0 起，避免进度条停在上一首末尾
try{audio.currentTime=0;}catch(e){}
try{resetProgressUI();}catch(e){}
if(token!==playToken){
state.loadingUrl=false;
try{audio.pause();}catch(e){}
render();
return;
}
// 暂停切歌：不自动 play，但不要 return，后面还要取歌词
if(!state.playing){
state.loadingUrl=false;
try{audio.pause();}catch(e){}
try{audio.currentTime=0;}catch(e){}
try{resetProgressUI();}catch(e){}
render();
// 不 return，继续走歌词逻辑
}else{
state.loadingUrl=false;
}
try{
var ratioToApply=null;
if(typeof startPos==='number'&&startPos>0&&audio.duration){
// startPos 为秒
ratioToApply=null;
var secPos=startPos;
var applySec=function(){
try{
if(audio.duration&&isFinite(audio.duration)&&audio.duration>0){
audio.currentTime=Math.min(secPos,audio.duration);
updateSeekBg((audio.currentTime/audio.duration)*100);
$('curTime').textContent=fmt(audio.currentTime);
}
}catch(e){}
};
if(audio.readyState>=1)applySec();
else audio.addEventListener('loadedmetadata',function once(){audio.removeEventListener('loadedmetadata',once);applySec();});
}else if(pendingSeekFromUser&&pendingSeekRatio!=null&&isFinite(pendingSeekRatio)){
ratioToApply=Math.max(0,Math.min(1,pendingSeekRatio));
pendingSeekRatio=null;
pendingSeekFromUser=false;
var applySeek=function(){
try{
if(audio.duration&&isFinite(audio.duration)&&audio.duration>0){
audio.currentTime=ratioToApply*audio.duration;
updateSeekBg(ratioToApply*100);
$('curTime').textContent=fmt(audio.currentTime);
}
}catch(e){}
};
if(audio.readyState>=1)applySeek();
else audio.addEventListener('loadedmetadata',function once(){audio.removeEventListener('loadedmetadata',once);applySeek();});
}else{
pendingSeekRatio=null;
pendingSeekFromUser=false;
}
}catch(e){}
// 暂停意图：确保不播；播放意图：必须显式 play（setAudioSource 不会自动播）
if(!state.playing){
try{audio.pause();}catch(e){}
try{audio.currentTime=0;}catch(e){}
try{resetProgressUI();}catch(e){}
}else if(token===playToken){
try{audio.currentTime=audio.currentTime||0;}catch(e){}
try{
var pGo=audio.play();
if(pGo&&pGo.catch)pGo.catch(function(err){
try{logEvent('error','playIndex.play失败',String(err&&err.message||err));}catch(e2){}
});
}catch(e){}
try{updateMediaSessionPlaybackState();}catch(e){}
}
}catch(e1){
// 失败再强刷一次链接（避免偶发过期/拦截）
if(token!==playToken)return;
if(!song.external){
try{
if(typeof invalidateAudioCache==='function'){
try{await invalidateAudioCache(song.id);}catch(e){}
}
var fresh=await fetchPlayUrlFresh(song.id);
if(token!==playToken)return;
if(fresh&&fresh.url){
result=fresh;
state.audioUrl=result.url;
state.quality=result.level;
render();
await setAudioSource(result.url,song.format);
}else{throw e1;}
}catch(e2){throw e1;}
}else{throw e1;}
}
if(startPos&&startPos>0){
try{audio.currentTime=startPos;}catch(e){}
}
}catch(e){
if(token!==playToken)return;
// 解析失败：停在当前曲；歌词仍继续取
state.playing=false;
state.loadingUrl=false;
state.audioUrl='';
state.quality='unavailable';
try{stopAudio();}catch(e2){}
try{toast(e.message||'播放失败');}catch(e3){}
try{logError('播放失败 id='+(song&&song.id),e);}catch(e4){}
try{render();}catch(e5){}
}

if(token!==playToken)return;
render();

if(song.external){
if(!state.lyric||state.lyricLoading){
state.lyric=isVideoFormat(song.format)?'视频音源，暂无歌词':'外部音源，暂无歌词';
state.lyricLoading=false;
render();
}
}else if(state.lyricLoading||!state.lyric){
var cachedLyric=null;
try{cachedLyric=await getCachedLyric(song.id);}catch(e){}
if(cachedLyric&&cachedLyric.trans){
// 缓存含翻译才直接用；否则继续请求，避免旧缓存缺翻译
state.lyric=cachedLyric.main||'暂无歌词';
state.lyricTrans=cachedLyric.trans||'';
if(state.lyricTrans&&String(state.lyricTrans).trim()&&!state._transUserSet)state.transEnabled=true;
if(state.lyricTrans&&String(state.lyricTrans).trim())state.transEnabled=true;
state.lyricRoma=cachedLyric.roma||'';
state.lyricLoading=false;
var eC=getPreloadEntry(song.id);
if(eC){
eC.lyric=state.lyric;
eC.lyricTrans=state.lyricTrans;
eC.lyricRoma=state.lyricRoma;
eC.lyricDone=true;
}
render();
}else if(cachedLyric&&!cachedLyric.trans){
// 先显示原文，后台补翻译
state.lyric=cachedLyric.main||'暂无歌词';
state.lyricTrans='';
if(state.lyricTrans&&String(state.lyricTrans).trim()&&!state._transUserSet)state.transEnabled=true;
state.lyricRoma=cachedLyric.roma||'';
state.lyricLoading=false;
render();
try{
var lrFix=await post('/api/getSongLyric',{id:song.id});
if(token!==playToken)return;
var mFix=extractLyricMulti(lrFix);
if(mFix.main)state.lyric=mFix.main;
state.lyricTrans=mFix.trans||'';
if(state.lyricTrans&&String(state.lyricTrans).trim()&&!state._transUserSet)state.transEnabled=true;
state.lyricRoma=mFix.roma||state.lyricRoma||'';
var eFix=getPreloadEntry(song.id);
if(eFix){
eFix.lyric=state.lyric;
eFix.lyricTrans=state.lyricTrans;
eFix.lyricRoma=state.lyricRoma;
eFix.lyricDone=true;
}
await saveLyricToCache(song.id,state.lyric,state.lyricTrans,state.lyricRoma);
render();
}catch(e){}
}else{
try{
var lr=await post('/api/getSongLyric',{id:song.id});
if(token!==playToken){
// 请求过期，但若当前仍是这首且仍在 loading，用 entry 兜底
try{
var curN=state.playlist[state.current];
if(curN&&String(curN.id)===String(song.id)&&state.lyricLoading){
var eN=getPreloadEntry(song.id);
if(eN&&eN.lyric){state.lyric=eN.lyric;state.lyricTrans=eN.lyricTrans||'';state.lyricRoma=eN.lyricRoma||'';}
state.lyricLoading=false;render();
}
}catch(e){}
return;
}
var m=extractLyricMulti(lr);
state.lyric=m.main||'暂无歌词';
state.lyricTrans=m.trans||'';
if(state.lyricTrans&&String(state.lyricTrans).trim()&&!state._transUserSet)state.transEnabled=true;
if(state.lyricTrans&&String(state.lyricTrans).trim())state.transEnabled=true;
state.lyricRoma=m.roma||'';
state.lyricLoading=false;
var e3=getPreloadEntry(song.id);
if(e3){
e3.lyric=state.lyric;
e3.lyricTrans=state.lyricTrans;
e3.lyricRoma=state.lyricRoma;
e3.lyricDone=true;
}
await saveLyricToCache(song.id,state.lyric,state.lyricTrans,state.lyricRoma);
render();
}catch(e){
if(token!==playToken)return;
state.lyric='暂无歌词';
state.lyricTrans='';
if(state.lyricTrans&&String(state.lyricTrans).trim()&&!state._transUserSet)state.transEnabled=true;state.lyricRoma='';
state.lyricLoading=false;
render();
}
}
}

if(!song.pic&&!song.external){
var cachedPic='';
try{cachedPic=await getCachedCover(song.id);}catch(e){}
if(cachedPic){
song.pic=cachedPic;
preloadCover(cachedPic);
var eCp=getPreloadEntry(song.id);
if(eCp){eCp.pic=cachedPic;eCp.picDone=true;}
render();
}else{
try{
var info=await post('/api/getSongInfo',{id:song.id});
if(token!==playToken)return;
var m=extractInfo(info);
if(m&&m.pic){
song.pic=m.pic;
if(!song.duration&&m.duration>0)song.duration=m.duration;
preloadCover(m.pic);
var e4=getPreloadEntry(song.id);
if(e4){e4.pic=m.pic;e4.picDone=true;}
await saveCoverToCache(song.id,m.pic);
render();
}
}catch(e){}
}
}

if(token!==playToken)return;
triggerPreloadNeighbors();
}

function ensureShuffleOrder(opts){
opts=opts||{};
var n=state.playlist.length;
if(n<=0){state.shuffleOrder=[];state.shufflePos=0;return;}
// shuffleOrder 存歌曲 id，避免删歌后索引错位
var ids=state.playlist.map(function(s){return String(s&&s.id);});
for(var i=ids.length-1;i>0;i--){
var j=Math.floor(Math.random()*(i+1));
var t=ids[i];ids[i]=ids[j];ids[j]=t;
}
var avoidFirst=opts.avoidFirstId!=null?String(opts.avoidFirstId):(opts.avoidFirstIdx!=null&&state.playlist[opts.avoidFirstIdx]?String(state.playlist[opts.avoidFirstIdx].id):null);
var avoidLast=opts.avoidLastId!=null?String(opts.avoidLastId):(opts.avoidLastIdx!=null&&state.playlist[opts.avoidLastIdx]?String(state.playlist[opts.avoidLastIdx].id):null);
if(n>1&&avoidFirst!=null&&ids[0]===avoidFirst){
for(var k=1;k<n;k++){if(ids[k]!==avoidFirst){var u=ids[0];ids[0]=ids[k];ids[k]=u;break;}}
}
if(n>1&&avoidLast!=null&&ids[n-1]===avoidLast){
for(var k2=n-2;k2>=0;k2--){if(ids[k2]!==avoidLast){var u2=ids[n-1];ids[n-1]=ids[k2];ids[k2]=u2;break;}}
}
state.shuffleOrder=ids;
}
function indexOfSongId(id){
var sid=String(id);
for(var i=0;i<state.playlist.length;i++){
if(state.playlist[i]&&String(state.playlist[i].id)===sid)return i;
}
return -1;
}
function syncShuffleAfterPlaylistChange(){
if(state.mode!=='shuffle'){state.shuffleOrder=[];state.shufflePos=0;return;}
var n=state.playlist.length;
if(n<=0){state.shuffleOrder=[];state.shufflePos=0;return;}
var have={};
for(var i=0;i<n;i++){if(state.playlist[i])have[String(state.playlist[i].id)]=true;}
var valid=[];
if(state.shuffleOrder&&state.shuffleOrder.length){
for(var j=0;j<state.shuffleOrder.length;j++){
var id=String(state.shuffleOrder[j]);
if(have[id]){valid.push(id);delete have[id];}
}
}
// 新增歌曲追加到乱序列尾（再轻打乱新增段可选，这里保持追加）
var extras=[];
for(var k=0;k<n;k++){
var id2=String(state.playlist[k].id);
if(have[id2])extras.push(id2);
}
// 打乱新增部分再接上
for(var a=extras.length-1;a>0;a--){var b=Math.floor(Math.random()*(a+1));var t=extras[a];extras[a]=extras[b];extras[b]=t;}
state.shuffleOrder=valid.concat(extras);
var curId=state.playlist[state.current]?String(state.playlist[state.current].id):null;
var pos=curId!=null?state.shuffleOrder.indexOf(curId):-1;
state.shufflePos=(pos>=0?pos:0);
}
function nextSong(forcePlay, fromAuto){
if(!state.playlist.length)return;
var keepPlay=(forcePlay===true)?true:!!state.playing;
pendingSeekFromUser=false;pendingSeekRatio=null;try{resetProgressUI();}catch(e){}
if(state.mode==='single'&&fromAuto){
playIndex(state.current,null,null,{play:keepPlay});
return;
}
if(state.mode==='shuffle'){
if(!state.shuffleOrder||!state.shuffleOrder.length){
ensureShuffleOrder({avoidFirstIdx:state.current});
var curId0=state.playlist[state.current]?String(state.playlist[state.current].id):null;
state.shufflePos=curId0!=null?state.shuffleOrder.indexOf(curId0):-1;
}
if(state.shufflePos>=state.shuffleOrder.length-1){
var lastId=state.shuffleOrder[state.shuffleOrder.length-1];
ensureShuffleOrder({avoidFirstId:lastId});
state.shufflePos=0;
}else{state.shufflePos=(state.shufflePos<0?0:state.shufflePos+1);}
var nid=state.shuffleOrder[state.shufflePos];
var nidx=indexOfSongId(nid);
if(nidx<0){syncShuffleAfterPlaylistChange();nidx=indexOfSongId(state.shuffleOrder[state.shufflePos]);}
if(nidx>=0)playIndex(nidx,null,null,{play:keepPlay});
return;
}
playIndex((state.current+1)%state.playlist.length,null,null,{play:keepPlay});
}
function prevSong(){
if(!state.playlist.length)return;
var keepPlay=!!state.playing;
pendingSeekFromUser=false;pendingSeekRatio=null;try{resetProgressUI();}catch(e){}
if(state.mode==='shuffle'){
if(!state.shuffleOrder||!state.shuffleOrder.length){
ensureShuffleOrder({avoidLastIdx:state.current});
var curId1=state.playlist[state.current]?String(state.playlist[state.current].id):null;
state.shufflePos=curId1!=null?state.shuffleOrder.indexOf(curId1):0;
}
if(state.shufflePos<=0){
var firstId=state.shuffleOrder[0];
ensureShuffleOrder({avoidLastId:firstId});
state.shufflePos=state.shuffleOrder.length-1;
}else{state.shufflePos=state.shufflePos-1;}
var pid=state.shuffleOrder[state.shufflePos];
var pidx=indexOfSongId(pid);
if(pidx<0){syncShuffleAfterPlaylistChange();pidx=indexOfSongId(state.shuffleOrder[state.shufflePos]);}
if(pidx>=0)playIndex(pidx,null,null,{play:keepPlay});
return;
}
playIndex((state.current-1+state.playlist.length)%state.playlist.length,null,null,{play:keepPlay});
}




async function resumeWithRefresh(pos){
var song=state.playlist[state.current];
if(!song)return;
var myToken=++refreshToken;
refreshingUrl=true;
// 保持当前播放意图，不强制改成播放
render();
var fresh;
try{fresh=await fetchPlayUrlFresh(song.id);}catch(e){fresh=null;}

if(myToken!==refreshToken){
refreshingUrl=false;
return;
}
refreshingUrl=false;

if(!fresh||!fresh.url){
render();
audio.play().catch(function(){});
return;
}
var entry=getPreloadEntry(song.id);
if(entry&&fresh.level!=='external'){
entry.url=fresh.url;
entry.quality=fresh.level;
entry.urlExpireAt=Date.now()+((fresh.expi||DEFAULT_EXPI)*1000);
}
state.audioUrl=fresh.url;
state.quality=fresh.level;
render();

try{
await setAudioSource(fresh.url,song.format);
}catch(e){
toast(e.message||'重新获取后播放失败');
return;
}

try{audio.currentTime=pos;}catch(e){}
audio.play().catch(function(){});
}

async function togglePlay(){
try{if(!state.playlist||!state.playlist.length)restorePlaylist();}catch(e){}
try{state.playlistLoading=false;}catch(e){}
if(!state.playlist.length){openAdd();return}
if(state.current<0){playIndex(0);return}

// 1) 播放意图下正在取链 → 取消
if(state.loadingUrl&&state.playing){
try{playToken++;}catch(e){}
state.loadingUrl=false;
state.playing=false;
try{stopAudio();}catch(e){}
try{toast('已取消获取');}catch(e){}
render();try{syncMediaSessionFromUi();}catch(e){}
return;
}
// 2) 刷新音源中且正在播 → 取消刷新
if(refreshingUrl&&state.playing){
refreshToken++;
refreshingUrl=false;
state.playing=false;
try{audio.pause();}catch(e){}
render();
toast('已取消重新获取');
return;
}
// 3) 已在播 → 暂停（必须同步改 state.playing）
// 若意图播放但 audio 已停（歌词跳转刷新等导致），先恢复播放而不是再 pause
if(state.playing){
var audioPaused=true;
try{audioPaused=!!audio.paused;}catch(e){}
if(audioPaused&&!state.loadingUrl&&!refreshingUrl&&state.audioUrl){
try{
var pr=audio.play();
if(pr&&pr.catch)pr.catch(function(){});
}catch(e){}
try{updateMediaSessionPlaybackState();}catch(e){}
render();try{syncMediaSessionFromUi();}catch(e){}
return;
}
state.playing=false;
state.loadingUrl=false;
try{state._ignorePause=true;}catch(e){}
try{audio.pause();}catch(e){}
setTimeout(function(){try{state._ignorePause=false;}catch(e){}},50);
try{updateMediaSessionPlaybackState();}catch(e){}
render();try{syncMediaSessionFromUi();}catch(e){}
return;
}
// 4) 当前是暂停：开始播放（若后台已在取链则改为播放意图继续等）
if(state.loadingUrl&&!state.playing){
state.playing=true;
render();
if(state.audioUrl){
try{var p0=audio.play();if(p0&&p0.catch)p0.catch(function(){});}catch(e){}
}
return;
}

var song=state.playlist[state.current];
// 打开网站后列表已恢复但尚未取链：必须走 playIndex，不能只 audio.play()
var needLoad=false;
try{
if(!state.audioUrl)needLoad=true;
else if(!audio||!audio.src)needLoad=true;
else if(String(audio.src).indexOf('blob:')!==0&&String(audio.src).indexOf('http')!==0)needLoad=true;
}catch(e){needLoad=true;}
if(needLoad){
state.playing=true;
render();
await playIndex(state.current,null,null,{play:true});
return;
}

var pe=song&&preloadCache[song.id];
if(song&&!song.external&&pe&&pe.urlExpireAt){
var dur=audio.duration||0;
var cur=audio.currentTime||0;
var remaining=(isFinite(dur)&&dur>0)?(dur-cur):0;
if(remaining>0&&shouldRefreshUrlResume(pe,remaining)){
state.playing=true;
render();
toast('链接已过期，正在重新获取');
await resumeWithRefresh(cur);
return;
}
}
// 关键：先改状态再 play，避免按钮停在暂停图标且再也点不动
state.playing=true;
state.loadingUrl=false;
render();
try{
var pPlay=audio.play();
if(pPlay&&pPlay.catch)pPlay.catch(function(err){
try{logEvent('error','audio.play失败',String(err&&err.message||err));}catch(e){}
});
}catch(e){
try{logEvent('error','audio.play异常',String(e&&e.message||e));}catch(e2){}
}
}

// ==================== 进度条 ====================
function resetProgressUI(){
try{isSeeking=false;}catch(e){}
try{
if($('seek')){
$('seek').value='0';
$('seek').style.background='linear-gradient(to right, var(--primary) 0%, var(--outline-variant) 0%)';
}
}catch(e){}
try{if($('curTime'))$('curTime').textContent='0:00';}catch(e){}
try{if($('durTime'))$('durTime').textContent='0:00';}catch(e){}
try{updateSeekBg(0);}catch(e){}
}

function updateSeekBg(pct){
var el=$('seek');
if(!el)return;
if(!isFinite(pct))pct=0;
pct=Math.max(0,Math.min(100,Number(pct)||0));
el.style.transition='none';
el.style.background='linear-gradient(to right, var(--primary) '+pct+'%, var(--outline-variant) '+pct+'%)';
}

function getPlayingUrlExpireAt(){
var song=state.playlist[state.current];
if(!song||song.external)return 0;
var pe=getPreloadEntry(song.id);
return (pe&&pe.urlExpireAt)?pe.urlExpireAt:0;
}
function needsUrlRefreshForPosition(targetTime){
var song=state.playlist[state.current];
if(!song||song.external)return false;
if(state.quality==='official'||state.quality==='external')return false;
var dur=0;
if(audio.duration&&isFinite(audio.duration)&&audio.duration>0)dur=audio.duration;
else if(song.duration&&song.duration>0)dur=song.duration;
if(!dur||!isFinite(dur))return false;
var remaining=Math.max(0,dur-(targetTime||0));
var expireAt=getPlayingUrlExpireAt();
if(!expireAt)return false;
var needUntil=Date.now()+(remaining+URL_SAFETY_BUFFER)*1000;
return expireAt<needUntil;
}
async function seekWithUrlCheck(targetTime){
if(targetTime==null||!isFinite(targetTime)||targetTime<0)return;
var song=state.playlist[state.current];
if(!song)return;
if(audio.duration&&isFinite(audio.duration)){
if(targetTime>audio.duration)targetTime=audio.duration;
}
var wasPlaying=!!state.playing;
// 普通跳转：不刷新音源，避免误暂停
if(!needsUrlRefreshForPosition(targetTime)){
try{audio.currentTime=targetTime;}catch(e){}
if(wasPlaying){
try{
if(audio.paused){var p1=audio.play();if(p1&&p1.catch)p1.catch(function(){});}
}catch(e){}
}
if(state.showLyric&&state.lyricHasTime)updateLyricScroll(true);
try{updateMediaSessionPlaybackState();}catch(e){}
return;
}
// 需要换链：记住播放意图，刷新期间忽略 pause 事件
try{state._ignorePause=true;}catch(e){}
try{audio.pause();}catch(e){}
toast('音源即将过期，正在重新获取...');
var myToken=++refreshToken;
refreshingUrl=true;
render();
var fresh=null;
try{fresh=await fetchPlayUrlFresh(song.id);}catch(e){fresh=null;}
if(myToken!==refreshToken){refreshingUrl=false;try{state._ignorePause=false;}catch(e){}return;}
refreshingUrl=false;
if(!fresh||!fresh.url){
toast('重新获取音源失败');
try{audio.currentTime=targetTime;}catch(e){}
if(wasPlaying||state.playing){
state.playing=true;
try{var p2=audio.play();if(p2&&p2.catch)p2.catch(function(){});}catch(e){}
}
try{state._ignorePause=false;}catch(e){}
try{updateMediaSessionPlaybackState();}catch(e){}
render();
return;
}
var entry=getPreloadEntry(song.id);
if(entry&&fresh.level!=='external'){
entry.url=fresh.url;
entry.quality=fresh.level;
entry.urlExpireAt=Date.now()+((fresh.expi||DEFAULT_EXPI)*1000);
}
state.audioUrl=fresh.url;
state.quality=fresh.level;
try{
await setAudioSource(fresh.url,song.format);
try{audio.currentTime=targetTime;}catch(e){}
if(wasPlaying||state.playing){
state.playing=true;
try{var _sp=audio.play();if(_sp&&_sp.catch)_sp.catch(function(){});}catch(e){}
}else{
try{audio.pause();}catch(e){}
}
if(state.showLyric&&state.lyricHasTime)setTimeout(function(){updateLyricScroll(true);},50);
}catch(e){
toast(e.message||'跳转失败');
// 失败也尽量恢复播放意图
if(wasPlaying){
state.playing=true;
try{var p3=audio.play();if(p3&&p3.catch)p3.catch(function(){});}catch(e2){}
}
}
try{state._ignorePause=false;}catch(e){}
try{updateMediaSessionPlaybackState();}catch(e){}
render();
}

if($('seek'))$('seek').addEventListener('input',function(){
isSeeking=true;
try{state._seekStartedAt=Date.now();}catch(e){}
// 拖动中只更新 UI，松手后再真正 seek
try{pendingSeekRatio=Number(this.value)/1000;pendingSeekFromUser=true;}catch(e){}
var pct=parseFloat(this.value)/10;
updateSeekBg(pct);
if(audio.duration&&isFinite(audio.duration)){
var t=(parseFloat(this.value)/1000)*audio.duration;
$('curTime').textContent=fmt(t);
}
});
function finishSeek(){
if(state._finishSeekLock)return;
if(!isSeeking)return;
state._finishSeekLock=true;
setTimeout(function(){try{state._finishSeekLock=false;}catch(e){}},800);
isSeeking=false;
var ratio=0;
try{ratio=Number($('seek').value)/1000;}catch(e){ratio=0;}
if(!isFinite(ratio))ratio=0;
ratio=Math.max(0,Math.min(1,ratio));
pendingSeekRatio=ratio;
pendingSeekFromUser=true;
// 取链中：只记比例
if(state.loadingUrl||!state.audioUrl){
return;
}
if(!(audio.duration&&isFinite(audio.duration)&&audio.duration>0))return;
var t=ratio*audio.duration;
// 拖到末尾：单曲循环重播；否则播放中切下一首（只触发一次）
if(ratio>=0.995||t>=audio.duration-0.25){
if(state.mode==='single'||state.mode==='loop'){
try{audio.currentTime=0;}catch(e){}updateSeekBg(0);
try{if($('curTime'))$('curTime').textContent=fmt(0);}catch(e){}
if(state.playing){try{var pR=audio.play();if(pR&&pR.catch)pR.catch(function(){});}catch(e){}}
pendingSeekFromUser=false;pendingSeekRatio=null;return;
}
if(state.playing){
if(state._seekEndLock){pendingSeekFromUser=false;pendingSeekRatio=null;return;}
state._seekEndLock=true;
state._ignoreEnded=true;
state._progressLock=true;
pendingSeekFromUser=false;
pendingSeekRatio=null;
try{audio.pause();}catch(e){}
try{audio.removeAttribute('src');audio.load();}catch(e){}
try{isSeeking=false;}catch(e){}
try{resetProgressUI();}catch(e){}
try{updateSeekBg(0);}catch(e){}
try{nextSong(true,true);}catch(e){}
[0,40,120,300,600].forEach(function(ms){
setTimeout(function(){
try{resetProgressUI();}catch(e){}
try{
if(state.playing&&audio&&audio.paused&&state.audioUrl&&!state.loadingUrl){
var p=audio.play();if(p&&p.catch)p.catch(function(){});
}
}catch(e){}
},ms);
});
setTimeout(function(){
try{state._ignoreEnded=false;}catch(e){}
try{state._seekEndLock=false;}catch(e){}
try{state._finishSeekLock=false;}catch(e){}
try{state._progressLock=false;}catch(e){}
},1800);
return;
}
else{try{audio.currentTime=Math.max(0,audio.duration-0.05);}catch(e){}updateSeekBg(100);try{if($('curTime'))$('curTime').textContent=fmt(audio.duration||0);}catch(e){}}
pendingSeekFromUser=false;pendingSeekRatio=null;return;
}
seekWithUrlCheck(t);
pendingSeekFromUser=false;
pendingSeekRatio=null;
}
if($('seek'))$('seek').addEventListener('change',finishSeek);
if($('seek'))$('seek').addEventListener('pointerup',finishSeek);
if($('seek'))$('seek').addEventListener('touchend',finishSeek);

function onTimeUpdate(){
if(state._progressLock||state._seekEndLock)return;
if(isSeeking&&state._seekStartedAt&&Date.now()-state._seekStartedAt>2000){
isSeeking=false;
}
if(state.loadingUrl)return;
if(isSeeking)return;
if(!state.audioUrl&&!state.playing)return;
var d=audio.duration||0;
var c=audio.currentTime||0;
if(d>0&&isFinite(d)){
if(!isSeeking){
var pct=(c/d)*100;
$('seek').value=String(Math.round(pct*10));
updateSeekBg(pct);
}
$('durTime').textContent=fmt(d);
}
$('curTime').textContent=fmt(c);
if(state.showLyric&&state.lyricHasTime)updateLyricScroll(false);
if('mediaSession' in navigator&&d>0&&isFinite(d)){
try{
navigator.mediaSession.setPositionState({
duration:d,
playbackRate:audio.playbackRate||1,
position:Math.min(c,d)
});
}catch(e){}
}
}
audio.addEventListener('timeupdate',onTimeUpdate);
audio.addEventListener('loadedmetadata',function(){
var song=state.playlist[state.current];
if(song&&!song.external&&isFinite(audio.duration)&&audio.duration>0){
song.duration=audio.duration;
}
onTimeUpdate();
});
audio.addEventListener('durationchange',onTimeUpdate);
audio.addEventListener('play',function(){try{if(state.playing)navigator.mediaSession&&(navigator.mediaSession.playbackState='playing');}catch(e){}
// 不强制改写用户暂停意图；仅在已是播放意图时同步
if(state.playing){
try{if(typeof updateMediaSessionPlaybackState==='function')updateMediaSessionPlaybackState();}catch(e){}
try{if(typeof updateMediaSessionMetadata==='function')updateMediaSessionMetadata();}catch(e){}
}
});
audio.addEventListener('pause',function(){
// 播放意图只由按钮/切歌逻辑控制，audio.pause 事件不得清掉 playing
// （切歌 stopAudio、取链、刷新都会 pause，否则会立刻变成暂停按钮）
if(state._ignorePause||state.loadingUrl)return;
try{if(audio.ended)return;}catch(e){}
try{
if(audio.duration&&isFinite(audio.duration)&&audio.duration>0&&audio.currentTime>=audio.duration-0.3)return;
}catch(e){}
// 仅当用户意图已是暂停时同步 UI
if(!state.playing){
try{if(typeof updateMediaSessionPlaybackState==='function')updateMediaSessionPlaybackState();}catch(e){}
return;
}
// 不在这里设置 state.playing=false
try{if(typeof updateMediaSessionPlaybackState==='function')updateMediaSessionPlaybackState();}catch(e){}
});
audio.addEventListener('ended',function(){
// 没有有效音源时 ended 也可能误触发，不要当成播完切歌
if(!state.audioUrl||state.loadingUrl||state.quality==='unavailable'){
state.playing=false;
state.loadingUrl=false;
try{render();}catch(e){}
return;
}
// 自然结束：明确保持播放意图，避免 pause 事件先把 playing 清掉
state.playing=true;
if(state.mode==='single'||state.mode==='loop'){
try{audio.currentTime=0;}catch(e){}
var p=audio.play();
if(p&&p.catch)p.catch(function(){});
render();
}else{
// 防与拖进度条切歌重复
if(state._ignoreEnded||state._seekEndLock){return;}
nextSong(true,true);
}
});

// ==================== 事件绑定 ====================
if($('playBtn'))$('playBtn').addEventListener('click',togglePlay);
if($('prevBtn'))$('prevBtn').addEventListener('click',prevSong);
if($('nextBtn'))$('nextBtn').addEventListener('click',nextSong);

if($('modeBtn'))$('modeBtn').addEventListener('click',function(ev){
blurControl(ev.currentTarget||this);
var order=['order','single','shuffle'];
var i=order.indexOf(state.mode);
if(i<0)i=0;
var prevMode=state.mode;
state.mode=order[(i+1)%3];
if(state.mode==='shuffle'){
ensureShuffleOrder({avoidFirstIdx:state.current});
var p=state.shuffleOrder.indexOf(state.current);
state.shufflePos=(p>=0?p:0);
}else if(prevMode==='shuffle'){
state.shuffleOrder=[];state.shufflePos=0;
}
toast(state.mode==='single'?'单曲循环':(state.mode==='shuffle'?'随机播放':'顺序播放'));
if(typeof saveSettingsLocal==='function')saveSettingsLocal();
if(typeof notifyDataChanged==='function')notifyDataChanged('settings');
render();
});

if($('coverBox'))$('coverBox').addEventListener('click',function(){
if(!state.playlist.length)return;
state.showLyric=true;
try{state.lyricUserScrolled=false;}catch(e){}
render();
try{if(typeof recenterCurrentLyric==='function')recenterCurrentLyric();
else{
var run=function(){try{ensureLyricCenterPadding();}catch(e){}try{updateLyricScroll(true);}catch(e){};};
setTimeout(run,30);setTimeout(run,120);setTimeout(run,300);
}}catch(e){}
});
if($('lyricBox'))$('lyricBox').addEventListener('click',function(e){
if(e.target.closest&&e.target.closest('#lyricToolbar'))return;
var jump=e.target.closest&&e.target.closest('.line-jump');
if(jump&&jump.getAttribute('data-time')!=null){
e.stopPropagation();
if(!state.lyricHasTime)return;
var t=parseFloat(jump.getAttribute('data-time'));
if(!isFinite(t))return;
seekWithUrlCheck(t);
return;
}
state.showLyric=false;render();
});
(function(){
var sc=$('lyricScroll')||$('lyricBox');
if(!sc)return;
sc.addEventListener('wheel',markLyricUserScrolled,{passive:true});
sc.addEventListener('touchmove',markLyricUserScrolled,{passive:true});
sc.addEventListener('pointerdown',markLyricUserScrolled,{passive:true});
})();

if($('transBtn'))$('transBtn').addEventListener('click',function(e){
e.stopPropagation();
state._transUserSet=true;
state.transEnabled=!state.transEnabled;
state._lastLyricKey=null;
render();
});
if($('romaBtn'))$('romaBtn').addEventListener('click',function(e){
e.stopPropagation();
state.romaEnabled=!state.romaEnabled;
state._lastLyricKey=null;
render();
});

if($('retryBtn'))$('retryBtn').addEventListener('click',function(e){
e.stopPropagation();
retryQuality();
});

// ==================== 改名事件 ====================
if($('renameCancel'))$('renameCancel').addEventListener('click',closeRename);
if($('renameConfirm'))$('renameConfirm').addEventListener('click',confirmRename);
if($('renameGo'))$('renameGo').addEventListener('click',confirmRename);
if($('renameScrim'))$('renameScrim').addEventListener('click',function(e){if(e.target===this)closeRename()});
if($('renameInput'))$('renameInput').addEventListener('keydown',function(e){
if(e.key==='Enter'){e.preventDefault();confirmRename()}
});

// ==================== 分享菜单 ====================
if($('shareBtn'))$('shareBtn').addEventListener('click',function(ev){
blurControl(ev.currentTarget||this);
var song=state.playlist[state.current];
if(!song){toast('没有可分享的歌曲');return}
$('shareSongName').textContent=(song.name||'未知歌曲')+' - '+(song.artist||'');
closeOtherScrims('shareScrim');
showScrim('shareScrim');
});
if($('shareCancel'))$('shareCancel').addEventListener('click',function(){hideScrim('shareScrim')});
if($('shareScrim'))$('shareScrim').addEventListener('click',function(e){if(e.target===this){this.classList.remove('show');this.style.display='none';}});

if($('shareCopyLink'))$('shareCopyLink').addEventListener('click',async function(){
var song=state.playlist[state.current];
if(!song)return;
var link=buildShareLink(song);
try{
await navigator.clipboard.writeText(link);
toast('分享链接已复制');
}catch(e){
var ta=document.createElement('textarea');
ta.value=link;
ta.style.position='fixed';
ta.style.left='-9999px';
document.body.appendChild(ta);
ta.select();
try{document.execCommand('copy');toast('分享链接已复制');}
catch(e2){toast('复制失败');}
ta.remove();
}
hideScrim('shareScrim');
});

if($('shareSystem'))$('shareSystem').addEventListener('click',async function(){
var song=state.playlist[state.current];
if(!song)return;
if(!navigator.share){
toast('当前浏览器不支持系统分享');
return;
}
var link=buildShareLink(song);
try{
await navigator.share({
title:song.name||SITE_TITLE,
text:(song.name||'')+' - '+(song.artist||''),
url:link
});
hideScrim('shareScrim');
}catch(e){
if(e&&e.name==='AbortError'){hideScrim('shareScrim')}
}
});

// ==================== 下载 ====================
var pendingDownloadSong=null;
var downloadDetectToken=0;

async function checkVipNeeded(id){
try{
var r=await post('/api/getSongInfo',{id:String(id)});
if(!r)return true;

var d=r.data!==undefined?r.data:r;
if(d&&typeof d==='object'&&d.data&&typeof d.data==='object'){
d=d.data;
}

if(d&&typeof d==='object'){
var isFree=(d.free===true);
var hasCopyright=(typeof d.copyright==='number'&&d.copyright!==0);
if(isFree&&hasCopyright){
return false;
}
}
}catch(e){}
return true;
}


async function checkAllLevels(id){
// 兼容旧调用：一次性返回（内部仍走本地→TextDB→API）
var levels=['lossless','exhigh','standard'];
var result={lossless:false,exhigh:false,standard:false,official:false};
for(var i=0;i<levels.length;i++){
try{
var r=await tryGetLevelWithCache(id,levels[i],10);
if(r&&r.url)result[levels[i]]=true;
}catch(e){}
}
return result;
}

function renderDownloadQualityList(availability,song,currentQuality,loadingMap){
var listEl=$('qualityList');
if(!listEl)return;
loadingMap=loadingMap||{};
var html='<div class="quality-list">';
for(var i=0;i<DOWNLOAD_LEVELS.length;i++){
var lv=DOWNLOAD_LEVELS[i];
// 酷狗不显示官方音质
var isKgSong=!!(song&&(song.source==='kg'||String(song.id||'').indexOf('kg')===0||(song.hash&&String(song.hash).length===32)));
if(isKgSong&&lv.key==='official')continue;
var isOfficial=lv.key==='official';
var isCurrent=lv.key===currentQuality;
var avail=!!availability[lv.key];
var loading=!!loadingMap[lv.key];
var cls='quality-item';
if(!avail&&!loading)cls+=' disabled';
if(isCurrent)cls+=' current';
if(loading)cls+=' loading';
var dis=(avail&&!loading)?'':' disabled';
// 已获取：可点；加载中/失败：不可点
if(avail)dis='';
html+='<button class="'+cls+'" data-level="'+lv.key+'"'+(avail?'':' disabled')+'>';
html+='<span class="quality-label">'+lv.label+'</span>';
if(loading){
html+='<span class="quality-tag unavailable"><span class="quality-inline-spin"></span></span>';
}else if(isCurrent&&avail){
html+='<span class="quality-tag">当前</span>';
}else if(!avail){
html+='<span class="quality-tag unavailable">不可用</span>';
}
html+='</button>';
}
html+='</div>';
listEl.innerHTML=html;
var buttons=listEl.querySelectorAll('.quality-item');
for(var j=0;j<buttons.length;j++){
buttons[j].addEventListener('click',function(){
if(this.disabled)return;
var level=this.getAttribute('data-level');
if(!availability[level])return;
hideScrim('downloadScrim');
doDownload(pendingDownloadSong,level);
});
}
}

async function runQualityDetection(song){
var token=++downloadDetectToken;
var btn=$('downloadRetryBtn');
if(btn){btn.disabled=true;btn.classList.add('spinning');}

var availability={lossless:false,exhigh:false,standard:false,official:false};
var loading={lossless:true,exhigh:true,standard:true,official:false};
if(song&&(song.source==='kg'||String(song.id||'').indexOf('kg')===0)){loading.official=false;availability.official=false;}
var currentIsThisSong=(state.current>=0&&state.playlist[state.current]===song);
var currentQuality=currentIsThisSong?state.quality:'';

// 立刻画出 4 个音质
renderDownloadQualityList(availability,song,currentQuality,loading);

var levels=['lossless','exhigh','standard'];
var t0=Date.now();
try{logAction('下载音质检测开始','id='+song.id);}catch(e){}

// 1) 本地瞬时命中
for(var i=0;i<levels.length;i++){
var lv=levels[i];
try{
var loc=await getLocalAudioUrlOnly(song.id,lv,10);
if(loc&&loc.url){
availability[lv]=true;
loading[lv]=false;
try{logAction('下载命中本地',lv+' id='+song.id);}catch(e){}
}
}catch(e){}
}
if(token===downloadDetectToken)renderDownloadQualityList(availability,song,currentQuality,loading);

if(availability.lossless&&availability.exhigh&&availability.standard){
loading.lossless=loading.exhigh=loading.standard=false;
if(token===downloadDetectToken){
renderDownloadQualityList(availability,song,currentQuality,loading);
if(btn){btn.disabled=false;btn.classList.remove('spinning');}
}
try{logAction('下载音质本地齐','id='+song.id+' ms='+(Date.now()-t0));}catch(e){}
return;
}

// 2) 缺的档位：TextDB + API（tryGetLevelWithCache 已是 本地→DB→API）
await Promise.all(levels.map(async function(lv){
if(availability[lv]){loading[lv]=false;return;}
try{
var r=await tryGetLevelWithCache(song.id,lv,10);
if(token!==downloadDetectToken)return;
if(r&&r.url){
availability[lv]=true;
// 再保险写缓存
try{await saveAudioUrlToCache(song.id,lv,r.url,r.expi||DEFAULT_EXPI);}catch(e){}
try{logAction('下载命中',lv+(r.fromLocal?' local':(r.fromCache?' db':' api')));}catch(e){}
}
}catch(e){try{logError('下载音质失败 '+lv,e);}catch(e2){}}
loading[lv]=false;
if(token===downloadDetectToken)renderDownloadQualityList(availability,song,currentQuality,loading);
}));

// 3) 仅当三档全无时才探测官方
if(!availability.lossless&&!availability.exhigh&&!availability.standard){
loading.official=true;
if(token===downloadDetectToken)renderDownloadQualityList(availability,song,currentQuality,loading);
try{
var off=await probeOfficialLocal(song.id,30);
if(off&&off.url){
availability.official=true;
try{await saveAudioUrlToCache(song.id,'official',off.url,off.expi||DEFAULT_EXPI);}catch(e){}
}
}catch(e){}
loading.official=false;
}

if(token!==downloadDetectToken)return;
if(btn){btn.disabled=false;btn.classList.remove('spinning');}
renderDownloadQualityList(availability,song,currentQuality,loading);
try{logAction('下载音质检测结束','id='+song.id+' result='+JSON.stringify(availability)+' ms='+(Date.now()-t0));}catch(e){}
}

function openDownloadDialog(song){
try{blurControl(document.activeElement);}catch(e){}
pendingDownloadSong=song;
try{$('downloadSongName').textContent=(song.name||'未知歌曲')+' - '+(song.artist||'');}catch(e){}
try{closeOtherScrims('downloadScrim');}catch(e){}
try{showScrim('downloadScrim');}catch(e){}
runQualityDetection(song);
}

async function doDownload(song,level){
if(!song)return;
toast('获取下载链接...');
var url='';
try{
// 强制本地→DB→API，并缓存
var r=await tryGetLevelWithCache(song.id,level,10);
if(r&&r.url)url=r.url;
}catch(e){}
if(!url){
try{url=await fetchPlayUrlLevel(song.id,level,10);}catch(e){}
}
if(!url){
if(level==='official'){
url=await probeOfficialLocal(song.id);
}
if(!url){
toast('该音质不可用');
return;
}
}

try{
var res=await fetch(url);
var blob=await res.blob();
var ct=(blob.type||'').toLowerCase();
if(ct.indexOf('text/')===0||ct.indexOf('application/json')!==-1){
toast('该音质不是音频文件');
return;
}
var a=document.createElement('a');
a.href=URL.createObjectURL(blob);
var ext='.mp3';
if(level==='lossless')ext='.flac';
var fm=getFormatFromUrl(url);
if(fm)ext='.'+fm;
var fname=safeFileName((song.name||'song')+' - '+(song.artist||''))+ext;
a.download=fname;
document.body.appendChild(a);
a.click();
a.remove();
setTimeout(function(){URL.revokeObjectURL(a.href)},3000);
toast('开始下载');
}catch(e){
window.open(url,'_blank');
toast('已在新窗口打开');
}
}

if($('downloadCancel'))$('downloadCancel').addEventListener('click',function(){
pendingDownloadSong=null;
downloadDetectToken++;
hideScrim('downloadScrim');
});
if($('downloadScrim'))$('downloadScrim').addEventListener('click',function(e){
if(e.target===this){
pendingDownloadSong=null;
try{downloadDetectToken++;}catch(err){}
try{hideScrim('downloadScrim');}catch(err){}
this.classList.remove('show');
this.style.display='none';
}
});
if($('downloadRetryBtn'))$('downloadRetryBtn').addEventListener('click',function(){
if(!pendingDownloadSong)return;
runQualityDetection(pendingDownloadSong);
});

if($('downloadBtn'))if($('downloadBtn'))$('downloadBtn').addEventListener('click',async function(ev){
blurControl(ev.currentTarget||this);
var song=state.playlist[state.current];
if(!song){toast('没有可下载的歌曲');return}
if(song.external){
if(isHlsFormat(song.url,song.format)){
toast('M3U8 流媒体暂不支持下载');
return;
}
if(isFlvFormat(song.url,song.format)){
toast('FLV 流媒体暂不支持下载');
return;
}
var url=song.url;
if(!url){toast('缺少下载链接');return}
var ext='.mp3';
var fm=song.format||'';
if(!fm)fm=getFormatFromUrl(url);
if(fm)ext='.'+fm;
var fname=safeFileName((song.name||'song')+' - '+(song.artist||''))+ext;
var proxyUrl=location.origin+'/api/download?u='+encodeURIComponent(url)+'&name='+encodeURIComponent(fname);
var a=document.createElement('a');
a.href=proxyUrl;
a.download=fname;
document.body.appendChild(a);
a.click();
a.remove();
toast('开始下载');
return;
}
openDownloadDialog(song);
});


// ==================== 添加源切换 ====================
function setAddSource(src){
ADD_SOURCE=src||'wy';
var tabs=document.querySelectorAll('#addSourceTabs .add-src');
for(var i=0;i<tabs.length;i++){
if(tabs[i].getAttribute('data-src')===ADD_SOURCE)tabs[i].classList.add('active');
else tabs[i].classList.remove('active');
}
var hint=$('addSourceHint');
var input=$('addInput');
if(ADD_SOURCE==='kg'){
if(hint)hint.textContent='酷狗：输入歌名搜索（取第一条），或输入 32 位 hash / kg+hash。';
if(input)input.placeholder='酷狗歌名或 hash';
}else if(ADD_SOURCE==='ext'){
if(hint)hint.textContent='第三方：粘贴音频/视频直链（MP3 / FLAC / M3U8 / MP4 等）。';
if(input)input.placeholder='https://... 直链';
}else{
if(hint)hint.textContent='网易云：支持歌曲 ID、链接或歌名搜索（取第一条）。';
if(input)input.placeholder='歌曲 ID / 链接 / 歌名';
}
}
(function(){
var box=$('addSourceTabs');
if(!box)return;
box.addEventListener('click',function(e){
var t=e.target;
if(!t||!t.getAttribute)return;
if(t.getAttribute('data-src'))setAddSource(t.getAttribute('data-src'));
});
setAddSource('wy');
})();

// ==================== 添加歌曲弹窗 ====================
function openAdd(){
try{blurControl(document.activeElement);}catch(e){}
closeOtherScrims('addScrim');
$('addStage1').style.display='block';
$('addStage2').style.display='none';
$('addInput').value='';
$('addGo').disabled=false;
showScrim('addScrim');
setTimeout(function(){$('addInput').focus()},120);
}
function closeAdd(){
try{hideScrim('addScrim');}catch(e){}
try{
var scr=$('addScrim');
if(scr){scr.classList.remove('show');scr.style.display='none';}
}catch(e){}
try{
if($('addStage2'))$('addStage2').style.display='none';
if($('addStage1'))$('addStage1').style.display='block';
if($('addHint'))$('addHint').textContent='是否将此歌曲加入播放列表？';
if($('addInput'))$('addInput').blur();
}catch(e){}
pendingSong=null;
try{clearUrlShareParams();}catch(e){}
}
function openImportDialog(){
try{blurControl(document.activeElement);}catch(e){}

closeOtherScrims('importScrim');
$('importKey').value='';
$('importFile').value='';
$('importFileName').textContent='';
$('importHint').textContent='';
showScrim('importScrim');
setTimeout(function(){$('importKey').focus()},120);
}
if($('emptyAdd'))$('emptyAdd').addEventListener('click',openAdd);
if($('emptyImport'))$('emptyImport').addEventListener('click',openImportDialog);
if($('listBtn'))$('listBtn').addEventListener('click',function(ev){
try{if(typeof restorePlaylist==='function')restorePlaylist();}catch(e){}
try{var b=ev.currentTarget||this;b.blur();if(document.activeElement)document.activeElement.blur();}catch(e){}
var ls=$('listScrim');
// 已打开则关闭
if(ls&&(ls.classList.contains('show')||ls.style.display==='flex')){
try{hideScrim('listScrim');}catch(e){}
try{ls.classList.remove('show');ls.style.display='none';}catch(e){}
return;
}
closeOtherScrims('listScrim');
listHistIndex=-1;
if(typeof refreshHistButtons==='function')refreshHistButtons();
if($('sheetTitle'))$('sheetTitle').textContent='当前';
showScrim('listScrim');
});
if($('sheetAdd'))$('sheetAdd').addEventListener('click',function(){
hideScrim('listScrim');
setTimeout(openAdd,180);
});
if($('addScrim'))$('addScrim').addEventListener('click',function(e){if(e.target===this)closeAdd()});
if($('listScrim'))$('listScrim').addEventListener('click',function(e){
// 点在底部 sheet 外的遮罩区域才关闭（不要用严格 e.target===this，兼容子节点/文本节点）
try{
if(e.target.closest&&e.target.closest('.sheet'))return;
}catch(err){
if(e.target!==e.currentTarget&&e.target!==this)return;
}
try{hideScrim('listScrim');}catch(err){}
try{
var ls=e.currentTarget||this;
ls.classList.remove('show');
ls.style.display='none';
}catch(err){}
});

function showSongConfirm(song,fromUrl){
pendingSong=song;
if(fromUrl)song._fromUrl=true;
$('addStage1').style.display='none';
$('addStage2').style.display='block';
$('foundName').textContent=song.name;
if(song.external){
$('foundArtist').textContent=isVideoFormat(song.format)?'视频音源':'外部音源';
}else{
$('foundArtist').textContent=song.artist+'  ·  ID: '+song.id;
}
var metaHtml='';
if(song.external){
var f=song.format?song.format.toUpperCase():'未知';
if(isVideoFormat(song.format)){
metaHtml+='<span class="meta-tag vid">视频音源</span>';
metaHtml+='<span class="meta-tag vid">'+f+'</span>';
}else{
metaHtml+='<span class="meta-tag ext">外部音源</span>';
metaHtml+='<span class="meta-tag q">'+f+'</span>';
}
}else{
var q=song.quality||'official';
var qlabel=QUALITY_LABEL[q]||'官方';
var cls=q==='official'?'meta-tag ext':'meta-tag q';
metaHtml+='<span class="'+cls+'">'+(song.source==='kg'?'酷狗':'网易云')+'</span>';
metaHtml+='<span class="meta-tag q">'+qlabel+'</span>';
}
$('foundMeta').innerHTML=metaHtml;
$('addHint').textContent=fromUrl?'来自分享链接，是否添加到列表并播放？':'是否将此歌曲加入播放列表？';
closeOtherScrims('addScrim');
showScrim('addScrim');
try{
var scr=$('addScrim');
if(scr){scr.style.display='flex';scr.classList.add('show');}
}catch(e){}
}

async function doResolve(){
var text=$('addInput').value.trim();
if(!text)return;
if($('addGo').disabled)return;
$('addGo').disabled=true;
$('addGo').innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
try{
var song=await Promise.race([
resolveInput(text),
new Promise(function(_,rej){setTimeout(function(){rej(new Error('解析超时，请重试'));},15000);})
]);
if(song)showSongConfirm(song,false);
else toast('未找到歌曲');
}catch(e){
try{if(typeof logError==='function')logError('添加解析失败',String(e&&e.message||e));}catch(e2){}
toast(e.message||'解析失败');
}finally{
$('addGo').disabled=false;
try{$('addGo').innerHTML=(typeof ICON!=='undefined'&&ICON.arrow)?ICON.arrow:'→';}catch(e){}
}
}
if($('addGo'))$('addGo').addEventListener('click',doResolve);
if($('addInput'))$('addInput').addEventListener('keydown',function(e){
if(e.key==='Enter'){e.preventDefault();doResolve()}
});
if($('addCancel'))$('addCancel').addEventListener('click',function(){
// 分享链接进来的确认页：取消直接关弹窗，不要退回输入页
var fromShare=pendingSong&&pendingSong._fromUrl;
pendingSong=null;
try{clearUrlShareParams();}catch(e){}
if(fromShare){
closeAdd();
return;
}
try{
$('addStage2').style.display='none';
$('addStage1').style.display='block';
$('addHint').textContent='是否将此歌曲加入播放列表？';
}catch(e){}
setTimeout(function(){try{$('addInput').focus();}catch(e){}},100);
});
if($('addConfirm'))$('addConfirm').addEventListener('click',function(){
if(!pendingSong)return;
var toAdd=pendingSong;
var fromUrl=toAdd._fromUrl===true;
delete toAdd._fromUrl;
var wasEmpty=!state.playlist.length;
var isPlaying=!!state.playing;

var dupIdx=findDuplicateIndex(toAdd,state.playlist);
if(dupIdx>=0){
pendingSong=null;
closeAdd();
$('addHint').textContent='是否将此歌曲加入播放列表？';
// 暂停中：跳到已有曲目且不播放；播放中：不跳转
if(!isPlaying){
playIndex(dupIdx,null,null,{play:false});
toast('歌曲已在列表中，已切换');
}else{
toast('歌曲已在列表中');
try{render();}catch(e){}
}
return;
}

var insertAt=0;
if(state.playlist.length===0){
insertAt=0;
state.playlist.push(toAdd);
}else if(state.current<0){
state.playlist.push(toAdd);
insertAt=state.playlist.length-1;
}else{
// 添加到下一首位置
insertAt=state.current+1;
state.playlist.splice(insertAt,0,toAdd);
}
try{savePlaylist();}catch(e){}
try{if(typeof syncShuffleAfterPlaylistChange==='function')syncShuffleAfterPlaylistChange();}catch(e){}
toast('已加入播放列表');
if(typeof logAction==='function')logAction('添加歌曲','id='+(toAdd&&toAdd.id)+' name='+(toAdd&&toAdd.name)+' artist='+(toAdd&&toAdd.artist));
pendingSong=null;
closeAdd();
$('addHint').textContent='是否将此歌曲加入播放列表？';
// 暂停：跳到新歌且不播放；播放中：保持当前曲，仅插入为下一首
if(!isPlaying||wasEmpty){
playIndex(insertAt,null,null,{play:false});
}else{
// 播放中不切换 current，列表已插入在 current+1
try{render();}catch(e){}
}
});

// ==================== 清空列表 ====================
if($('sheetClear'))$('sheetClear').addEventListener('click',function(ev){
try{blurControl(ev.currentTarget||this);}catch(e){}
if(!state.playlist.length){toast('播放列表已为空');return}
try{closeOtherScrims('clearScrim');}catch(e){}
try{
var sc=$('clearScrim');
if(sc){sc.classList.add('show');sc.style.display='flex';}
}catch(e){}
try{showScrim('clearScrim');}catch(e){}
});
if($('clearCancel'))$('clearCancel').addEventListener('click',function(){
try{hideScrim('clearScrim');}catch(e){}
try{var sc=$('clearScrim');if(sc){sc.classList.remove('show');sc.style.display='none';}}catch(e){}
});
if($('clearScrim'))$('clearScrim').addEventListener('click',function(e){
if(e.target===this){
this.classList.remove('show');
this.style.display='none';
}
});
if($('clearConfirm'))$('clearConfirm').addEventListener('click',function(){
try{
state.playlist=[];
state.current=-1;
state.shuffleOrder=[];state.shufflePos=0;
state.playing=false;
state.lyric='';state.lyricTrans='';state.lyricRoma='';
state.lyricLoading=false;
state.audioUrl='';state.quality='';
state.retrying=false;
state.editingOrder=false;
try{if($('sheetEdit')){$('sheetEdit').innerHTML='<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>';$('sheetEdit').classList.remove('active');}}catch(e){}
try{stopAudio();}catch(e){}
try{resetProgressUI();}catch(e){}
try{clearPlaylistCookie();}catch(e){}
try{savePlaylist(true);}catch(e){}
preloadCache={};
preloadTimers={};
state._lastMediaKey=null;
try{render();}catch(e){}
try{if(typeof updateFavBtn==='function')updateFavBtn();}catch(e){}
try{updateMediaSessionMetadata();}catch(e){}
try{updateMediaSessionPlaybackState();}catch(e){}
try{hideScrim('clearScrim');}catch(e){}
try{var sc=$('clearScrim');if(sc){sc.classList.remove('show');sc.style.display='none';}}catch(e){}
try{hideScrim('listScrim');}catch(e){}
try{var ls=$('listScrim');if(ls){ls.classList.remove('show');ls.style.display='none';}}catch(e){}
toast('播放列表已清空');
}catch(err){
try{logEvent('error','清空列表失败',String(err&&err.message||err));}catch(e){}
// 即使清空逻辑出错也要关掉弹窗
try{hideScrim('clearScrim');}catch(e){}
try{var sc2=$('clearScrim');if(sc2){sc2.classList.remove('show');sc2.style.display='none';}}catch(e){}
toast('清空失败');
}
});

// ==================== 编辑顺序 ====================
if($('sheetEdit'))$('sheetEdit').addEventListener('click',function(){
state.editingOrder=!state.editingOrder;
$('sheetEdit').innerHTML=state.editingOrder?ICON.check:'<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>';
if(state.editingOrder)$('sheetEdit').classList.add('active');
else $('sheetEdit').classList.remove('active');
render();
});

// ==================== 网络导出 ====================
var exportGenerating=false;
var pendingSeekRatio=null;
var pendingSeekFromUser=false;;



function parseListText(text){
text=String(text||'').replace(/^\uFEFF/,'').trim();
if(!text)return [];
var lines=text.split(/\r?\n/);
var out=[];
var seen={};
for(var i=0;i<lines.length;i++){
var line=String(lines[i]||'').trim();
if(!line)continue;
// 跳过注释/标题
if(line.charAt(0)==='#'&&line.indexOf('#GZIP')!==0)continue;
var parts=line.split('|');
if(parts.length<2)continue;
var a=String(parts[0]||'').trim();
var name=String(parts[1]||'').trim()||'未知歌曲';
var artist=String(parts[2]||'').trim()||'未知歌手';
var fourth=String(parts[3]||'').trim();
var song=null;
// 外链：第一列是 URL
if(/^https?:\/\//i.test(a)||a.indexOf('//')===0){
var url=a;
if(url.indexOf('//')===0)url='https:'+url;
song={
id:url,
name:name,
artist:artist,
pic:'',
duration:0,
external:true,
url:url,
srcUrl:fourth||url,
format:'',
source:'ext'
};
}else if(/^kg/i.test(a)||/^[a-fA-F0-9]{32}$/.test(a)){
// 酷狗
var kid=a;
if(kid.indexOf('kg')!==0)kid='kg'+kid.toLowerCase();
else kid='kg'+kid.slice(2).toLowerCase();
song={
id:kid,
name:name,
artist:artist,
pic:fourth||'',
duration:0,
external:false,
source:'kg',
quality:'exhigh'
};
}else if(/^\d+$/.test(a)){
// 网易云
song={
id:a,
name:name,
artist:artist,
pic:fourth||'',
duration:0,
external:false,
source:'wy',
quality:'exhigh'
};
}else{
// 其它：当外链或跳过
if(a.indexOf('.')!==-1&&a.indexOf(' ')===-1){
var u2=a;
if(!/^https?:\/\//i.test(u2))u2='https://'+u2;
song={
id:u2,name:name,artist:artist,pic:'',duration:0,
external:true,url:u2,srcUrl:fourth||u2,format:'',source:'ext'
};
}else continue;
}
if(!song)continue;
var k='';
try{k=songKey(song);}catch(e){k=String(song.id||'');}
if(!k||seen[k])continue;
seen[k]=true;
out.push(song);
}
return out;
}

function applyImport(imported,mode){
imported=imported||[];
mode=mode||'merge';
var added=0;
var firstIndex=-1;
if(mode==='replace'||mode==='new'){
state.playlist=imported.slice();
// 不在这里改 current：由调用方按播放状态决定是否跳转
added=imported.length;
firstIndex=imported.length?0:-1;
try{savePlaylist(true);}catch(e){try{savePlaylist();}catch(e2){}}
return {added:added,firstIndex:firstIndex};
}
// merge：只加入与原列表不重复的歌曲，按导出顺序插到「当前歌曲」后面
var exist={};
for(var i=0;i<state.playlist.length;i++){
try{exist[songKey(state.playlist[i])]=true;}catch(e){}
}
var toInsert=[];
for(var j=0;j<imported.length;j++){
var s=imported[j];
var k='';
try{k=songKey(s);}catch(e){k=String(s.id||'');}
if(!k||exist[k])continue;
exist[k]=true;
toInsert.push(s);
}
if(!toInsert.length){
try{savePlaylist();}catch(e){}
return {added:0,firstIndex:-1};
}
var insertAt=0;
if(state.playlist.length===0){
insertAt=0;
}else if(typeof state.current==='number'&&state.current>=0){
insertAt=state.current+1;
}else{
insertAt=state.playlist.length;
}
// splice 一次保持导入顺序
var args=[insertAt,0].concat(toInsert);
state.playlist.splice.apply(state.playlist,args);
firstIndex=insertAt;
added=toInsert.length;
if(state.current<0&&state.playlist.length){
state.current=0;
}
try{savePlaylist();}catch(e){}
return {added:added,firstIndex:firstIndex};
}


function exportListText(){
var list=state.playlist||[];
return list.map(function(s){
var name=(s.name||'').split('|').join(' ');
var artist=(s.artist||'').split('|').join(' ');
var pic=(s.pic||'').split('|').join(' ');
if(s.external)return (s.url||'')+'|'+name+'|'+artist+'|'+(s.srcUrl||'');
return String(s.id||'')+'|'+name+'|'+artist+(pic?'|'+pic:'');
}).join(String.fromCharCode(10));
}

if($('sheetExport'))$('sheetExport').addEventListener('click',async function(ev){
try{blurControl(ev.currentTarget||this);}catch(e){}
if(!state.playlist.length){toast('播放列表为空');return}
try{hideScrim('listScrim');}catch(e){}
if(exportGenerating){toast('正在导出，请稍候');return;}
exportGenerating=true;
try{
$('exportKey').value='';
$('exportKey').placeholder='正在上传...';
$('exportCopy').disabled=true;
$('exportHint').textContent='正在将歌单上传到网络...';
try{closeOtherScrims('exportScrim');}catch(e){}
showScrim('exportScrim');

var raw='';
try{raw=exportListText()||'';}catch(e){raw='';}
if(!raw){
$('exportKey').placeholder='导出失败';
$('exportHint').textContent='列表为空或序列化失败';
return;
}
var compressed=null;
try{compressed=await gzipCompress(raw);}catch(e){compressed=null;}
var toUpload=raw;
if(raw.length>1200&&compressed&&('#GZIP:'+compressed).length<raw.length){
toUpload='#GZIP:'+compressed;
}

var key=genShareKey();
var detail='songs='+state.playlist.length+' bytes='+toUpload.length+' key='+key;
try{if(typeof logAction==='function')logAction('导出播放列表',detail);}catch(e){}
var ok=false;
try{
// 超时保护，避免一直停在上传中
ok=await Promise.race([
cacheSetRaw(key,toUpload),
new Promise(function(res){setTimeout(function(){res(false);},15000);})
]);
}catch(e){
ok=false;
try{if(typeof logError==='function')logError('导出异常',String(e&&e.message||e));}catch(e2){}
}
if(ok){
$('exportKey').value=key;
$('exportKey').placeholder='';
$('exportCopy').disabled=false;
$('exportHint').textContent='已上传 '+state.playlist.length+' 首，密钥可复制到其他设备导入';
try{if(typeof logAction==='function')logAction('导出成功',detail);}catch(e){}
}else{
$('exportKey').value='';
$('exportKey').placeholder='上传失败';
$('exportCopy').disabled=true;
$('exportHint').textContent='上传失败：无法写入或校验 textdb，请重试';
try{if(typeof logError==='function')logError('导出失败',detail);}catch(e){}
}
}finally{
exportGenerating=false;
}
});
if($('exportClose'))$('exportClose').addEventListener('click',function(){hideScrim('exportScrim')});
if($('exportScrim'))$('exportScrim').addEventListener('click',function(e){if(e.target===this){this.classList.remove('show');this.style.display='none';}});
if($('exportCopy'))$('exportCopy').addEventListener('click',async function(){
var key=$('exportKey').value;
if(!key||detectImportType(key)!=='key'){toast('请等待上传完成');return}
try{
await navigator.clipboard.writeText(key);
toast('密钥已复制');
}catch(e){
var ta=document.createElement('textarea');
ta.value=key;
ta.style.position='fixed';
ta.style.left='-9999px';
document.body.appendChild(ta);
ta.select();
try{document.execCommand('copy');toast('密钥已复制');}
catch(e2){toast('复制失败');}
ta.remove();
}
});

if($('exportDownload'))$('exportDownload').addEventListener('click',async function(){
if(!state.playlist.length){toast('播放列表为空');return}
var raw=exportListText();
var compressed=await gzipCompress(raw);
var text=compressed?('#GZIP:'+compressed):raw;
try{
var blob=new Blob([text],{type:'text/plain;charset=utf-8'});
var a=document.createElement('a');
a.href=URL.createObjectURL(blob);
var d=new Date();
var stamp=d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
a.download='playlist_'+stamp+'.txt';
document.body.appendChild(a);
a.click();
a.remove();
setTimeout(function(){URL.revokeObjectURL(a.href)},3000);
toast('已开始下载');
}catch(e){toast('下载失败')}
});

// ==================== 导入 ====================
if($('sheetImport'))$('sheetImport').addEventListener('click',function(){
hideScrim('listScrim');
openImportDialog();
});
if($('importCancel'))$('importCancel').addEventListener('click',function(){hideScrim('importScrim')});
if($('importScrim'))$('importScrim').addEventListener('click',function(e){if(e.target===this){this.classList.remove('show');this.style.display='none';}});
if($('importPickFile'))$('importPickFile').addEventListener('click',function(){$('importFile').click()});

async function resolveImportText(val){
val=String(val||'').trim();
if(!val)return '';
var type=detectImportType(val);
if(type==='key'){
var raw=await cacheGetRaw(val);
if(!raw)return '';
return (await decodeImportText(raw))||'';
}
return (await decodeImportText(val))||'';
}

async function previewImport(val){
val=String(val||'').trim();
if(!val)return false;
var type=detectImportType(val);
$('importHint').textContent='正在解析...';
var text=await resolveImportText(val);
if(!text){
$('importHint').textContent='';
if(type==='key'){toast('未找到该密钥对应的歌单');}
else{toast('无法解析输入内容');}
return false;
}
var imported=parseListText(text);
if(!imported.length){
$('importHint').textContent='';
toast('未解析到有效歌曲');
return false;
}
$('importHint').textContent='已找到 '+imported.length+' 首歌曲，点击"确认导入"';
return true;
}

if($('importGo'))$('importGo').addEventListener('click',function(){
previewImport($('importKey').value);
});

if($('importKey'))$('importKey').addEventListener('keydown',function(e){
if(e.key==='Enter'){e.preventDefault();$('importGo')&&$('importGo').click()}
});

if($('importFile'))$('importFile').addEventListener('change',function(){
var file=this.files&&this.files[0];
if(!file)return;
var reader=new FileReader();
reader.onload=function(e){
var text=String(e.target.result||'').trim();
$('importKey').value=text;
$('importFileName').textContent=file.name;
var type=detectImportType(text);
if(type==='key'){$('importHint').textContent='已读取密钥，点击"确认导入"';}
else if(type==='gzip'){$('importHint').textContent='已读取压缩歌单，点击"确认导入"';}
else if(type==='plain'){$('importHint').textContent='已读取明文歌单，点击"确认导入"';}
else{$('importHint').textContent='';}
};
reader.onerror=function(){toast('读取文件失败')};
reader.readAsText(file,'utf-8');
});

if($('importConfirm'))$('importConfirm').addEventListener('click',async function(){
var val=$('importKey').value.trim();
if(!val){toast('请输入密钥、歌单文本或选择文件');return}
var type=detectImportType(val);
$('importHint').textContent='正在解析...';
var text=await resolveImportText(val);
if(!text){
$('importHint').textContent='';
if(type==='key'){toast('未找到该密钥对应的歌单');}
else{toast('无法解析输入内容');}
return;
}
var imported=parseListText(text);
if(!imported.length){
$('importHint').textContent='';
toast('歌单内容为空');
return;
}
var mode='merge';
var radios=document.getElementsByName('importMode');
for(var i=0;i<radios.length;i++){if(radios[i].checked){mode=radios[i].value;break}}

var isPlaying=!!state.playing;
var result=applyImport(imported,mode);
var added=(result&&typeof result==='object')?result.added:result;
var firstIndex=(result&&typeof result==='object')?result.firstIndex:-1;
var after=state.playlist.length;

if(mode==='replace'||mode==='new'){
// 整表替换：必须停播，避免仍指向旧列表
state.playing=false;
isPlaying=false;
state.loadingUrl=false;
state.audioUrl='';state.quality='';
state.lyric='';state.lyricTrans='';
if(state.lyricTrans&&String(state.lyricTrans).trim()&&!state._transUserSet)state.transEnabled=true;
state.lyricRoma='';
state.lyricLoading=false;
state.retrying=false;
state.editingOrder=false;
try{
if($('sheetEdit')){
$('sheetEdit').innerHTML='<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>';
$('sheetEdit').classList.remove('active');
}
}catch(e){}
try{stopAudio();}catch(e){}
try{resetProgressUI();}catch(e){}
state._lastMediaKey=null;
try{updateMediaSessionMetadata();}catch(e){}
try{updateMediaSessionPlaybackState();}catch(e){}
}

try{savePlaylist();}catch(e){}
hideScrim('importScrim');
hideScrim('listScrim');

// 合并 + 暂停：跳到新插入的第1首且不播放；合并 + 播放中：不跳转
// 新建/覆盖：无论原先是否在播，都已暂停，并跳到第1首
var shouldJump=false;
if(mode==='replace'||mode==='new'){
shouldJump=firstIndex>=0;
}else if(!isPlaying&&firstIndex>=0){
shouldJump=true;
}
if(shouldJump&&firstIndex>=0&&firstIndex<state.playlist.length){
playIndex(firstIndex,null,null,{play:false});
}else{
try{render();}catch(e){}
}

if(mode==='replace'||mode==='new'){
toast(mode==='new'?('已导入 '+after+' 首歌曲'):('已覆盖为 '+after+' 首歌曲'));
logAction('导入播放列表','mode='+mode+' count='+after);
}else{
toast('新增 '+added+' 首，共 '+after+' 首');
logAction('导入播放列表','mode='+mode+' added='+added+' total='+after);
}
});

// ==================== 列表交互 ====================
if($('sheetList'))$('sheetList').addEventListener('click',function(e){
var renameBtn=e.target.closest('[data-rename]');
if(renameBtn){
e.stopPropagation();
var ridx=parseInt(renameBtn.getAttribute('data-rename'),10);
openRename(ridx);
return;
}

var del=e.target.closest('[data-del]');
if(del){
e.stopPropagation();
var idx=parseInt(del.getAttribute('data-del'),10);
var removed=state.playlist[idx];
if(removed&&removed.id){
delete preloadCache[removed.id];
if(preloadTimers[removed.id]){
var pt=preloadTimers[removed.id];
if(pt.pic)clearTimeout(pt.pic);
if(pt.lyric)clearTimeout(pt.lyric);
if(pt.url)clearTimeout(pt.url);
delete preloadTimers[removed.id];
}
}
state.playlist.splice(idx,1);
if(state.playlist.length===0){
state.current=-1;state.playing=false;
state.lyric='';state.lyricTrans='';state.lyricRoma='';
state.lyricLoading=false;
state.audioUrl='';state.quality='';
state.retrying=false;
state.editingOrder=false;
try{if($('sheetEdit')){$('sheetEdit').innerHTML='<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>';$('sheetEdit').classList.remove('active');}}catch(e){}
try{stopAudio();}catch(e){}
try{resetProgressUI();}catch(e){}
try{clearPlaylistCookie();}catch(e){}
try{savePlaylist(true);}catch(e){}
state._lastMediaKey=null;
try{updateMediaSessionMetadata();}catch(e){}
try{updateMediaSessionPlaybackState();}catch(e){}
render();
toast('已删除');
return;
}else if(idx===state.current){
if(idx>=state.playlist.length)state.current=state.playlist.length-1;
try{savePlaylist();}catch(e){}
var keep=!!state.playing;
playIndex(state.current,null,null,{play:keep});
}else{
if(idx<state.current)state.current--;
try{savePlaylist();}catch(e){}
}
render();
toast('已删除');
return;
}

var up=e.target.closest('[data-up]');
if(up){
e.stopPropagation();
var i=parseInt(up.getAttribute('data-up'),10);
if(i>0){
var tmp=state.playlist[i-1];
state.playlist[i-1]=state.playlist[i];
state.playlist[i]=tmp;
if(state.current===i)state.current=i-1;
else if(state.current===i-1)state.current=i;
savePlaylist();
render();
}
return;
}

var down=e.target.closest('[data-down]');
if(down){
e.stopPropagation();
var i2=parseInt(down.getAttribute('data-down'),10);
if(i2<state.playlist.length-1){
var tmp2=state.playlist[i2+1];
state.playlist[i2+1]=state.playlist[i2];
state.playlist[i2]=tmp2;
if(state.current===i2)state.current=i2+1;
else if(state.current===i2+1)state.current=i2;
savePlaylist();
render();
}
return;
}

if(state.editingOrder)return;

var row=e.target.closest('.song-row');
if(row){
var ri=parseInt(row.getAttribute('data-i'),10);
if(ri===state.current){togglePlay()}else{playIndex(ri)}
hideScrim('listScrim');
}
});

// ==================== URL 参数处理 ====================
async function handleUrlParams(){
if(window._urlShareHandled)return;
var keyValue='',addValue='';
try{
keyValue=sessionStorage.getItem('m3_pending_key')||'';
addValue=sessionStorage.getItem('m3_pending_add')||'';
}catch(e){}
var params=null;
try{params=new URLSearchParams(location.search)}catch(e){}
if(params){
if(params.get('key'))keyValue=params.get('key');
if(params.get('add'))addValue=params.get('add');
}
if(!keyValue&&!addValue)return;

// 立刻清 URL + session，避免刷新重复弹；解析失败也不再弹
window._urlShareHandled=true;
try{clearUrlShareParams();}catch(e){
try{history.replaceState(null,'',location.pathname);}catch(e2){}
try{sessionStorage.removeItem('m3_pending_add');}catch(e3){}
try{sessionStorage.removeItem('m3_pending_key');}catch(e4){}
}

if(keyValue){
await handleKeyFromUrl(String(keyValue).trim());
return;
}

if(addValue){
toast('正在解析分享内容...');
try{
var song=null;
if(typeof resolveShareAdd==='function'){
song=await resolveShareAdd(String(addValue).trim());
}else{
var prevSrc=typeof ADD_SOURCE!=='undefined'?ADD_SOURCE:'wy';
try{ADD_SOURCE='wy';}catch(e){}
try{song=await resolveInput(String(addValue).trim());}finally{try{ADD_SOURCE=prevSrc;}catch(e){}}
}
if(!song)throw new Error('未解析到歌曲');
showSongConfirm(song,true);
}catch(e){
try{logEvent('error','URL添加失败',String(e&&e.message||e));}catch(e2){}
toast('解析失败: '+(e.message||'未知错误'));
try{hideScrim('addScrim');}catch(e3){}
}
}
}

async function handleKeyFromUrl(key){
if(!key)return;
window._urlKeyPending=String(key).trim();
$('urlKeyHint').textContent='检测到分享密钥，请选择导入到歌曲列表还是歌单';
showScrim('urlKeyScrim');
}

async function importKeyAsSongList(key){
hideScrim('listScrim');
$('importKey').value=key;
$('importHint').textContent='';
closeOtherScrims('importScrim');
showScrim('importScrim');
}

async function importKeyAsPlaylist(key, mode, targetId){
var text=await resolveImportText(key);
if(!text){toast('未找到该密钥对应的内容');return;}
var imported=typeof parseListText==='function'?parseListText(text):[];
if(!imported.length){toast('内容为空');return;}
if(mode==='merge'&&targetId){
var pl=getPlaylist(targetId);
if(!pl){toast('目标歌单不存在');return;}
var seen={};
(pl.songs||[]).forEach(function(s){if(typeof addKeysToSeen==='function')addKeysToSeen(seen,s);});
var added=[];
imported.forEach(function(s){
if(typeof hasAnyKeyInSeen==='function'&&hasAnyKeyInSeen(seen,s))return;
added.push(s);
if(typeof addKeysToSeen==='function')addKeysToSeen(seen,s);
});
pl.songs=added.concat(pl.songs||[]);
pl.updatedAt=Date.now();
markLocalChange();
savePlaylistsLocal();
toast('已合并 '+added.length+' 首到「'+pl.name+'」');
}else{
var pl2=createPlaylist(null, imported);
toast('已新建歌单「'+pl2.name+'」共 '+imported.length+' 首');
}
renderPlaylistsPage();
}

(function(){
if(!navigator.mediaDevices)return;
var initialized=false,lastSig='',lastPauseAt=0;
function getSig(devices){
var ids=[];
for(var i=0;i<devices.length;i++){
var d=devices[i];
if(d.kind==='audiooutput'||d.kind==='audioinput'){
ids.push(d.deviceId||d.label||String(i));
}
}
ids.sort();
return ids.length+':'+ids.join(',');
}
async function check(){
try{
var devices=await navigator.mediaDevices.enumerateDevices();
var sig=getSig(devices);
if(!initialized){initialized=true;lastSig=sig;return;}
if(sig===lastSig)return;
lastSig=sig;
var now=Date.now();
if(now-lastPauseAt<800)return;
lastPauseAt=now;
if(audio&&!audio.paused){
audio.pause();
toast('音频设备变化，已暂停播放');
}
}catch(e){}
}
if(navigator.mediaDevices.addEventListener){
navigator.mediaDevices.addEventListener('devicechange',check);
}else if(navigator.mediaDevices.ondevicechange!==undefined){
navigator.mediaDevices.ondevicechange=check;
}
setInterval(check,1500);
check();
})();

// ==================== 后台恢复兜底 ====================
document.addEventListener('visibilitychange',function(){
if(document.visibilityState==='visible'&&state.playing&&audio.paused){
audio.play().catch(function(){});
}
});

// ==================== 返回键：关弹窗 / 再按一次退出 ====================
var lastExitTapAt=0;
var EXIT_TAP_MS=2000;

function anyScrimOpen(){
  for(var i=0;i<ALL_SCRIMS.length;i++){
    var el=$(ALL_SCRIMS[i]);
    if(!el)continue;
    if(el.classList.contains('show'))return true;
    try{
      var d=el.style&&el.style.display;
      if(d&&d!=='none'&&d!=='')return true;
    }catch(e){}
  }
  return false;
}
function closeAllScrimsUI(){
  for(var i=0;i<ALL_SCRIMS.length;i++){
    var el=$(ALL_SCRIMS[i]);
    if(!el)continue;
    el.classList.remove('show');
    el.style.display='none';
  }
}
function guardHistory(){
  try{history.pushState({app:1},'');}catch(e){}
}

(function setupBackHandler(){
  guardHistory();
  window.addEventListener('popstate',function(){
    // 优先级：弹窗 > 二级页面 > 退出网站
    if(anyScrimOpen()){
      closeAllScrimsUI();
      try{if(typeof closeLogsPage==='function')closeLogsPage();}catch(e){}
      lastExitTapAt=0;
      // 再压一层，保持栈，避免连续返回直接出站
      guardHistory();
      return;
    }
    // 歌单详情等二级页
    try{
      if(typeof viewingPlId!=='undefined'&&viewingPlId){
        if(typeof closePlaylistDetail==='function')closePlaylistDetail();
        lastExitTapAt=0;
        guardHistory();
        return;
      }
    }catch(e){}
    try{
      var det=$('pagePlaylistDetail');
      if(det&&det.classList.contains('page-active')){
        if(typeof closePlaylistDetail==='function')closePlaylistDetail();
        lastExitTapAt=0;
        guardHistory();
        return;
      }
    }catch(e){}
    // 非播放页：先回播放页
    try{
      if(state.activeTab&&state.activeTab!=='player'){
        if(typeof switchTab==='function')switchTab('player');
        lastExitTapAt=0;
        guardHistory();
        return;
      }
    }catch(e){}
    var now=Date.now();
    if(lastExitTapAt&&(now-lastExitTapAt)<EXIT_TAP_MS){
      lastExitTapAt=0;
      try{history.back();}catch(e){}
      return;
    }
    lastExitTapAt=now;
    toast('再按一次退出');
    guardHistory();
  });
})();

// ==================== 新控件与页面绑定 ====================
if($('favBtn'))$('favBtn').addEventListener('click',function(ev){
blurControl(ev.currentTarget||this);
var song=state.playlist[state.current];
if(!song){toast('没有可收藏的歌曲');return;}
try{openFavDialog(song);}catch(err){toast('收藏失败');console.error(err);}
});
function openFavDialog(song){
if(!song)return;
window._favDialogSong=song;
function paintFavList(){
var box=$('favPlList');
if(!box)return;
box.innerHTML='';
var cur=window._favDialogSong||song;
var k=songKey(cur);
var list=state.playlists||[];
if(!list.length){
box.innerHTML='<p class="hint">暂无歌单，可新建后收藏</p>';
return;
}
list.forEach(function(pl){
var btn=document.createElement('button');
btn.type='button';
btn.className='fav-pl-item';
// 每次绘制时重新判断，避免闭包里的 on 过期
var on=false;
try{
var plNow=typeof getPlaylist==='function'?getPlaylist(pl.id):pl;
on=((plNow&&plNow.songs)||pl.songs||[]).some(function(s){return songKey(s)===k;});
}catch(e){
on=(pl.songs||[]).some(function(s){return songKey(s)===k;});
}
if(on)btn.classList.add('on');
else btn.classList.remove('on');
var cnt=(pl.songs&&pl.songs.length)||0;
try{var p2=getPlaylist(pl.id);if(p2&&p2.songs)cnt=p2.songs.length;}catch(e){}
btn.textContent=(on?'★ ':'☆ ')+(pl.name||'未命名')+'（'+cnt+'）';
btn.addEventListener('click',function(ev){
try{ev.preventDefault();ev.stopPropagation();}catch(e){}
var plId=pl.id;
var nowOn=false;
try{
var plLive=getPlaylist(plId);
nowOn=((plLive&&plLive.songs)||[]).some(function(s){return songKey(s)===k;});
}catch(e){}
if(nowOn){
removeSongFromPlaylist(plId,cur);
toast('已从「'+(pl.name||'歌单')+'」移出');
}else{
addSongToPlaylist(plId,cur,true);
toast('已收藏到「'+(pl.name||'歌单')+'」');
}
try{if(typeof updateFavBtn==='function')updateFavBtn();}catch(e){}
// 不关闭弹窗，立即重绘星标
paintFavList();
});
box.appendChild(btn);
});
}
paintFavList();
showScrim('favScrim');
}
if($('favCancel'))$('favCancel').addEventListener('click',function(){hideScrim('favScrim');});
if($('favNewPl'))$('favNewPl').addEventListener('click',function(){
var song=state.playlist[state.current];
if(!song)return;
hideScrim('favScrim');
window._plNameMode='fav';
window._plNameSong=song;
$('plNameTitle').textContent='新建歌单并收藏';
$('plNameInput').value='';
showScrim('plNameScrim');
setTimeout(function(){$('plNameInput').focus();},100);
});

(function bindTabs(){
if(typeof __bindTabBar==='function')__bindTabBar();
document.querySelectorAll('#tabbar .tab-item, .tab-item').forEach(function(btn){
btn.onclick=function(ev){
if(ev){try{ev.preventDefault();}catch(e){}}
var tab=this.getAttribute('data-tab');
if(!tab)return;
if(typeof switchTab==='function')switchTab(tab);
};
});
})();

window._plNameMode='create';
window._plNameSong=null;
if($('plAddBtn'))$('plAddBtn').addEventListener('click',function(ev){
blurControl(ev.currentTarget||this);
window._plNameMode='create';
window._plNameSong=null;
$('plNameTitle').textContent='新建歌单';
$('plNameInput').value='';
showScrim('plNameScrim');
setTimeout(function(){$('plNameInput').focus();},100);
});
if($('plNameCancel'))$('plNameCancel').addEventListener('click',function(){hideScrim('plNameScrim');});
if($('plNameConfirm'))$('plNameConfirm').addEventListener('click',function(){
var name=($('plNameInput').value||'').trim();
hideScrim('plNameScrim');
if(window._plNameMode==='create'){
var pl=createPlaylist(name||null);
toast('已创建「'+pl.name+'」');
renderPlaylistsPage();
}else if(window._plNameMode==='fav'&&window._plNameSong){
var pl2=createPlaylist(name||null,[window._plNameSong]);
toast('已新建「'+pl2.name+'」并收藏');
if(typeof updateFavBtn==='function')updateFavBtn();
renderPlaylistsPage();
// 回到收藏弹窗并刷新星标
try{openFavDialog(window._plNameSong);}catch(e){}
}
});
if($('plSortBtn'))$('plSortBtn').addEventListener('click',function(e){if(e)e.stopImmediatePropagation();if(typeof togglePlaylistSort==='function')togglePlaylistSort();});

(function initPlDetailIcons(){
var map={
plDetailBack:ICON&&ICON.arrow?null:null
};
if($('plDetailBack')&&!$('plDetailBack').innerHTML.trim())$('plDetailBack').innerHTML='<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
$('plDetailSort')&&($('plDetailSort').innerHTML='<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>');
if($('plDetailExport')&&!$('plDetailExport').innerHTML.trim())$('plDetailExport').innerHTML=(ICON&&ICON.exportIco)||'<svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>';
$('plDetailPlay')&&($('plDetailPlay').innerHTML=(ICON&&ICON.play)||'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>');
$('plDetailRename')&&($('plDetailRename').innerHTML=(typeof ICON!=='undefined'&&ICON.edit)||'<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>');
$('plDetailDelete')&&($('plDetailDelete').innerHTML=(ICON&&ICON.del)||'<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>');
})();
if($('plDetailBack')){try{$('plDetailBack').addEventListener('click',function(ev){blurControl(ev.currentTarget||this);});}catch(e){}
$('plDetailBack').innerHTML='<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';$('plDetailBack').addEventListener('click',closePlaylistDetail);}

if($('plDetailExport'))$('plDetailExport').addEventListener('click',async function(){
if(!viewingPlId)return;
var pl=getPlaylist(viewingPlId);
if(!pl)return;
window._exportingPl=pl;
$('plExportName').textContent=pl.name||'歌单';
$('plExportKey').value='';
$('plExportKey').placeholder='正在上传...';
$('plExportCopy').disabled=true;
if(typeof ICON!=='undefined'&&ICON.copy)$('plExportCopy').innerHTML=ICON.copy;
$('plExportHint').textContent='正在将歌单上传到网络...';
showScrim('plExportScrim');
try{
var songs=pl.songs||[];
var raw=songs.map(function(s){
var name=(s.name||'').split('|').join(' ');
var artist=(s.artist||'').split('|').join(' ');
var pic=(s.pic||'').split('|').join(' ');
if(s.external)return (s.url||'')+'|'+name+'|'+artist+'|'+(s.srcUrl||'');
return String(s.id||'')+'|'+name+'|'+artist+(pic?'|'+pic:'');
}).join(String.fromCharCode(10));
var compressed=await gzipCompress(raw);
var toUpload=raw;
if(compressed&&('#GZIP:'+compressed).length<raw.length)toUpload='#GZIP:'+compressed;
var key=genShareKey();
var setRes=null;
try{setRes=await post('/api/cacheSet',{key:key,value:toUpload});}catch(e){setRes={ok:false,msg:String(e&&e.message||e)};}
var ok=!!(setRes&&setRes.ok);
var verify='';
try{verify=await cacheGetRaw(key);}catch(e){}
var verifyOk=!!(ok&&( !verify || verify.length>0 ));
if(ok)verifyOk=true;
if(ok||verifyOk){
$('plExportKey').value=key;
$('plExportKey').placeholder='';
$('plExportCopy').disabled=false;
if(typeof ICON!=='undefined'&&ICON.copy)$('plExportCopy').innerHTML=ICON.copy;
$('plExportHint').textContent='已上传 '+(songs.length)+' 首，可复制密钥分享';
if(typeof logAction==='function')logAction('导出歌单成功','name='+(pl.name||'')+' key='+key);
}else{
$('plExportKey').value='';
$('plExportKey').placeholder='上传失败';
$('plExportCopy').disabled=true;
var reason=(setRes&&setRes.msg)||'写入失败';
$('plExportHint').textContent='上传失败：'+reason;
if(typeof logError==='function')logError('导出歌单失败',reason);
}
}catch(e){
$('plExportHint').textContent='导出失败：'+(e.message||e);
logError('导出歌单失败',e);
}
});
if($('plExportClose'))$('plExportClose').addEventListener('click',function(){hideScrim('plExportScrim');});
if($('plExportScrim'))$('plExportScrim').addEventListener('click',function(e){if(e.target===this)hideScrim('plExportScrim');});
if($('plExportCopy'))$('plExportCopy').addEventListener('click',async function(){
var key=$('plExportKey').value;
if(!key){toast('请等待上传完成');return;}
try{await navigator.clipboard.writeText(key);toast('密钥已复制');}
catch(e){toast('复制失败：'+key);}
});
if($('plExportDownload'))$('plExportDownload').addEventListener('click',async function(){
var pl=window._exportingPl;
if(!pl)return;
try{
var songs=pl.songs||[];
var raw=songs.map(function(s){
var name=(s.name||'').split('|').join(' ');
var artist=(s.artist||'').split('|').join(' ');
var pic=(s.pic||'').split('|').join(' ');
if(s.external)return (s.url||'')+'|'+name+'|'+artist+'|'+(s.srcUrl||'');
return String(s.id||'')+'|'+name+'|'+artist+(pic?'|'+pic:'');
}).join(String.fromCharCode(10));
var compressed=await gzipCompress(raw);
var text=compressed?('#GZIP:'+compressed):raw;
var blob=new Blob([text],{type:'text/plain;charset=utf-8'});
var a=document.createElement('a');
a.href=URL.createObjectURL(blob);
a.download='playlist_'+(pl.name||'export').replace(/[\\\\/:*?"<>|]/g,'_')+'.txt';
document.body.appendChild(a);a.click();a.remove();
setTimeout(function(){URL.revokeObjectURL(a.href)},3000);
toast('已开始下载');
}catch(e){toast('下载失败');logError('下载歌单失败',e);}
});

if($('plDetailPlay'))$('plDetailPlay').addEventListener('click',function(){
if(viewingPlId)playEntirePlaylist(viewingPlId);
});
if($('plDetailRename'))$('plDetailRename').addEventListener('click',function(){
if(!viewingPlId)return;
var pl=getPlaylist(viewingPlId);
if(!pl)return;
var name=prompt('重命名歌单',pl.name||'');
if(name===null)return;
name=String(name).trim();
if(!name)return;
pl.name=name;pl.updatedAt=Date.now();
markLocalChange();savePlaylistsLocal();
$('plDetailTitle').textContent=name;
renderPlaylistsPage();
});

if($('plDetailSort'))$('plDetailSort').addEventListener('click',function(){
if(!viewingPlId)return;
var pl=getPlaylist(viewingPlId);
if(!pl||!pl.songs||!pl.songs.length){toast('歌单为空');return;}
viewingPlEditingOrder=!viewingPlEditingOrder;
openPlaylistDetail(viewingPlId);
toast(viewingPlEditingOrder?'用上下按钮调整顺序，完成后再点一次':'已退出排序');
});
if($('plDetailDelete'))$('plDetailDelete').addEventListener('click',function(){
if(!viewingPlId)return;
if(!confirm('确定删除该歌单？'))return;
state.playlists=(state.playlists||[]).filter(function(p){return p.id!==viewingPlId;});
markLocalChange();savePlaylistsLocal();
updateFavBtn();
closePlaylistDetail();
toast('已删除歌单');
});

if($('meChangePassBtn'))$('meChangePassBtn').addEventListener('click',function(){
if(!state.user)return;
window._changePassOk=false;
$('changePassOld').value='';
$('changePassNew').value='';
$('changePassNew2').value='';
$('changePassNew').disabled=true;
$('changePassNew2').disabled=true;
$('changePassHint').textContent='请先输入旧密码并验证';
showScrim('changePassScrim');
});
if($('changePassCancel'))$('changePassCancel').addEventListener('click',function(){hideScrim('changePassScrim');});
if($('changePassOld'))$('changePassOld').addEventListener('keydown',function(e){
if(e.key==='Enter')verifyOldPassForChange();
});
async function verifyOldPassForChange(){
var oldP=$('changePassOld').value;
if(!oldP){toast('请输入旧密码');return;}
var hash=await passwordToHash(oldP);
var raw=String(await textdbGetRaw(state.user.key)||'').trim();
var stored=(raw.split('\n')[0]||'').trim();
if(stored!==hash){toast('旧密码错误');window._changePassOk=false;return;}
window._changePassOk=true;
$('changePassNew').disabled=false;
$('changePassNew2').disabled=false;
$('changePassHint').textContent='旧密码正确，请输入新密码';
$('changePassNew').focus();
toast('旧密码正确');
}
if($('changePassGo'))$('changePassGo').addEventListener('click',async function(){
if(!window._changePassOk){
await verifyOldPassForChange();
return;
}
var n1=$('changePassNew').value;
var n2=$('changePassNew2').value;
if(!n1||!n2){toast('请输入并确认新密码');return;}
if(n1!==n2){toast('两次新密码不一致');return;}
var ok=await changePassword($('changePassOld').value,n1);
if(ok)hideScrim('changePassScrim');
});

if($('meLoginBtn'))$('meLoginBtn').addEventListener('click',function(ev){blurControl(ev.currentTarget||this);showScrim('loginScrim');});
if($('loginCancel'))$('loginCancel').addEventListener('click',function(){hideScrim('loginScrim');});
if($('loginGo'))$('loginGo').addEventListener('click',doLogin);
if($('loginPass'))$('loginPass').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});
var loginInFlight=false;
async function doLogin(){
if(loginInFlight)return;
var u=($('loginUser')&&$('loginUser').value)||'';
var p=($('loginPass')&&$('loginPass').value)||'';
if(!String(u).trim()||!String(p)){
toast('请输入用户名和密码');
return;
}
loginInFlight=true;
var go=$('loginGo'), userEl=$('loginUser'), passEl=$('loginPass');
var oldLabel='确认';
try{
if(go){
oldLabel=go.textContent||'确认';
go.disabled=true;
go.textContent='登录中...';
go.setAttribute('aria-busy','true');
}
if(userEl)userEl.disabled=true;
if(passEl)passEl.disabled=true;
var r=await loginOrRegister(u,p);
if(!r){
toast('登录失败');
return;
}
hideScrim('loginScrim');
renderMePage();
if(typeof startSyncLoop==='function')startSyncLoop();
if(r.isNew){
await pushSync();
toast('注册并登录成功');logAction('注册并登录成功');
}else{
window._pendingCloud=r.cloud;
// 只弹一次同步选项
if(!window._syncChoiceOpen){
window._syncChoiceOpen=true;
showScrim('syncChoiceScrim');
}
}
}catch(e){
toast((e&&e.message)||'登录失败');
}finally{
loginInFlight=false;
try{
if(go){go.disabled=false;go.textContent=oldLabel||'确认';go.removeAttribute('aria-busy');}
if(userEl)userEl.disabled=false;
if(passEl)passEl.disabled=false;
}catch(e){}
}
}
if($('syncChoiceOk'))$('syncChoiceOk').addEventListener('click',async function(){
if(window._syncChoiceBusy)return;
window._syncChoiceBusy=true;
try{
var plMode=(document.querySelector('input[name="syncPlMode"]:checked')||{}).value||'merge';
var setMode=(document.querySelector('input[name="syncSetMode"]:checked')||{}).value||'merge';
if(window._pendingCloud){
applyCloudData(window._pendingCloud,{plMode:plMode,setMode:setMode,keepLocalSettings:setMode==='merge'});
window._pendingCloud=null;
}
window._syncChoiceOpen=false;
hideScrim('syncChoiceScrim');
await pushSync();
renderPlaylistsPage();
renderMePage();
toast('同步完成');
}finally{
window._syncChoiceBusy=false;
}
});
if($('meLogoutBtn'))$('meLogoutBtn').addEventListener('click',function(ev){
blurControl(ev.currentTarget||this);
showScrim('logoutScrim');
});
if($('logoutCancel'))$('logoutCancel').addEventListener('click',function(){hideScrim('logoutScrim');});
if($('logoutConfirm'))$('logoutConfirm').addEventListener('click',function(){
hideScrim('logoutScrim');
if(typeof logAction==='function')logAction('退出登录');
state.user=null;
try{localStorage.removeItem(COOKIE_AUTH);}catch(e){}
try{localStorage.removeItem(COOKIE_PLAYLISTS);}catch(e){}
try{localStorage.removeItem(COOKIE_LIST_HIST);}catch(e){}
try{localStorage.removeItem(COOKIE_SETTINGS);}catch(e){}
// 保留歌曲列表与主题
var keepTheme=state.theme||'green';
state.playlists=[];
state.listHistory=[];
state.syncPlaylists=true;
state.syncSettings=true;
applyTheme(keepTheme);
savePlaylistsLocal();
if(syncTimer){clearInterval(syncTimer);syncTimer=null;}
renderMePage();
renderPlaylistsPage();
if(typeof updateFavBtn==='function')updateFavBtn();
toast('已退出登录');if(typeof logAction==='function')logAction('退出登录');;
});
if($('meSyncBtn'))$('meSyncBtn').addEventListener('click',async function(){
toast('正在同步...');
try{
var result=await pullAndMergeSync();
if(result==='pushed'){toast('同步完成');return;}
if(result==='pulled'){
var ok=await pushSync();
toast(ok?'同步完成':'已拉取云端，刷新 key 失败');
return;
}
// noop 或 fail：尝试推送或刷新
var ok2=await pushSync();
if(ok2){toast('同步完成');return;}
await refreshAccountTtl();
toast('同步完成');
}catch(e){toast('同步失败');}
});
if($('syncPlaylists'))$('syncPlaylists').addEventListener('change',function(){
state.syncPlaylists=this.checked;saveSettingsLocal();markLocalChange();
});
if($('syncSettings'))$('syncSettings').addEventListener('change',function(){
state.syncSettings=this.checked;saveSettingsLocal();markLocalChange();
});
document.querySelectorAll('.theme-dot').forEach(function(dot){
dot.addEventListener('click',function(){
applyTheme(dot.getAttribute('data-theme'));
renderMePage();
toast('主题已切换');
});
});

if($('plImportBtn'))$('plImportBtn').addEventListener('click',function(){
showScrim('plImportScrim');
});

if($('urlKeyCancel'))$('urlKeyCancel').addEventListener('click',function(){hideScrim('urlKeyScrim');window._urlKeyPending=null;});
if($('urlKeyToList'))$('urlKeyToList').addEventListener('click',function(){
var k=window._urlKeyPending;
hideScrim('urlKeyScrim');
if(k)importKeyAsSongList(k);
});
if($('urlKeyToPl'))$('urlKeyToPl').addEventListener('click',function(){
var k=window._urlKeyPending;
hideScrim('urlKeyScrim');
if(!k)return;
// 打开歌单导入框，填入 key
$('plImportKey').value=k;
showScrim('plImportScrim');
});

if($('plExportBtn'))$('plExportBtn').addEventListener('click',async function(){
if(!(state.playlists||[]).length){toast('暂无歌单可导出');return;}
// 导出全部歌单为 JSON gzip key 或文本
var data=JSON.stringify({v:1,type:'playlists',playlists:state.playlists});
try{
if(typeof gzipCompress==='function'){
var gz=await gzipCompress(data);
var key='';
try{
var r=await post('/api/cacheSet',{key:'',value:gz});
// fallback: upload via textdb-style if available
}catch(e){}
}
}catch(e){}
// 简单：复制 JSON 到剪贴板 / 下载
try{
await navigator.clipboard.writeText(data);
toast('歌单数据已复制到剪贴板');
}catch(e){
var a=document.createElement('a');
a.href=URL.createObjectURL(new Blob([data],{type:'text/plain'}));
a.download='playlists.json';
a.click();
toast('已下载歌单文件');
}
});

if($('plImportCancel'))$('plImportCancel').addEventListener('click',function(){hideScrim('plImportScrim');});

var listHistIndex=-1; // -1 = current live list
function refreshHistButtons(){
var prev=$('sheetHistPrev'), next=$('sheetHistNext');
if(!prev||!next)return;
var n=(state.listHistory||[]).length;
prev.style.display=n?'':'none';
next.style.display=n?'':'none';
prev.innerHTML='<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
next.innerHTML='<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
}
function showHistoryList(idx){
if(idx<0){
listHistIndex=-1;
render(); // uses state.playlist
$('sheetTitle').textContent='当前';
return;
}
var snap=(state.listHistory||[])[idx];
if(!snap)return;
listHistIndex=idx;
// temporarily display snapshot in sheet without destroying current
var box=$('sheetList');
if(!box)return;
box.innerHTML='';
$('sheetTitle').textContent='历史';
(snap.playlist||[]).forEach(function(song,i){
var row=document.createElement('div');
row.className='song-row';
row.innerHTML='<div class="song-row-info"><div class="song-row-name"><span class="name-text"></span></div><div class="song-row-artist"></div></div>';
row.querySelector('.name-text').textContent=song.name||'';
row.querySelector('.song-row-artist').textContent=song.artist||'';
row.addEventListener('click',function(){
// restore this history as current
pushListHistory();
state.playlist=(snap.playlist||[]).slice();
state.current=typeof snap.current==='number'?snap.current:-1;
savePlaylist();
listHistIndex=-1;
hideScrim('listScrim');
render();
toast('已恢复该历史列表');
});
box.appendChild(row);
});
}
if($('sheetHistPrev'))$('sheetHistPrev').addEventListener('click',function(){
var n=(state.listHistory||[]).length;
if(!n)return;
if(listHistIndex<0)showHistoryList(0);
else if(listHistIndex<n-1)showHistoryList(listHistIndex+1);
});
if($('sheetHistNext'))$('sheetHistNext').addEventListener('click',function(){
if(listHistIndex<=0){showHistoryList(-1);render();$('sheetTitle').textContent='当前';}
else showHistoryList(listHistIndex-1);
});

// 歌单页 / 歌曲列表 使用不同图标

if($('plImportConfirm'))$('plImportConfirm').addEventListener('click',async function(){
var val=($('plImportKey').value||'').trim();
if(!val){toast('请输入密钥或内容');return;}
var mode='new';
var radios=document.getElementsByName('plImportMode');
for(var i=0;i<radios.length;i++){if(radios[i].checked){mode=radios[i].value;break;}}
var targetId=null;
if(mode==='merge'){
var sel=$('plImportTarget');
if(sel)targetId=sel.value;
if(!targetId&&state.playlists&&state.playlists[0])targetId=state.playlists[0].id;
}
await importKeyAsPlaylist(val, mode, targetId);
hideScrim('plImportScrim');
});
if($('plImportCancel'))$('plImportCancel').addEventListener('click',function(){hideScrim('plImportScrim');});

function rebindCriticalUI(){
try{
var tabBar=$('tabbar');
if(tabBar&&!tabBar._bound){
tabBar._bound=true;
tabBar.addEventListener('click',function(ev){
var btn=ev.target;
while(btn&&btn!==tabBar){
if(btn.classList&&btn.classList.contains('tab-item')){
var tab=btn.getAttribute('data-tab');
if(tab&&typeof switchTab==='function'){
ev.preventDefault();
switchTab(tab);

try{
var lb=$('meLogsBtn');
if(lb&&!lb._bound){
lb._bound=true;
lb.addEventListener('click',function(){if(typeof openLogsPage==='function')openLogsPage();});
}
var rb=$('refreshAppBtn');
if(rb&&!rb._bound){
rb._bound=true;
if(typeof ICON!=='undefined'&&ICON.refresh)rb.innerHTML=ICON.refresh;
rb.addEventListener('click',function(ev){
try{if(ev&&ev.currentTarget)ev.currentTarget.blur();}catch(e){}
try{
if(typeof forceRefreshApp==='function')forceRefreshApp();
else{
try{localStorage.removeItem('m3_media_cache');}catch(e2){}
toast('已清理媒体缓存');
}
}catch(e){try{toast('刷新失败');}catch(e3){}}
});
}
}catch(e){}
}
return;
}
btn=btn.parentNode;
}
},true);
}
}catch(e){console.error('tab bind',e);}
try{
var fav=$('favBtn');
if(fav&&!fav._bound){
fav._bound=true;
fav.addEventListener('click',function(){
try{this.blur();}catch(e){}
var song=state.playlist[state.current];
if(!song){toast('没有可收藏的歌曲');return;}
if(typeof openFavDialog==='function')openFavDialog(song);
else toast('收藏功能未就绪');
});
}
}catch(e){console.error('fav bind',e);}
try{
var ic=$('importConfirm');
if(ic&&!ic._bound){
ic._bound=true;
ic.addEventListener('click',async function(){
try{
var val=(($('importKey')&&$('importKey').value)||'').trim();
if(!val){toast('请输入密钥、歌单文本或选择文件');return;}
if($('importHint'))$('importHint').textContent='正在解析...';
var text=await resolveImportText(val);
if(!text){
if($('importHint'))$('importHint').textContent='';
toast('无法解析或密钥不存在');
return;
}
var imported=parseListText(text);
if(!imported.length){
if($('importHint'))$('importHint').textContent='';
toast('歌单内容为空');
return;
}
var mode='new';
var radios=document.getElementsByName('importMode');
for(var i=0;i<radios.length;i++){if(radios[i].checked){mode=radios[i].value;break;}}
applyImport(imported,mode);
savePlaylist();
if($('importScrim'))hideScrim('importScrim');
if($('importHint'))$('importHint').textContent='';
toast('已导入 '+imported.length+' 首');
render();
}catch(err){
console.error(err);
toast('导入失败: '+(err.message||'未知错误'));
if($('importHint'))$('importHint').textContent='';
}
});
}
}catch(e){console.error('import bind',e);}
try{
var ea=$('emptyAdd');
if(ea&&!ea._bound){ea._bound=true;ea.addEventListener('click',function(ev){blurControl(ev.currentTarget||this);if(typeof openAdd==='function')openAdd();});}
var ei=$('emptyImport');
if(ei&&!ei._bound){ei._bound=true;ei.addEventListener('click',function(ev){blurControl(ev.currentTarget||this);if(typeof openImportDialog==='function')openImportDialog();});}
}catch(e){}
}


// ==================== 本地错误日志（最多 10 条，不上云） ====================
var LOG_KEY='m3_error_logs';
function loadErrorLogs(){
try{var a=JSON.parse(localStorage.getItem(LOG_KEY)||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}
}
function saveErrorLogs(list){
try{localStorage.setItem(LOG_KEY,JSON.stringify(list.slice(-10)));}catch(e){}
}
function logEvent(type,msg,detail){
try{
var list=loadErrorLogs();
var d='';
if(detail!=null){
if(typeof detail==='string')d=detail;
else if(detail&&detail.stack)d=String(detail.stack);
else if(detail&&detail.message)d=String(detail.message);
else{try{d=JSON.stringify(detail);}catch(e){d=String(detail);}}
}
d=String(d).replace(/("pass(?:word)?"\s*:\s*")[^"]*(")/gi,"$1***$2");
d=d.replace(/(password|passwd|pwd)\s*[:=]\s*\S+/gi,"$1=***");
list.push({t:Date.now(),type:String(type||'info'),msg:String(msg||''),detail:d});
while(list.length>10)list.shift();
saveErrorLogs(list);
}catch(e){}
}
function logError(msg,err){logEvent('error',msg,err);}
function logAction(msg,detail){logEvent('action',msg,detail);}
function renderLogsPage(){
var box=$('logsList');
if(!box)return;
var all=loadErrorLogs();
var list=all.slice().reverse();
if(!list.length){box.innerHTML='<div class="logs-empty">暂无日志</div>';return;}
box.innerHTML=list.map(function(item,idx){
var realIdx=all.length-1-idx;
var time=new Date(item.t||0).toLocaleString();
var type=item.type||'info';
var safeMsg=String(item.msg||'').replace(/</g,'&lt;');
var safeDetail=String(item.detail||'').replace(/</g,'&lt;');
var long=safeDetail.length>120;
var body='<b>['+type+'] '+safeMsg+'</b>'+(safeDetail?('\n'+safeDetail):'');
return '<div class="logs-item" data-log="'+realIdx+'"><div class="logs-item-time">'+time+'</div><div class="logs-item-msg'+(long?' collapsed':'')+'">'+body+(long?'<div class="logs-more">点击展开</div>':'')+'</div><div class="logs-item-actions"><button class="text-btn log-copy" type="button">复制</button><button class="text-btn log-del" type="button">删除</button></div></div>';
}).join('');
}
var _origToast=typeof toast==='function'?toast:null;

// ==================== 强制刷新（先同步，再版本检测） ====================
async function forceRefreshApp(){
try{toast('正在清理缓存...');}catch(e){}
try{localStorage.removeItem(typeof MEDIA_CACHE_KEY!=='undefined'?MEDIA_CACHE_KEY:'m3_media_cache');}catch(e){}
try{
if(typeof preloadCache==='object'&&preloadCache){
for(var k in preloadCache){if(Object.prototype.hasOwnProperty.call(preloadCache,k))delete preloadCache[k];}
}
}catch(e){}
try{
if(typeof preloadTimers==='object'&&preloadTimers){
for(var t in preloadTimers){
if(!Object.prototype.hasOwnProperty.call(preloadTimers,t))continue;
var pt=preloadTimers[t];
if(pt){if(pt.pic)clearTimeout(pt.pic);if(pt.lyric)clearTimeout(pt.lyric);if(pt.url)clearTimeout(pt.url);}
delete preloadTimers[t];
}
}
}catch(e){}
try{if(typeof logAction==='function')logAction('刷新：已清理媒体缓存');}catch(e){}

var remoteVer='';
var bundleVer=(typeof APP_VERSION!=='undefined'&&APP_VERSION)?String(APP_VERSION):'';
try{
var r=await fetch(toAbsoluteApiUrl('/api/version')+'?t='+Date.now(),{cache:'no-store'});
var d=await r.json();
remoteVer=d&&d.version?String(d.version):'';
}catch(e){}
// 与当前前端包版本比较，不要用 localStorage（启动时会被旧 APP_VERSION 覆盖导致每次都「有新版本」）
if(remoteVer&&bundleVer&&remoteVer!==bundleVer){
try{localStorage.setItem('m3_app_version',remoteVer);}catch(e){}
try{toast('发现新版本，正在更新…');}catch(e){}
try{
if('serviceWorker' in navigator){
var regs=await navigator.serviceWorker.getRegistrations();
for(var i=0;i<regs.length;i++){
try{await regs[i].update();}catch(e){}
}
}
}catch(e){}
// 清掉可能缓存旧包的 Cache Storage
try{
if(window.caches&&caches.keys){
var keys=await caches.keys();
for(var ci=0;ci<keys.length;ci++){try{await caches.delete(keys[ci]);}catch(e){}}
}
}catch(e){}
setTimeout(function(){try{location.reload(true);}catch(e){try{location.reload();}catch(e2){}}},250);
return;
}
// 版本一致：同步写入 localStorage
if(remoteVer||bundleVer){
try{localStorage.setItem('m3_app_version',remoteVer||bundleVer);}catch(e){}
}
try{toast('媒体缓存已清理');}catch(e){}
try{if(typeof restorePlaylist==='function')restorePlaylist();}catch(e){}
try{if(typeof savePlaylist==='function')savePlaylist();}catch(e){}
try{logEvent('action','刷新完成','list='+(state.playlist?state.playlist.length:0));}catch(e){}
try{
var wasPlaying=!!state.playing;
var resumePos=0;
try{resumePos=audio.currentTime||0;}catch(e){}
var ci=state.current;
if(ci>=0&&state.playlist[ci]&&!state.playlist[ci].external){
// 清的是媒体缓存，重新取链；保持暂停/播放意图与进度
// 使用 playToken，暂停/取消获取时 togglePlay 会 ++playToken
var token=++playToken;
state.audioUrl='';
state.quality='';
state.playing=wasPlaying;
state.loadingUrl=!!wasPlaying;
render();
(async function(){
try{
var song=state.playlist[ci];
if(!song)return;
var result=null;
if(typeof fetchPlayUrl==='function')result=await fetchPlayUrl(song.id,song.duration);
else if(typeof tryGetLevelWithCache==='function')result=await tryGetLevelWithCache(song.id,'exhigh',30);
// 用户已点暂停取消
if(token!==playToken){
state.loadingUrl=false;
try{audio.pause();}catch(e){}
render();
return;
}
if(result&&result.url){
state.audioUrl=result.url;
state.quality=result.level||'exhigh';
await setAudioSource(result.url,song.format);
state.loadingUrl=false;
var applyPos=function(){
if(token!==playToken){try{audio.pause();}catch(e){}return;}
// 无论播放/暂停都恢复进度（暂停刷新不应把进度条打回开头）
try{
if(resumePos>0&&audio.duration&&isFinite(audio.duration)){
audio.currentTime=Math.min(resumePos,audio.duration);
updateSeekBg((audio.currentTime/audio.duration)*100);
$('curTime').textContent=fmt(audio.currentTime);
}else if(resumePos>0){
// duration 未就绪时先记着
pendingSeekFromUser=true;
pendingSeekRatio=null;
try{audio.currentTime=resumePos;}catch(e){}
}
}catch(e){}
if(token!==playToken||!state.playing){try{audio.pause();}catch(e){}state.playing=false;state.loadingUrl=false;render();return;}
try{var p=audio.play();if(p&&p.catch)p.catch(function(){});}catch(e){}
render();
};
if(audio.readyState>=1)applyPos();
else audio.addEventListener('loadedmetadata',function once(){audio.removeEventListener('loadedmetadata',once);applyPos();});
}else{
if(token===playToken){
state.loadingUrl=false;
state.playing=false;
render();
}
}
}catch(e){
if(token===playToken){
state.loadingUrl=false;
if(!wasPlaying)state.playing=false;
render();
}
}
})();
}else{
state.loadingUrl=false;
render();
}
}catch(e){}
try{if(typeof render==='function')render();}catch(e){}
}
window.__forceRefresh=forceRefreshApp;
window.forceRefreshApp=forceRefreshApp;


function bindLogsListClicks(){
var box=$('logsList');
if(!box||box._logsBound)return;
box._logsBound=true;
box.addEventListener('click',function(e){
try{
var t=e.target;
var copy=t.closest&&t.closest('.log-copy');
var del=t.closest&&t.closest('.log-del');
var msgEl=t.closest&&t.closest('.logs-item-msg');
if(msgEl&&!copy&&!del){
msgEl.classList.toggle('expanded');
msgEl.classList.toggle('collapsed');
var more=msgEl.querySelector('.logs-more');
if(more)more.textContent=msgEl.classList.contains('expanded')?'点击收起':'点击展开';
return;
}
var item=t.closest&&t.closest('.logs-item');
if(!item)return;
var idx=parseInt(item.getAttribute('data-log'),10);
var list=loadErrorLogs();
if(copy){
var row=list[idx];
var text=(row&&('['+(row.type||'')+'] '+(row.msg||'')+'\n'+(row.detail||'')))||'';
try{
if(navigator.clipboard&&navigator.clipboard.writeText){
navigator.clipboard.writeText(text).then(function(){toast('已复制');}).catch(function(){
var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();
document.execCommand('copy');ta.remove();toast('已复制');
});
}else{
var ta2=document.createElement('textarea');ta2.value=text;document.body.appendChild(ta2);ta2.select();
document.execCommand('copy');ta2.remove();toast('已复制');
}
}catch(err){toast('复制失败');}
return;
}
if(del){
list.splice(idx,1);
saveErrorLogs(list);
renderLogsPage();
toast('已删除');
}
}catch(err){try{toast('日志操作失败');}catch(e){}}
});
}

function openLogsPage(){
try{
try{if(typeof closeOtherScrims==='function')closeOtherScrims('logsScrim');}catch(e){}
if(typeof renderLogsPage==='function')renderLogsPage();
try{bindLogsListClicks();}catch(e){}
var box=$('logsList');
if(box&&(!box.innerHTML||box.innerHTML.indexOf('logs-empty')!==-1)){
var n=(typeof loadErrorLogs==='function'?loadErrorLogs().length:0);
if(!n)box.innerHTML='<div class="logs-empty">暂无日志。添加歌曲、导出、播放失败等会出现在这里。</div>';
}
var s=$('logsScrim');
if(s){
var was=s.classList.contains('show');
s.classList.add('show');
s.style.display='flex';
if(!was){try{history.pushState({app:1,scrim:1},'');}catch(e){}}
}
if(typeof showScrim==='function')showScrim('logsScrim');
}catch(e){
try{toast('打开日志失败:'+(e&&e.message||e));}catch(e2){}
}
}
function closeLogsPage(){
try{
var s=$('logsScrim');
if(s){s.classList.remove('show');s.style.display='';}
if(typeof hideScrim==='function')hideScrim('logsScrim');
}catch(e){}
}
window.openLogsPage=openLogsPage;
window.closeLogsPage=closeLogsPage;



(function bindLogsAndRefresh(){
try{
if($('refreshAppBtn')&&!$('refreshAppBtn')._bound){
$('refreshAppBtn')._bound=true;
if(typeof ICON!=='undefined'&&ICON.refresh)$('refreshAppBtn').innerHTML=ICON.refresh;
$('refreshAppBtn').addEventListener('click',function(ev){
try{blurControl(ev.currentTarget||this);}catch(e){}
if(typeof forceRefreshApp==='function')forceRefreshApp();
});
}
}catch(e){}
try{
if($('meLogsBtn')&&!$('meLogsBtn')._bound){
$('meLogsBtn')._bound=true;
$('meLogsBtn').addEventListener('click',function(){openLogsPage();});
}
}catch(e){}
try{
if($('logsBack')&&!$('logsBack')._bound){
$('logsBack')._bound=true;
$('logsBack').addEventListener('click',function(ev){
try{ev.preventDefault();ev.stopPropagation();}catch(e){}
if(typeof closeLogsPage==='function')closeLogsPage();
else{
var s=$('logsScrim');
if(s){s.classList.remove('show');s.style.display='';}
}
});
}
}catch(e){}
try{
if($('logsScrim')&&!$('logsScrim')._bound){
$('logsScrim')._bound=true;
$('logsScrim').addEventListener('click',function(e){
if(e.target===$('logsScrim')){
if(typeof closeLogsPage==='function')closeLogsPage();
else {var s=$('logsScrim');if(s){s.classList.remove('show');s.style.display='';}}
}
});
}
}catch(e){}
try{
if($('logsList')&&!$('logsList')._bound){
$('logsList')._bound=true;
$('logsList').addEventListener('click',function(e){
var msgEl=e.target.closest('.logs-item-msg');
if(msgEl&&!e.target.closest('.log-copy')&&!e.target.closest('.log-del')){
msgEl.classList.toggle('expanded');
msgEl.classList.toggle('collapsed');
var more=msgEl.querySelector('.logs-more');
if(more)more.textContent=msgEl.classList.contains('expanded')?'点击收起':'点击展开';
return;
}
var copy=e.target.closest('.log-copy');
var del=e.target.closest('.log-del');
var item=e.target.closest('.logs-item');
if(!item)return;
var idx=parseInt(item.getAttribute('data-log'),10);
var list=loadErrorLogs();
if(copy){
var row=list[idx];
var text=(row&&('['+(row.type||'')+'] '+row.msg+'\n'+row.detail))||'';
(async function(){
try{await navigator.clipboard.writeText(text);toast('已复制');}
catch(err){toast('复制失败');}
})();
return;
}
if(del){
list.splice(idx,1);
saveErrorLogs(list);
renderLogsPage();
toast('已删除');
}
});
}
}catch(e){}
try{
window.addEventListener('error',function(ev){
if(typeof logError==='function')logError('window.error',(ev&&ev.error)||(ev&&ev.message)||ev);
});
window.addEventListener('unhandledrejection',function(ev){
if(typeof logError==='function')logError('unhandledrejection',(ev&&ev.reason)||ev);
});
}catch(e){}
})();

// ==================== 启动 ====================
(function boot(){
try{updateSeekBg(0);}catch(e){}
try{setupMediaSession();}catch(e){}
try{restoreSettingsLocal();}catch(e){}
try{applyTheme(state.theme||'green');}catch(e){}
try{restorePlaylistsLocal();}catch(e){}
try{restoreListHistory();}catch(e){}
try{restoreAuthLocal();}catch(e){}
try{if(typeof restoreSyncMetaLocal==='function')restoreSyncMetaLocal();}catch(e){}
try{restorePlaylist();}catch(e){}
try{state.playing=false;}catch(e){} // boot: reset button to pause
try{
if(state.playlist&&state.playlist.length){
state.playlistLoading=false;
if(state.current<0)state.current=0;
}
}catch(e){}
try{logEvent('action','启动恢复列表','count='+(state.playlist?state.playlist.length:0)+' current='+state.current+' loading='+!!state.playlistLoading);}catch(e){}
try{render();}catch(e){console.error('render',e);}
// 无论成功与否：短轮询 + 硬超时结束 loading（避免永远「列表加载中」）
try{
if(typeof ensurePlaylistRestored==='function'){
ensurePlaylistRestored(function(ok){
try{
state.playlistLoading=false;
if(state.playlist&&state.playlist.length&&state.current<0)state.current=0;
logEvent('action','列表加载结束','ok='+ok+' count='+(state.playlist?state.playlist.length:0));
render();
}catch(e){}
});
}else{
state.playlistLoading=false;
render();
}
}catch(e){try{state.playlistLoading=false;render();}catch(e2){}}
// 硬超时兜底 1.2s
try{setTimeout(function(){
if(state.playlistLoading){
state.playlistLoading=false;
try{restorePlaylist();}catch(e){}
try{render();}catch(e){}
}
},1200);}catch(e){}

try{setTimeout(function(){try{if(state.playlist&&state.playlist.length&&state.current<0){state.current=0;}render();}catch(e){}},50);}catch(e){}
try{setTimeout(function(){try{render();}catch(e){}},300);}catch(e){}
try{
// 恢复后若有歌，预取当前曲链接（不自动播放）
if(state.playlist&&state.playlist.length&&state.current>=0){
var cs=state.playlist[state.current];
if(cs&&!cs.external&&typeof tryGetLevelWithCache==='function'){
tryGetLevelWithCache(cs.id,'exhigh',30).catch(function(){});
}
}
}catch(e){}
try{if(typeof updateFavBtn==='function')updateFavBtn();}catch(e){}
try{
if(!state.playlist||!state.playlist.length){
if($('emptyActions'))$('emptyActions').style.display='flex';
if($('coverBox'))$('coverBox').style.display='none';
if($('lyricBox'))$('lyricBox').style.display='none';
}
}catch(e){}
try{if(typeof __bindTabBar==='function')__bindTabBar();}catch(e){}
try{
document.querySelectorAll('#tabbar .tab-item').forEach(function(btn){
btn.onclick=function(){
var tab=this.getAttribute('data-tab');
if(tab&&typeof switchTab==='function')switchTab(tab);
};
});
}catch(e){}
try{rebindCriticalUI();}catch(e){}
setTimeout(function(){try{rebindCriticalUI();}catch(e){}},100);
try{if(typeof switchTab==='function')switchTab('player');}catch(e){}
if(state.user){
try{syncAndMaybeRefreshKey().catch(function(){});}catch(e){}
}
function _runHandleUrlParams(){
try{
var p=handleUrlParams();
if(p&&typeof p.then==='function')p.catch(function(err){
try{logEvent('error','链接参数',String(err&&err.message||err));}catch(e){}
try{toast('链接参数处理失败: '+(err&&err.message||err));}catch(e){}
});
}catch(e){}
}
try{if(!state.playing)resetProgressUI();}catch(e){}
setTimeout(_runHandleUrlParams,200);
setTimeout(_runHandleUrlParams,600);
setTimeout(_runHandleUrlParams,1500);
try{window.handleUrlParams=handleUrlParams;window._runHandleUrlParams=_runHandleUrlParams;}catch(e){}

// 确保歌单/我的页按钮一定有事件（防前面脚本中断）

try{if(typeof APP_VERSION!=='undefined'&&APP_VERSION){var _sv=localStorage.getItem('m3_app_version')||'';if(!_sv)_sv=APP_VERSION;localStorage.setItem('m3_app_version',APP_VERSION);}}catch(e){}
try{
window.addEventListener('beforeunload',function(){
try{if(typeof savePlaylist==='function')savePlaylist();}catch(e){}
try{if(typeof savePlaylistsLocal==='function')savePlaylistsLocal();}catch(e){}
try{if(typeof saveAuthLocal==='function')saveAuthLocal();}catch(e){}
try{if(typeof saveSettingsLocal==='function')saveSettingsLocal();}catch(e){}
});
}catch(e){}
state._booted=true;
if('serviceWorker' in navigator){
window.addEventListener('load',function(){
navigator.serviceWorker.register(toAbsoluteApiUrl('/sw.js')).catch(function(){});
});
}
})();


// ===== 全局兜底：即使 boot 中途异常，也要结束列表加载并恢复 =====
(function playlistLoadFailsafe(){
function run(){
try{if(typeof restorePlaylist==='function')restorePlaylist();}catch(e){}
try{
if(state){
state.playlistLoading=false;
if(state.playlist&&state.playlist.length&&(state.current<0||state.current>=state.playlist.length))state.current=0;
}
}catch(e){}
try{if(typeof render==='function')render();}catch(e){}
}
try{run();}catch(e){}
try{setTimeout(run,50);}catch(e){}
try{setTimeout(run,200);}catch(e){}
try{setTimeout(run,600);}catch(e){}
try{setTimeout(run,1200);}catch(e){}
})();
`;
