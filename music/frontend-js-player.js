export const PLAYER_SCRIPT = String.raw`// ==================== 官方接口探测（第三方代理） ====================
async function probeOfficialLocal(id,minRemainSec){
id=String(id||'');
if(!id)return null;
var need=typeof minRemainSec==='number'?minRemainSec:60;
try{
var cached=await getCachedAudioUrl(id,'official',need);
if(cached&&cached.url)return {url:cached.url,expi:Math.max(1,Math.floor((cached.expireAt-Date.now())/1000)),fromCache:true};
}catch(e){}
try{
var r=await post('/api/officialResolve',{id:id});
if(r&&r.ok&&r.url&&isHttpUrl(r.url)){
var expi=r.expi||DEFAULT_EXPI;
try{await saveAudioUrlToCache(id,'official',r.url,expi);}catch(e){}
return {url:r.url,expi:expi,fromCache:false};
}
}catch(e){}
// 兜底：直接使用官方代理地址（可播放，但不缓存真实 CDN）
var fallback=OFFICIAL_PREFIX+encodeURIComponent(id);
return {url:fallback,expi:DEFAULT_EXPI,fromCache:false};
}

// ==================== 音频源控制 ====================
function stopAudio(){
try{state._ignorePause=true;}catch(e){}
try{audio.pause()}catch(e){}
setTimeout(function(){try{state._ignorePause=false;}catch(e){}},100);
if(hlsInstance){try{hlsInstance.destroy()}catch(e){}hlsInstance=null}
if(flvInstance){try{flvInstance.destroy()}catch(e){}flvInstance=null}
try{
// 不要在清空 src 后 load()：会触发 error，和后续设新地址产生竞态
audio.removeAttribute('src');
audio.removeAttribute('srcObject');
}catch(e){}
}

function resetProgressUI(){
try{$('seek').value='0';}catch(e){}
updateSeekBg(0);
$('curTime').textContent='0:00';
$('durTime').textContent='0:00';
}

// ==================== 封面缓存 ====================
var coverCache={};

function preloadCover(url){
if(!url)return;
var entry=coverCache[url];
if(entry&&(entry.state==='loading'||entry.state==='loaded'))return;
entry={state:'loading',img:null};
coverCache[url]=entry;
var img=new Image();
entry.img=img;
img.onload=function(){
entry.state='loaded';
var song=state.playlist[state.current];
if(song&&song.pic===url){
updateCoverDisplay();
scheduleMediaSessionUpdate();
}
};
img.onerror=function(){
entry.state='error';
var song=state.playlist[state.current];
if(song&&song.pic===url)updateCoverDisplay();
};
img.src=url;
}

function updateCoverDisplay(){
var song=state.playlist[state.current];
var imgEl=$('coverImg');
var fbEl=$('coverFallback');
var ldEl=$('coverLoading');
if(!song||!song.pic){
if(imgEl.getAttribute('src'))imgEl.removeAttribute('src');
imgEl.style.display='none';
ldEl.style.display='none';
if(song){
fbEl.style.display='flex';
}else{
fbEl.style.display='none';
}
return;
}
var pic=song.pic;
var entry=coverCache[pic];
if(!entry){
preloadCover(pic);
entry=coverCache[pic];
}
if(entry&&entry.state==='loaded'){
if(imgEl.getAttribute('src')!==pic)imgEl.src=pic;
imgEl.style.display='block';
ldEl.style.display='none';
fbEl.style.display='none';
}else if(entry&&entry.state==='error'){
if(imgEl.getAttribute('src'))imgEl.removeAttribute('src');
imgEl.style.display='none';
ldEl.style.display='none';
fbEl.style.display='flex';
}else{
if(imgEl.getAttribute('src'))imgEl.removeAttribute('src');
imgEl.style.display='none';
ldEl.style.display='flex';
fbEl.style.display='none';
}
}


// ==================== HLS / FLV 加载 ====================
function loadHlsJs(){
if(window.Hls)return Promise.resolve();
if(hlsLoading)return hlsLoading;
hlsLoading=new Promise(function(resolve,reject){
var s=document.createElement('script');
s.src=HLS_CDN;
s.onload=function(){resolve()};
s.onerror=function(){hlsLoading=null;reject(new Error('hls.js 加载失败'))};
document.head.appendChild(s);
});
return hlsLoading;
}

function loadFlvJs(){
if(window.flvjs)return Promise.resolve();
if(flvLoading)return flvLoading;
flvLoading=new Promise(function(resolve,reject){
var s=document.createElement('script');
s.src=FLV_CDN;
s.onload=function(){resolve()};
s.onerror=function(){flvLoading=null;reject(new Error('flv.js 加载失败'))};
document.head.appendChild(s);
});
return flvLoading;
}

// ==================== 带编码检测的媒体加载 ====================

function loadPlainMedia(url){
return new Promise(function(resolve,reject){
var settled=false;
var timer=null;
if(typeof upgradeMediaUrl==='function')url=upgradeMediaUrl(url);
else if(typeof upgradeNeteaseUrl==='function')url=upgradeNeteaseUrl(url);
if(!url||!/^https?:\/\//i.test(url)){
reject(new Error('无效音源地址'));
return;
}
function onLoaded(){
if(settled)return;
settled=true;
cleanup();
try{audio.currentTime=0;}catch(e){}
if(state&&state.playing){
var p=audio.play();
if(p&&p.catch)p.catch(function(){});
// 再补两次，防止被 pause 竞态打断
setTimeout(function(){
try{if(state.playing&&audio.paused){var p2=audio.play();if(p2&&p2.catch)p2.catch(function(){});}}catch(e){}
},80);
setTimeout(function(){
try{if(state.playing&&audio.paused){var p3=audio.play();if(p3&&p3.catch)p3.catch(function(){});}}catch(e){}
},300);
}else{
try{audio.pause();}catch(e){}
}
resolve();
}
function onError(){
if(settled)return;
settled=true;
var err=audio.error;
cleanup();
var msg='无法播放该音源';
if(err){
if(err.code===4)msg='音源无法加载（链接失效或被拦截）';
else if(err.code===3)msg='解码失败';
else if(err.code===2)msg='网络错误，无法加载';
else if(err.code===1)msg='播放被中止';
}
reject(new Error(msg));
}
function cleanup(){
if(timer)clearTimeout(timer);
try{audio.removeEventListener('loadedmetadata',onLoaded);}catch(e){}
try{audio.removeEventListener('canplay',onLoaded);}catch(e){}
try{audio.removeEventListener('error',onError);}catch(e){}
}
try{audio.pause();}catch(e){}
if(hlsInstance){try{hlsInstance.destroy()}catch(e){}hlsInstance=null}
if(flvInstance){try{flvInstance.destroy()}catch(e){}flvInstance=null}
try{audio.referrerPolicy='no-referrer';}catch(e){}
audio.addEventListener('loadedmetadata',onLoaded);
audio.addEventListener('canplay',onLoaded);
audio.addEventListener('error',onError);
timer=setTimeout(function(){
if(settled)return;
settled=true;
cleanup();
reject(new Error('加载超时'));
},20000);
try{
audio.src=url;
audio.load();
}catch(e){
cleanup();
reject(new Error('设置音源失败'));
}
});
}

function loadHlsWithCodecCheck(url){
if(window.Hls)return loadHlsWithCodecCheckInner(url);
return loadHlsJs().then(function(){return loadHlsWithCodecCheckInner(url)});
}

function loadHlsWithCodecCheckInner(url){
if(!window.Hls||!Hls.isSupported()){
return Promise.reject(new Error('浏览器不支持 HLS 播放'));
}
return new Promise(function(resolve,reject){
var h=new Hls({enableWorker:true,lowLatencyMode:false});
var settled=false;
var timer=null;

function fail(msg){
if(settled)return;
settled=true;
if(timer)clearTimeout(timer);
try{h.destroy()}catch(e){}
reject(new Error(msg));
}

h.on(Hls.Events.MANIFEST_PARSED,function(event,data){
if(settled)return;
var levels=(data&&data.levels)||[];
var unsupported='';
for(var i=0;i<levels.length;i++){
var lv=levels[i];
var vCodec=normalizeCodec(lv.videoCodec);
var aCodec=normalizeCodec(lv.audioCodec);
if(vCodec&&!isCodecSupported('video/mp4',vCodec,true)){
unsupported=vCodec;
break;
}
if(aCodec&&!isCodecSupported('audio/mp4',aCodec,true)){
unsupported=aCodec;
break;
}
}
if(unsupported){
fail('浏览器不支持该视频编码：'+unsupported);
return;
}
settled=true;
if(timer)clearTimeout(timer);
if(hlsInstance){try{hlsInstance.destroy()}catch(e){}}
hlsInstance=h;
h.attachMedia(audio);
audio.play().catch(function(){});
resolve();
});

h.on(Hls.Events.ERROR,function(e,data){
if(settled)return;
if(data&&data.fatal){
fail('HLS 加载失败：'+(data.details||'未知错误'));
}
});

timer=setTimeout(function(){
if(!settled)fail('HLS 加载超时');
},15000);

try{
h.loadSource(url);
}catch(e){
fail('HLS 加载失败：'+e.message);
}
});
}

function loadFlvWithCheck(url){
if(window.flvjs)return loadFlvWithCheckInner(url);
return loadFlvJs().then(function(){return loadFlvWithCheckInner(url)});
}

function loadFlvWithCheckInner(url){
if(!window.flvjs||!flvjs.isSupported()){
return Promise.reject(new Error('浏览器不支持 FLV 播放'));
}
return new Promise(function(resolve,reject){
var settled=false;
var timer=null;

function fail(msg){
if(settled)return;
settled=true;
if(timer)clearTimeout(timer);
try{if(flvInstance)flvInstance.destroy()}catch(e){}
flvInstance=null;
reject(new Error(msg));
}

if(flvInstance){try{flvInstance.destroy()}catch(e){}}
flvInstance=flvjs.createPlayer({
type:'flv',
url:url,
isLive:false,
hasAudio:true,
hasVideo:false,
stashInitialSize:256
},{
enableWorker:true,
enableStashBuffer:false
});

flvInstance.on(flvjs.Events.ERROR,function(errType,errDetail){
if(settled)return;
var msg='FLV 播放失败';
if(errDetail)msg+='：'+errDetail;
else if(errType)msg+='：'+errType;
msg+='（可能是不支持的编码）';
fail(msg);
});

timer=setTimeout(function(){
if(!settled)fail('FLV 加载超时');
},15000);

try{
flvInstance.attachMediaElement(audio);
flvInstance.load();
flvInstance.play().catch(function(){});
setTimeout(function(){
if(settled)return;
settled=true;
if(timer)clearTimeout(timer);
resolve();
},800);
}catch(e){
fail('FLV 初始化失败：'+e.message);
}
});
}

// ==================== 设置音频源（带编码检测） ====================
async function setAudioSource(url,format){
if(typeof upgradeMediaUrl==='function')url=upgradeMediaUrl(url);
if(url&&typeof url==='string'){
if(url.indexOf('//')===0)url='https:'+url;
if(/^http:\/\//i.test(url))url=url.replace(/^http:\/\//i,'https://');
}
if(typeof upgradeNeteaseUrl==='function')url=upgradeNeteaseUrl(url);
// m4s：B站 DASH 音轨（fMP4），按普通媒体加载
if((format&&String(format).toLowerCase()==='m4s')||(url&&/\.m4s(?:\?|$)/i.test(url))){
return loadPlainMedia(url);
}

if(isFlvFormat(url,format)){
if(audio.canPlayType('video/x-flv')){
return loadPlainMedia(url);
}
return loadFlvWithCheck(url);
}

if(isHlsFormat(url,format)){
if(audio.canPlayType('application/vnd.apple.mpegurl')){
return loadPlainMedia(url);
}
return loadHlsWithCodecCheck(url);
}

return loadPlainMedia(url);
}

`;
