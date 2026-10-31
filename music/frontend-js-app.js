export const APP_SCRIPT = String.raw`function blurControl(el){
try{if(el&&el.blur)el.blur();}catch(e){}
try{if(document.activeElement&&document.activeElement!==document.body)document.activeElement.blur();}catch(e){}
}
function showScrim(id){
var el=typeof id==='string'?$(id):id;
if(!el)return;
requestAnimationFrame(function(){el.classList.add('show');});
}
function hideScrim(id){
var el=typeof id==='string'?$(id):id;
if(!el)return;
el.classList.remove('show');
}
// ==================== Media Session ====================
function updateMediaSessionMetadata(){
if(!('mediaSession' in navigator))return;
try{
var song=state.playlist[state.current];
if(!song){
navigator.mediaSession.metadata=new MediaMetadata({
title:SITE_TITLE,
artist:'',
album:'',
artwork:[{src:DEFAULT_ICON,sizes:'96x96',type:'image/png'}]
});
return;
}
var artwork=[];
if(song.pic){
artwork.push({src:song.pic,sizes:'512x512',type:'image/jpeg'});
artwork.push({src:song.pic,sizes:'256x256',type:'image/jpeg'});
artwork.push({src:song.pic,sizes:'192x192',type:'image/jpeg'});
artwork.push({src:song.pic,sizes:'96x96',type:'image/jpeg'});
}else{
artwork.push({src:DEFAULT_ICON,sizes:'96x96',type:'image/png'});
}
navigator.mediaSession.metadata=new MediaMetadata({
title:song.name||'未知歌曲',
artist:song.artist||'未知歌手',
album:SITE_TITLE,
artwork:artwork
});
}catch(e){}
}

function updateMediaSessionPlaybackState(){
if(!('mediaSession' in navigator))return;
try{
navigator.mediaSession.playbackState=state.playing?'playing':'paused';
}catch(e){}
}

function setupMediaSession(){
if(!('mediaSession' in navigator))return;
try{
navigator.mediaSession.setActionHandler('play',function(){togglePlay()});
navigator.mediaSession.setActionHandler('pause',function(){togglePlay()});
navigator.mediaSession.setActionHandler('previoustrack',function(){prevSong()});
navigator.mediaSession.setActionHandler('nexttrack',function(){nextSong()});
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
function scheduleMediaSessionUpdate(){
var song=state.playlist[state.current];
var key=state.current+'|'+(song?(song.id||''):'')+'|'+(song?(song.name||''):'')+'|'+(song?(song.artist||''):'')+'|'+(song?(song.pic||''):'');
if(state._lastMediaKey===key)return;
state._lastMediaKey=key;
updateMediaSessionMetadata();
}

function render(){
var song=state.playlist[state.current];
var hasSongs=state.playlist.length>0;

$('title').textContent=song?(song.name||'未知歌曲'):'未在播放';
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

if($('emptyActions'))$('emptyActions').style.display=hasSongs?'none':'flex';
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

if($('playBtn'))$('playBtn').innerHTML=(state.playing||refreshingUrl)?ICON.pause:ICON.play;
$('prevBtn').disabled=!hasSongs;
$('nextBtn').disabled=!hasSongs;

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
async function playIndex(i,forcedQuality,startPos){
if(i<0||i>=state.playlist.length)return;
var token=++playToken;

stopAudio();
resetProgressUI();

state.current=i;
if(typeof updateFavBtn==='function')updateFavBtn();
state.showLyric=false;
state.audioUrl='';state.quality='';
state.playing=true;

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

if(pe&&pe.lyricDone){
state.lyric=pe.lyric||'暂无歌词';
state.lyricTrans=pe.lyricTrans||'';
state.lyricRoma=pe.lyricRoma||'';
state.lyricLoading=false;
state._lastLyricKey=null;
}else{
state.lyric='';state.lyricTrans='';state.lyricRoma='';
state.lyricLoading=true;
state._lastLyricKey=null;
}

if(pe&&pe.pic&&!song.pic){
song.pic=pe.pic;
preloadCover(pe.pic);
}

render();

var result;
try{
if(song.external){
result={url:song.url,level:'external',expi:0};
}else if(forcedQuality){
var u=await fetchPlayUrlLevel(song.id,forcedQuality,(song.duration||360)+URL_SAFETY_BUFFER);
if(!u)throw new Error('音源加载失败');
result={url:u,level:forcedQuality,expi:0};
}else if(pe&&pe.url&&isHttpUrl(pe.url)&&pe.quality){
result={url:pe.url,level:pe.quality,expi:0};
}else{
result=await fetchPlayUrl(song.id,song.duration);
}
if(token!==playToken)return;
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
await setAudioSource(result.url,song.format);
if(startPos&&startPos>0){
try{audio.currentTime=startPos;}catch(e){}
}
}catch(e){
if(token!==playToken)return;
state.playing=false;
state.lyricLoading=false;
state.quality='unavailable';
toast(e.message||'播放失败');
render();
return;
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
if(cachedLyric){
state.lyric=cachedLyric.main||'暂无歌词';
state.lyricTrans=cachedLyric.trans||'';
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
}else{
try{
var lr=await post('/api/getSongLyric',{id:song.id});
if(token!==playToken)return;
var m=extractLyricMulti(lr);
state.lyric=m.main||'暂无歌词';
state.lyricTrans=m.trans||'';
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
state.lyricTrans='';state.lyricRoma='';
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

function nextSong(){
if(!state.playlist.length)return;
var n=state.current;
if(state.mode==='shuffle'){
if(state.playlist.length===1){n=0}
else{do{n=Math.floor(Math.random()*state.playlist.length)}while(n===state.current)}
}else{n=(state.current+1)%state.playlist.length;}
playIndex(n);
}
function prevSong(){
if(!state.playlist.length)return;
var n=state.current;
if(state.mode==='shuffle'){
if(state.playlist.length===1){n=0}
else{do{n=Math.floor(Math.random()*state.playlist.length)}while(n===state.current)}
}else{n=(state.current-1+state.playlist.length)%state.playlist.length;}
playIndex(n);
}

async function resumeWithRefresh(pos){
var song=state.playlist[state.current];
if(!song)return;
var myToken=++refreshToken;
refreshingUrl=true;
state.playing=true;
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
if(!state.playlist.length){openAdd();return}
if(state.current<0){playIndex(0);return}

if(refreshingUrl){
refreshToken++;
refreshingUrl=false;
state.playing=false;
try{audio.pause();}catch(e){}
render();
toast('已取消重新获取');
return;
}

if(state.playing&&!state.audioUrl){
playToken++;
state.playing=false;
state.lyricLoading=false;
stopAudio();
resetProgressUI();
render();
toast('已取消获取音源');
return;
}

if(state.playing){audio.pause();return;}

var song=state.playlist[state.current];
var pe=song&&preloadCache[song.id];
if(song&&!song.external&&pe&&pe.urlExpireAt){
var dur=audio.duration||0;
var cur=audio.currentTime||0;
var remaining=(isFinite(dur)&&dur>0)?(dur-cur):0;
if(remaining>0&&shouldRefreshUrlResume(pe,remaining)){
toast('链接已过期，正在重新获取');
await resumeWithRefresh(cur);
return;
}
}
audio.play().catch(function(){});
}

// ==================== 进度条 ====================
function updateSeekBg(pct){
$('seek').style.background='linear-gradient(to right, var(--primary) '+pct+'%, var(--outline-variant) '+pct+'%)';
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
if(!needsUrlRefreshForPosition(targetTime)){
try{audio.currentTime=targetTime;}catch(e){}
if(state.showLyric&&state.lyricHasTime)updateLyricScroll(true);
return;
}
try{audio.pause();}catch(e){}
toast('音源即将过期，正在重新获取...');
var myToken=++refreshToken;
refreshingUrl=true;
state.playing=true;
render();
var fresh=null;
try{fresh=await fetchPlayUrlFresh(song.id);}catch(e){fresh=null;}
if(myToken!==refreshToken){refreshingUrl=false;return;}
refreshingUrl=false;
if(!fresh||!fresh.url){
toast('重新获取音源失败');
render();
try{audio.currentTime=targetTime;audio.play().catch(function(){});}catch(e){}
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
try{audio.currentTime=targetTime;}catch(e){}
audio.play().catch(function(){});
if(state.showLyric&&state.lyricHasTime)setTimeout(function(){updateLyricScroll(true);},50);
}catch(e){
toast(e.message||'跳转失败');
}
}

if($('seek'))$('seek').addEventListener('input',function(){
isSeeking=true;
var pct=parseFloat(this.value)/10;
updateSeekBg(pct);
if(audio.duration&&isFinite(audio.duration)){
var t=(parseFloat(this.value)/1000)*audio.duration;
$('curTime').textContent=fmt(t);
try{audio.currentTime=t;}catch(e){}
}
});
function finishSeek(){
if(!isSeeking)return;
isSeeking=false;
if(audio.duration&&isFinite(audio.duration)){
var t=(parseFloat($('seek').value)/1000)*audio.duration;
seekWithUrlCheck(t);
}
}
if($('seek'))$('seek').addEventListener('change',finishSeek);
if($('seek'))$('seek').addEventListener('pointerup',finishSeek);
if($('seek'))$('seek').addEventListener('touchend',finishSeek);

function onTimeUpdate(){
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
audio.addEventListener('play',function(){
state.playing=true;
render();
updateMediaSessionPlaybackState();
updateMediaSessionMetadata();
});
audio.addEventListener('pause',function(){
state.playing=false;
render();
updateMediaSessionPlaybackState();
});
audio.addEventListener('ended',function(){
if(state.mode==='single'){
audio.currentTime=0;
audio.play().catch(function(){});
}else{nextSong();}
});

// ==================== 事件绑定 ====================
if($('playBtn'))$('playBtn').addEventListener('click',togglePlay);
if($('prevBtn'))$('prevBtn').addEventListener('click',prevSong);
if($('nextBtn'))$('nextBtn').addEventListener('click',nextSong);

if($('modeBtn'))$('modeBtn').addEventListener('click',function(ev){
blurControl(ev.currentTarget||this);
var order=['order','single','shuffle'];
var i=order.indexOf(state.mode);
state.mode=order[(i+1)%3];
toast(state.mode==='single'?'单曲循环':(state.mode==='shuffle'?'随机播放':'顺序播放'));
if(typeof saveSettingsLocal==='function')saveSettingsLocal();
if(typeof notifyDataChanged==='function')notifyDataChanged('settings');
render();
});

if($('coverBox'))$('coverBox').addEventListener('click',function(){
if(!state.playlist.length)return;
state.showLyric=true;
render();
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
if($('shareScrim'))$('shareScrim').addEventListener('click',function(e){if(e.target===this)this.classList.remove('show')});

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
var levels=['lossless','exhigh','standard'];
var tasks=levels.map(function(lv){
return tryGetLevelWithCache(id,lv,300).then(function(r){
return {key:lv,ok:!!(r&&r.url)};
});
});
var rs=await Promise.all(tasks);

var result={lossless:false,exhigh:false,standard:false,official:false};
for(var i=0;i<rs.length;i++){
if(rs[i].ok)result[rs[i].key]=true;
}

try{
var vipNeeded=await checkVipNeeded(id);
result.official=!vipNeeded;
}catch(e){
result.official=false;
}

return result;
}

async function runQualityDetection(song){
var token=++downloadDetectToken;
var listEl=$('qualityList');
var btn=$('downloadRetryBtn');
listEl.innerHTML='<div class="quality-loading"><div class="quality-spinner"></div><div>正在检测可用音质...</div></div>';
btn.disabled=true;
btn.classList.add('spinning');

var availability=await checkAllLevels(song.id);

if(token!==downloadDetectToken)return;
if(!$('downloadScrim').classList.contains('show'))return;
if(pendingDownloadSong!==song)return;

btn.disabled=false;
btn.classList.remove('spinning');

var currentIsThisSong=(state.current>=0&&state.playlist[state.current]===song);
var currentQuality=currentIsThisSong?state.quality:'';
if(currentQuality&&availability[currentQuality]!==undefined){
availability[currentQuality]=true;
}

renderDownloadQualityList(availability,song,currentQuality);
}

function openDownloadDialog(song){
try{blurControl(document.activeElement);}catch(e){}

pendingDownloadSong=song;
$('downloadSongName').textContent=(song.name||'未知歌曲')+' - '+(song.artist||'');
closeOtherScrims('downloadScrim');
showScrim('downloadScrim');
runQualityDetection(song);
}

function renderDownloadQualityList(availability,song,currentQuality){
var listEl=$('qualityList');
var anyAvailable=false;
for(var i=0;i<DOWNLOAD_LEVELS.length;i++){
if(availability[DOWNLOAD_LEVELS[i].key]){anyAvailable=true;break}
}
if(!anyAvailable){
listEl.innerHTML='<div class="quality-loading">没有可用音质</div>';
return;
}

var html='<div class="quality-list">';
for(var i=0;i<DOWNLOAD_LEVELS.length;i++){
var lv=DOWNLOAD_LEVELS[i];
var isCurrent=lv.key===currentQuality;
var avail=availability[lv.key]||isCurrent;
var cls='quality-item';
if(!avail)cls+=' disabled';
if(isCurrent)cls+=' current';
var dis=avail?'':' disabled';
html+='<button class="'+cls+'" data-level="'+lv.key+'"'+dis+'>';
html+='<span class="quality-label">'+lv.label+'</span>';
if(isCurrent){
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
hideScrim('downloadScrim');
doDownload(pendingDownloadSong,level);
});
}
}

async function doDownload(song,level){
if(!song)return;
toast('获取下载链接...');
var url='';
try{
url=await fetchPlayUrlLevel(song.id,level,300);
}catch(e){}
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
downloadDetectToken++;
this.classList.remove('show');
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
hideScrim('addScrim');
$('addInput').blur();
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
try{var b=ev.currentTarget||this;b.blur();if(document.activeElement)document.activeElement.blur();}catch(e){}
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
if($('listScrim'))$('listScrim').addEventListener('click',function(e){if(e.target===this)this.classList.remove('show')});

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
metaHtml+='<span class="'+cls+'">网易云</span>';
metaHtml+='<span class="meta-tag q">'+qlabel+'</span>';
}
$('foundMeta').innerHTML=metaHtml;
$('addHint').textContent=fromUrl?'来自分享链接，是否添加到列表并播放？':'是否将此歌曲加入播放列表？';
closeOtherScrims('addScrim');
showScrim('addScrim');
}

async function doResolve(){
var text=$('addInput').value.trim();
if(!text)return;
$('addGo').disabled=true;
$('addGo').innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
try{
var song=await resolveInput(text);
showSongConfirm(song,false);
}catch(e){
toast(e.message||'解析失败');
}
$('addGo').disabled=false;
$('addGo').innerHTML=ICON.arrow;
}
if($('addGo'))$('addGo').addEventListener('click',doResolve);
if($('addInput'))$('addInput').addEventListener('keydown',function(e){
if(e.key==='Enter'){e.preventDefault();doResolve()}
});
if($('addCancel'))$('addCancel').addEventListener('click',function(){
pendingSong=null;
$('addStage2').style.display='none';
$('addStage1').style.display='block';
$('addHint').textContent='是否将此歌曲加入播放列表？';
setTimeout(function(){$('addInput').focus()},100);
});
if($('addConfirm'))$('addConfirm').addEventListener('click',function(){
if(!pendingSong)return;
var toAdd=pendingSong;
var fromUrl=toAdd._fromUrl===true;
delete toAdd._fromUrl;

var dupIdx=findDuplicateIndex(toAdd,state.playlist);
if(dupIdx>=0){
pendingSong=null;
closeAdd();
$('addHint').textContent='是否将此歌曲加入播放列表？';
playIndex(dupIdx);
toast('歌曲已在列表中，已切换播放');
return;
}

var insertAt=0;
if(state.playlist.length===0){
insertAt=0;
state.playlist.push(toAdd);
state.current=0;
}else if(state.current<0){
// 有列表但未选中：插到末尾
state.playlist.push(toAdd);
insertAt=state.playlist.length-1;
}else{
insertAt=state.current+1;
state.playlist.splice(insertAt,0,toAdd);
}
savePlaylist();
toast('已加入播放列表');
pendingSong=null;
closeAdd();
$('addHint').textContent='是否将此歌曲加入播放列表？';
if(fromUrl||wasEmpty){
playIndex(0);
}else{
render();
}
});

// ==================== 清空列表 ====================
if($('sheetClear'))$('sheetClear').addEventListener('click',function(ev){
blurControl(ev.currentTarget||this);
if(!state.playlist.length){toast('播放列表已为空');return}
closeOtherScrims('clearScrim');
showScrim('clearScrim');
});
if($('clearCancel'))$('clearCancel').addEventListener('click',function(){hideScrim('clearScrim')});
if($('clearScrim'))$('clearScrim').addEventListener('click',function(e){if(e.target===this)this.classList.remove('show')});
if($('clearConfirm'))$('clearConfirm').addEventListener('click',function(){
state.playlist=[];
state.current=-1;
state.playing=false;
state.lyric='';state.lyricTrans='';state.lyricRoma='';
state.lyricLoading=false;
state.audioUrl='';state.quality='';
state.retrying=false;
state.editingOrder=false;
if($('sheetEdit')){
$('sheetEdit').innerHTML='<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>';
$('sheetEdit').classList.remove('active');
}
stopAudio();
resetProgressUI();
clearPlaylistCookie();
preloadCache={};
preloadTimers={};
state._lastMediaKey=null;
render();
if(typeof updateFavBtn==='function')updateFavBtn();
updateMediaSessionMetadata();
updateMediaSessionPlaybackState();
hideScrim('clearScrim');
hideScrim('listScrim');
toast('播放列表已清空');
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
if($('sheetExport'))$('sheetExport').addEventListener('click',async function(ev){
blurControl(ev.currentTarget||this);
if(!state.playlist.length){toast('播放列表为空');return}
hideScrim('listScrim');
if(exportGenerating)return;
exportGenerating=true;

$('exportKey').value='';
$('exportKey').placeholder='正在上传...';
$('exportCopy').disabled=true;
$('exportHint').textContent='正在将歌单上传到网络...';
closeOtherScrims('exportScrim');
showScrim('exportScrim');

var raw=exportListText();
var compressed=await gzipCompress(raw);
var toUpload=raw;
if(compressed&&('#GZIP:'+compressed).length<raw.length){
toUpload='#GZIP:'+compressed;
}

var key=genShareKey();
var ok=await cacheSetRaw(key,toUpload);

var verifyOk=false;
if(ok){
var verify=await cacheGetRaw(key);
if(verify&&verify===toUpload)verifyOk=true;
}

exportGenerating=false;

if(verifyOk){
$('exportKey').value=key;
$('exportKey').placeholder='';
$('exportCopy').disabled=false;
$('exportHint').textContent='已上传 '+state.playlist.length+' 首歌曲，可复制 15 位密钥分享';
}else{
$('exportKey').value='';
$('exportKey').placeholder='上传失败';
$('exportCopy').disabled=true;
$('exportHint').textContent='上传失败，请检查网络后重试';
}
});
if($('exportClose'))$('exportClose').addEventListener('click',function(){hideScrim('exportScrim')});
if($('exportScrim'))$('exportScrim').addEventListener('click',function(e){if(e.target===this)this.classList.remove('show')});
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
if($('importScrim'))$('importScrim').addEventListener('click',function(e){if(e.target===this)this.classList.remove('show')});
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

var added=applyImport(imported,mode);
var after=state.playlist.length;

if(mode==='replace'){
state.playing=false;
state.audioUrl='';state.quality='';
state.lyric='';state.lyricTrans='';state.lyricRoma='';
state.lyricLoading=false;
state.retrying=false;
state.editingOrder=false;
$('sheetEdit').innerHTML='<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>';
$('sheetEdit').classList.remove('active');
stopAudio();
resetProgressUI();
state._lastMediaKey=null;
updateMediaSessionMetadata();
updateMediaSessionPlaybackState();
}

savePlaylist();
render();
hideScrim('importScrim');
hideScrim('listScrim');

if(mode==='replace'){
toast('已覆盖为 '+after+' 首歌曲');
}else{
toast('新增 '+added+' 首，共 '+after+' 首');
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
$('sheetEdit').innerHTML='<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>';
$('sheetEdit').classList.remove('active');
stopAudio();
resetProgressUI();
clearPlaylistCookie();
state._lastMediaKey=null;
updateMediaSessionMetadata();
updateMediaSessionPlaybackState();
render();
return;
}else if(idx===state.current){
if(idx>=state.playlist.length)state.current=state.playlist.length-1;
savePlaylist();
playIndex(state.current);
}else{
if(idx<state.current)state.current--;
savePlaylist();
}
render();
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
var params=null;
try{params=new URLSearchParams(location.search)}catch(e){return}
if(!params)return;

var keyValue=params.get('key');
var addValue=params.get('add');
if(!keyValue&&!addValue)return;

try{history.replaceState(null,'',location.pathname)}catch(e){}

if(keyValue){
await handleKeyFromUrl(String(keyValue).trim());
return;
}

if(addValue){
toast('正在解析分享内容...');
try{
var song=await resolveInput(addValue);
showSongConfirm(song,true);
}catch(e){
toast('解析失败: '+(e.message||'未知错误'));
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
    if(el&&el.classList.contains('show'))return true;
  }
  return false;
}
function closeAllScrimsUI(){
  for(var i=0;i<ALL_SCRIMS.length;i++){
    var el=$(ALL_SCRIMS[i]);
    if(el)el.classList.remove('show');
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
      lastExitTapAt=0;
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
var box=$('favPlList');
if(!box)return;
box.innerHTML='';
var k=songKey(song);
(state.playlists||[]).forEach(function(pl){
var btn=document.createElement('button');
btn.className='fav-pl-item';
var on=(pl.songs||[]).some(function(s){return songKey(s)===k;});
if(on)btn.classList.add('on');
btn.textContent=(on?'★ ':'☆ ')+(pl.name||'未命名')+'（'+(pl.songs?pl.songs.length:0)+'）';
btn.addEventListener('click',function(){
if(on){removeSongFromPlaylist(pl.id,song);toast('已从歌单移除');}
else{addSongToPlaylist(pl.id,song,true);toast('已收藏到「'+pl.name+'」');}
closeAllScrimsUI();
});
box.appendChild(btn);
});
if(!(state.playlists||[]).length){
box.innerHTML='<p class="hint">暂无歌单，可新建后收藏</p>';
}
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

if($('plDetailExport'))$('plDetailExport').addEventListener('click',function(){
if(!viewingPlId)return;
var pl=getPlaylist(viewingPlId);
if(!pl)return;
$('plExportName').textContent=pl.name||'歌单';
window._exportingPl=pl;
showScrim('plExportScrim');
});
if($('plExportCancel'))$('plExportCancel').addEventListener('click',function(){hideScrim('plExportScrim');});
if($('plExportKeyBtn'))$('plExportKeyBtn').addEventListener('click',async function(){
var pl=window._exportingPl;
if(!pl)return;
try{
var text=typeof buildListText==='function'?buildListText(pl.songs||[]):JSON.stringify(pl.songs||[]);
// use same format as playlist export - list text lines
if(typeof songsToListText==='function')text=songsToListText(pl.songs||[]);
else if(typeof exportPlaylistText==='function')text=exportPlaylistText(pl.songs||[]);
else{
text=(pl.songs||[]).map(function(s){
if(s.external)return (s.url||'')+'\t'+(s.name||'')+'\t'+(s.artist||'');
return String(s.id||'')+'\t'+(s.name||'')+'\t'+(s.artist||'');
}).join('\n');
}
var key='pl'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
var r=await post('/api/cacheSet',{key:key,value:text});
if(r&&r.ok){
try{await navigator.clipboard.writeText(key);toast('密钥已复制：'+key);}
catch(e){toast('密钥：'+key);}
}else toast('导出密钥失败');
}catch(e){toast('导出失败');}
hideScrim('plExportScrim');
});
if($('plExportGzipBtn'))$('plExportGzipBtn').addEventListener('click',async function(){
var pl=window._exportingPl;
if(!pl)return;
try{
var text=(pl.songs||[]).map(function(s){
if(s.external)return (s.url||'')+'\t'+(s.name||'')+'\t'+(s.artist||'');
return String(s.id||'')+'\t'+(s.name||'')+'\t'+(s.artist||'');
}).join('\n');
var blob;
if(typeof gzipCompress==='function'){
var gz=await gzipCompress(text);
blob=new Blob([gz],{type:'application/octet-stream'});
}else blob=new Blob([text],{type:'text/plain'});
var a=document.createElement('a');
a.href=URL.createObjectURL(blob);
a.download=(pl.name||'playlist')+'.txt';
a.click();
toast('已开始下载');
}catch(e){toast('导出失败');}
hideScrim('plExportScrim');
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
toast('注册并登录成功');
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
toast('已退出登录');
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
try{state.playing=false;state.audioUrl='';state.quality='';state.showLyric=false;}catch(e){}
try{render();}catch(e){console.error('render',e);}
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
setTimeout(function(){try{handleUrlParams();}catch(e){}},300);

// 确保歌单/我的页按钮一定有事件（防前面脚本中断）

state._booted=true;
if('serviceWorker' in navigator){
window.addEventListener('load',function(){
navigator.serviceWorker.register(toAbsoluteApiUrl('/sw.js')).catch(function(){});
});
}
})();
`;
