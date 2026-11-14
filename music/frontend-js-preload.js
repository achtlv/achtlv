export const PRELOAD_SCRIPT = String.raw`// ==================== URL 过期检查 ====================
function shouldRefreshUrl(entry,song){
if(!entry||!entry.urlExpireAt)return false;
var now=Date.now();
var durSec=0;
if(song&&song.duration&&song.duration>0)durSec=song.duration;
if(durSec>0){
var deadline=entry.urlExpireAt-(durSec+URL_SAFETY_BUFFER)*1000;
return now>=deadline;
}
return now>=entry.urlExpireAt-15*60*1000;
}

function shouldRefreshUrlResume(entry,remainingSec){
if(!entry||!entry.urlExpireAt)return false;
if(!remainingSec||remainingSec<=0)return false;
var now=Date.now();
var deadline=entry.urlExpireAt-(remainingSec+URL_SAFETY_BUFFER)*1000;
return now>=deadline;
}

// ==================== 预加载系统 ====================
var preloadCache={};
var preloadTimers={};

function getPreloadEntry(id){
if(!id)return null;
if(!preloadCache[id]){
preloadCache[id]={
pic:'',lyric:'',lyricTrans:'',lyricRoma:'',
url:'',quality:'',urlExpireAt:0,
picDone:false,lyricDone:false,urlDone:false
};
}
return preloadCache[id];
}

async function preloadSongPic(song){
if(!song||!song.id)return;
var entry=getPreloadEntry(song.id);
if(!entry||entry.picDone)return;

if(song.pic){
song.pic=(typeof ensureHttps==='function'?ensureHttps(song.pic):song.pic);
entry.pic=song.pic;
entry.picDone=true;
preloadCover(song.pic);
return;
}

try{
var cachedPic=await getCachedCover(song.id);
if(cachedPic){
entry.pic=cachedPic;
entry.picDone=true;
song.pic=cachedPic;
preloadCover(cachedPic);
var cur0=state.playlist[state.current];
if(cur0===song)render();
return;
}
}catch(e){}

try{
var info=await post('/api/getSongInfo',{id:song.id});
var m=extractInfo(info);
if(m.pic){
entry.pic=m.pic;
entry.picDone=true;
song.pic=m.pic;
if(!song.duration&&m.duration>0)song.duration=m.duration;
preloadCover(m.pic);
await saveCoverToCache(song.id,m.pic);
var cur=state.playlist[state.current];
if(cur===song)render();
return;
}
}catch(e){}

// 仅用 ID 取封面（getSongInfo），禁止按歌名搜索以免封面错乱
schedulePreloadRetry(song,'pic');
}

async function preloadSongLyric(song){
if(!song||!song.id)return;
var entry=getPreloadEntry(song.id);
if(!entry)return;
if(entry.lyricDone&&entry.lyric&&String(entry.lyric).trim()&&String(entry.lyric).indexOf('\ufffd')===-1){
// 已有可用歌词，若当前曲目还在 loading，立刻落地
var curX=state.playlist[state.current];
if(curX&&String(curX.id)===String(song.id)&&state.lyricLoading){
state.lyric=entry.lyric;
state.lyricTrans=entry.lyricTrans||'';
state.lyricRoma=entry.lyricRoma||'';
state.lyricLoading=false;
state._lastLyricKey=null;
try{render();}catch(e){}
}
return;
}
if(song.external){
entry.lyricDone=true;
entry.lyric=entry.lyric||'外部音源，暂无歌词';
if(state.playlist[state.current]&&String(state.playlist[state.current].id)===String(song.id)){
state.lyric=entry.lyric;state.lyricLoading=false;render();
}
return;
}
function applyToState(main,trans,roma){
var cur=state.playlist[state.current];
if(!cur||String(cur.id)!==String(song.id))return;
state.lyric=(main&&String(main).trim())?main:'暂无歌词';
state.lyricTrans=trans||'';
if(state.lyricTrans&&String(state.lyricTrans).trim()&&!state._transUserSet)state.transEnabled=true;
state.lyricRoma=roma||'';
state.lyricLoading=false;
state._lastLyricKey=null;
try{render();}catch(e){}
}
try{
var cached=await getCachedLyric(song.id);
if(cached&&cached.main&&String(cached.main).trim()&&String(cached.main).indexOf('\ufffd')===-1){
entry.lyric=cached.main||'';
entry.lyricTrans=cached.trans||'';
entry.lyricRoma=cached.roma||'';
entry.lyricDone=true;
applyToState(entry.lyric,entry.lyricTrans,entry.lyricRoma);
return;
}
}catch(e){}
try{
var lr=await post('/api/getSongLyric',{id:song.id});
var m=(typeof extractLyricMulti==='function')?extractLyricMulti(lr):{main:'',trans:'',roma:''};
var main=m.main||'';
// 拒绝乱码缓存
if(main&&String(main).indexOf('\ufffd')!==-1)main='';
entry.lyric=main;
entry.lyricTrans=m.trans||'';
entry.lyricRoma=m.roma||'';
entry.lyricDone=true; // 无论有无歌词都标记完成，避免一直「获取中」
try{
if(main&&typeof saveLyricToCache==='function')await saveLyricToCache(song.id,main,m.trans||'',m.roma||'');
}catch(e){}
applyToState(main,m.trans||'',m.roma||'');
}catch(e){
entry.lyricDone=true;
entry.lyric=entry.lyric||'暂无歌词';
applyToState(entry.lyric||'暂无歌词','','');
}
}



async function preloadSongUrl(song){
if(!song||!song.id)return;
var entry=getPreloadEntry(song.id);
if(!entry)return;
if(song.external){
entry.url=song.url;entry.quality='external';entry.urlExpireAt=0;entry.urlDone=true;return;
}
if(entry.urlDone&&entry.quality==='exhigh')return;
var dur=song.duration&&song.duration>0?song.duration:360;
var needRemain=dur+(typeof URL_SAFETY_BUFFER==='number'?URL_SAFETY_BUFFER:30);
try{
// 并发链路在 tryGetLevelWithCache / localGetSongUrl 内部；结果会写入本地+textdb
var r=null;
if(typeof fetchPlayUrl==='function')r=await fetchPlayUrl(song.id,dur);
else if(typeof tryGetLevelWithCache==='function')r=await tryGetLevelWithCache(song.id,'exhigh',needRemain);
if(r&&r.url){
entry.url=(typeof ensureHttps==='function'?ensureHttps(r.url):r.url);
entry.quality=r.level||'exhigh';
entry.urlExpireAt=Date.now()+((r.expi||DEFAULT_EXPI||1200)*1000);
entry.urlDone=true;
// 再异步把 standard 也预热进缓存（不阻塞）
if(typeof tryGetLevelWithCache==='function'){
tryGetLevelWithCache(song.id,'standard',needRemain).catch(function(){});
tryGetLevelWithCache(song.id,'lossless',needRemain).catch(function(){});
}
}
}catch(e){}
}

function schedulePreloadRetry(song,type){
if(!song||!song.id)return;
if(!preloadTimers[song.id])preloadTimers[song.id]={pic:null,lyric:null,url:null};
var t=preloadTimers[song.id];
if(t[type])return;
t[type]=setTimeout(function(){
t[type]=null;
if(state.playlist.indexOf(song)===-1)return;
if(type==='pic')preloadSongPic(song);
else if(type==='lyric')preloadSongLyric(song);
else preloadSongUrl(song);
},PRELOAD_RETRY);
}

function triggerPreloadNeighbors(){
var len=state.playlist.length;
var curIdx=state.current;
if(curIdx<0||len<1)return;
var curSong=state.playlist[curIdx];
if(curSong){
try{preloadSongPic(curSong);}catch(e){}
try{preloadSongLyric(curSong);}catch(e){}
}
var scheduledIdx=curIdx;
setTimeout(function(){
if(state.current!==scheduledIdx)return;
var curSong2=state.playlist[curIdx];
if(!curSong2)return;
var targets=[];
var seen={};
function addIdx(idx){
if(idx==null||idx<0||idx>=len)return;
if(idx===curIdx)return;
if(seen[idx])return;
seen[idx]=true;
var s=state.playlist[idx];
if(s)targets.push(s);
}
if(state.mode==='shuffle'&&state.shuffleOrder&&state.shuffleOrder.length){
var sp=(typeof state.shufflePos==='number'?state.shufflePos:0);
if(sp<0)sp=0;
var sn=state.shuffleOrder.length;
var nextId=state.shuffleOrder[(sp+1)%sn];
var prevId=state.shuffleOrder[(sp-1+sn)%sn];
function idToIdx(id){for(var ii=0;ii<len;ii++){if(state.playlist[ii]&&String(state.playlist[ii].id)===String(id))return ii;}return -1;}
addIdx(idToIdx(nextId));
addIdx(idToIdx(prevId));
}
// 原列表下一首、上一首
addIdx((curIdx+1)%len);
addIdx((curIdx-1+len)%len);
for(var i=0;i<targets.length;i++){
try{preloadSongPic(targets[i]);}catch(e){}
try{preloadSongLyric(targets[i]);}catch(e){}
try{preloadSongUrl(targets[i]);}catch(e){}
}
},80);
}


`;
