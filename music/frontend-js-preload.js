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
function isRealLyric(t){
if(!t||!String(t).trim())return false;
var s=String(t).trim();
if(s==='暂无歌词'||s==='外部音源，暂无歌词'||s==='视频音源，暂无歌词')return false;
if(s.indexOf('\ufffd')!==-1)return false;
return true;
}
function applyToState(main,trans,roma){
var cur=state.playlist[state.current];
if(!cur||String(cur.id)!==String(song.id))return;
// 禁止用空结果覆盖已有有效歌词（并发失败会把歌词闪成「暂无歌词」）
if(!isRealLyric(main)){
if(isRealLyric(state.lyric))return;
state.lyric='暂无歌词';
state.lyricTrans='';
state.lyricRoma='';
}else{
state.lyric=main;
if(trans)state.lyricTrans=trans;
if(roma)state.lyricRoma=roma;
}
if(state.lyricTrans&&String(state.lyricTrans).trim()&&!state._transUserSet)state.transEnabled=true;
state.lyricLoading=false;
state._lastLyricKey=null;
try{render();}catch(e){}
}
// 已有主歌词：先上屏；若缺翻译/罗马音仍继续请求以便合并
if(entry.lyricDone&&isRealLyric(entry.lyric)){
var curX=state.playlist[state.current];
if(curX&&String(curX.id)===String(song.id)){
if(state.lyricLoading||!isRealLyric(state.lyric))applyToState(entry.lyric,entry.lyricTrans||'',entry.lyricRoma||'');
}
// 翻译和罗马音都有了才完全跳过
if(entry.lyricTrans&&String(entry.lyricTrans).trim()&&entry.lyricRoma&&String(entry.lyricRoma).trim())return;
}
if(song.external){
entry.lyricDone=true;
entry.lyric='外部音源，暂无歌词';
applyToState(entry.lyric,'','');
return;
}
// 本地缓存
try{
var cached=await getCachedLyric(song.id);
if(cached&&isRealLyric(cached.main)){
entry.lyric=cached.main||'';
if(cached.trans)entry.lyricTrans=cached.trans;
if(cached.roma)entry.lyricRoma=cached.roma;
entry.lyricDone=true;
applyToState(entry.lyric,entry.lyricTrans||'',entry.lyricRoma||'');
// 已有翻译+罗马音才跳过网络
if(entry.lyricTrans&&entry.lyricRoma)return;
}
}catch(e){}
// 网络
try{
var lr=await post('/api/getSongLyric',{id:song.id});
var m=(typeof extractLyricMulti==='function')?extractLyricMulti(lr):{main:'',trans:'',roma:''};
var main=m.main||'';
var trans=m.trans||'';
var roma=m.roma||'';
if(isRealLyric(main)||isRealLyric(entry.lyric)){
// 合并：网络有更好的主词/翻译/罗马音则升级
if(isRealLyric(main))entry.lyric=main;
if(trans&&String(trans).trim())entry.lyricTrans=trans;
if(roma&&String(roma).trim())entry.lyricRoma=roma;
entry.lyricDone=!!isRealLyric(entry.lyric);
try{if(typeof saveLyricToCache==='function')await saveLyricToCache(song.id,entry.lyric,entry.lyricTrans||'',entry.lyricRoma||'');}catch(e){}
applyToState(entry.lyric,entry.lyricTrans||'',entry.lyricRoma||'');
}else{
// 失败不永久占住：允许下次再拉
entry.lyricDone=false;
entry.lyric='';
applyToState('暂无歌词','','');
}
}catch(e){
entry.lyricDone=false;
applyToState('暂无歌词','','');
}
}




async function preloadSongUrl(song){
if(!song||!song.id)return;
var entry=getPreloadEntry(song.id);
if(!entry)return;
if(song.external){
entry.url=song.url;entry.quality='external';entry.urlExpireAt=0;entry.urlDone=true;return;
}
// 已有合法 https 极高链且未过期
if(entry.urlDone&&String(entry.url).indexOf('http')===0&&entry.quality==='exhigh'&&entry.urlExpireAt&&entry.urlExpireAt>Date.now()+5000){
entry.urlDone=true;
return;
}
// 防并发重复
if(entry._urlLoading)return;
entry._urlLoading=true;
var dur=song.duration&&song.duration>0?song.duration:360;
var needRemain=dur+(typeof URL_SAFETY_BUFFER==='number'?URL_SAFETY_BUFFER:30);
try{
// 本地缓存（返回 {url,expireAt}）
try{
var loc=null;
if(typeof getLocalAudioUrlOnly==='function')loc=getLocalAudioUrlOnly(song.id,'exhigh',5);
if(loc&&loc.url){
entry.url=(typeof ensureHttps==='function'?ensureHttps(loc.url):loc.url);
entry.quality='exhigh';
entry.urlExpireAt=loc.expireAt||(Date.now()+20*60*1000);
entry.urlDone=true;
return;
}
if(typeof getCachedAudioUrl==='function'){
var cu=await getCachedAudioUrl(song.id,'exhigh',5);
if(cu){
entry.url=(typeof ensureHttps==='function'?ensureHttps(cu):cu);
entry.quality='exhigh';
entry.urlExpireAt=Date.now()+20*60*1000;
entry.urlDone=true;
return;
}
}
}catch(e){}
// 网络：优先 tryGetLevelWithCache（本地+API+TextDB），否则 fetchPlayUrl
var r=null;
try{
if(typeof tryGetLevelWithCache==='function')r=await tryGetLevelWithCache(song.id,'exhigh',needRemain);
}catch(e){}
if((!r||!r.url)&&typeof fetchPlayUrl==='function'){
try{r=await fetchPlayUrl(song.id,dur);}catch(e){}
}
if(r&&r.url){
var uu=(typeof ensureHttps==='function'?ensureHttps(r.url):r.url);
if(typeof isTrialAudioUrl==='function'&&isTrialAudioUrl(uu)){
entry.urlDone=false;
return;
}
entry.url=uu;
entry.quality=r.level||r.quality||'exhigh';
entry.urlExpireAt=Date.now()+((r.expi||DEFAULT_EXPI||1200)*1000);
entry.urlDone=true;
}
}catch(e){
entry.urlDone=false;
}finally{
entry._urlLoading=false;
}
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

function songPreloadNeeds(song){
if(!song||!song.id)return {pic:false,lyric:false,url:false};
if(song.external)return {pic:false,lyric:false,url:false};
var entry=getPreloadEntry(song.id);
function isReal(t){
if(!t||!String(t).trim())return false;
var s=String(t).trim();
if(s==='暂无歌词'||s.indexOf('外部音源')===0||s.indexOf('视频音源')===0)return false;
if(s.indexOf('\ufffd')!==-1)return false;
return s.length>4;
}
var needPic=!(song.pic||(entry&&entry.pic));
var needLyric=!(entry&&entry.lyricDone&&isReal(entry.lyric));
var needUrl=!(entry&&entry.urlDone&&entry.url&&String(entry.url).indexOf('http')===0&&entry.quality==='exhigh');
if(entry&&entry.url&&entry.urlExpireAt&&entry.urlExpireAt<Date.now()+5000)needUrl=true;
return {pic:needPic,lyric:needLyric,url:needUrl};
}
function collectNeighborSongs(){
var len=state.playlist.length;
var curIdx=state.current;
var out=[];
var seen={};
function addIdx(idx){
if(idx==null||idx<0||idx>=len)return;
if(seen[idx])return;
seen[idx]=true;
var s=state.playlist[idx];
if(s)out.push(s);
}
if(curIdx>=0)addIdx(curIdx);
if(state.mode==='shuffle'&&state.shuffleOrder&&state.shuffleOrder.length){
var sp=(typeof state.shufflePos==='number'?state.shufflePos:0);
if(sp<0)sp=0;
var sn=state.shuffleOrder.length;
function idToIdx(id){for(var ii=0;ii<len;ii++){if(state.playlist[ii]&&String(state.playlist[ii].id)===String(id))return ii;}return -1;}
addIdx(idToIdx(state.shuffleOrder[(sp+1)%sn]));
addIdx(idToIdx(state.shuffleOrder[(sp-1+sn)%sn]));
}
if(len>0&&curIdx>=0){
addIdx((curIdx+1)%len);
addIdx((curIdx-1+len)%len);
}
return out;
}
var _preloadPollTimer=null;
var _preloadPollForIdx=-1;
var _preloadTriggerTimer=null;
function triggerPreloadNeighbors(){
// 防抖：短时间多次切歌/forceDone 只触发一次
if(_preloadTriggerTimer)clearTimeout(_preloadTriggerTimer);
_preloadTriggerTimer=setTimeout(function(){
_preloadTriggerTimer=null;
var len=state.playlist.length;
var curIdx=state.current;
if(curIdx<0||len<1)return;
_preloadPollForIdx=curIdx;
if(_preloadPollTimer){try{clearTimeout(_preloadPollTimer);}catch(e){}_preloadPollTimer=null;}
function tick(){
if(state.current!==_preloadPollForIdx)return;
var targets=collectNeighborSongs();
var still=false;
for(var i=0;i<targets.length;i++){
var song=targets[i];
var need=songPreloadNeeds(song);
// 当前曲优先 url；邻居可后做
if(need.pic){still=true;try{preloadSongPic(song);}catch(e){}}
if(need.lyric){still=true;try{preloadSongLyric(song);}catch(e){}}
if(need.url){still=true;try{preloadSongUrl(song);}catch(e){}}
}
if(still){
_preloadPollTimer=setTimeout(tick,4000);
}
}
tick();
},120);
}



`;
