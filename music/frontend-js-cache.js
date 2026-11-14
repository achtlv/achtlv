export const CACHE_SCRIPT = String.raw`// ==================== 本地媒体缓存（播放/封面/歌词） ====================
function mediaCachePurgeExpired(store){
if(!store||!store.items)return store;
var now=Date.now();
var changed=false;
var order=Array.isArray(store.order)?store.order:[];
var nextOrder=[];
for(var i=0;i<order.length;i++){
var k=order[i];
var it=store.items[k];
if(!it||!it.expireAt||it.expireAt<=now){
delete store.items[k];
changed=true;
}else{
nextOrder.push(k);
}
}
// 清掉 order 里没有、但 items 里过期的
Object.keys(store.items).forEach(function(k){
var it=store.items[k];
if(!it||!it.expireAt||it.expireAt<=now){
delete store.items[k];
changed=true;
}
});
store.order=nextOrder.filter(function(k){return !!store.items[k];});
return store;
}
function mediaCacheLoad(){
try{
var raw=localStorage.getItem(MEDIA_CACHE_KEY);
if(!raw)return {v:1,order:[],items:{}};
var o=JSON.parse(raw);
if(!o||typeof o!=='object')return {v:1,order:[],items:{}};
if(!Array.isArray(o.order))o.order=[];
if(!o.items||typeof o.items!=='object')o.items={};
// 每次读取都清过期，避免死缓存
o=mediaCachePurgeExpired(o);
return o;
}catch(e){return {v:1,order:[],items:{}};}
}
function mediaCacheSave(store){
try{
store=mediaCachePurgeExpired(store||{v:1,order:[],items:{}});
// LRU 上限
while(store.order&&store.order.length>MEDIA_CACHE_MAX){
var drop=store.order.shift();
if(drop)delete store.items[drop];
}
localStorage.setItem(MEDIA_CACHE_KEY,JSON.stringify(store));
}catch(e){
// quota: drop half oldest
try{
while(store.order.length>Math.floor(MEDIA_CACHE_MAX/2)){
var k=store.order.shift();
if(k)delete store.items[k];
}
localStorage.setItem(MEDIA_CACHE_KEY,JSON.stringify(store));
}catch(e2){}
}
}
function mediaCacheTouch(store,key){
var idx=store.order.indexOf(key);
if(idx!==-1)store.order.splice(idx,1);
store.order.push(key);
while(store.order.length>MEDIA_CACHE_MAX){
var old=store.order.shift();
if(old)delete store.items[old];
}
}
function mediaCacheGetEntry(key){
var store=mediaCacheLoad();
var it=store.items[key];
if(!it)return null;
if(!it.expireAt||it.expireAt<=Date.now()){
delete store.items[key];
var idx=store.order.indexOf(key);
if(idx!==-1)store.order.splice(idx,1);
mediaCacheSave(store);
return null;
}
mediaCacheTouch(store,key);
mediaCacheSave(store);
return it;
}
function mediaCacheSetEntry(key,urlOrPayload,expireAt,kind){
if(!key||!expireAt)return;
var store=mediaCacheLoad();
store.items[key]={expireAt:expireAt,kind:kind||'audio',payload:urlOrPayload,url:typeof urlOrPayload==='string'?urlOrPayload:''};
mediaCacheTouch(store,key);
mediaCacheSave(store);
}

// ==================== textdb 缓存封装 ====================
async function cacheGetRaw(key){
if(!key)return '';
var k=String(key).replace(/[^a-zA-Z0-9_-]/g,'');
for(var attempt=0;attempt<3;attempt++){
try{
var r=await post('/api/cacheGet',{key:k});
if(r&&r.ok&&r.value!=null&&String(r.value).length>0)return String(r.value);
}catch(e){}
await new Promise(function(res){setTimeout(res,350+attempt*400);});
}
return '';
}

async function cacheSetRaw(key,value){
if(!key||value==null||value==='')return false;
var k=String(key).replace(/[^a-zA-Z0-9_-]/g,'');
var val=String(value);
try{
var r=await post('/api/cacheSet',{key:k,value:val});
if(!(r&&r.ok))return false;
for(var attempt=0;attempt<4;attempt++){
var got=await cacheGetRaw(k);
if(!got){await new Promise(function(res){setTimeout(res,400+attempt*350);});continue;}
var a=got.replace(/ /g,'+');
var b=val.replace(/ /g,'+');
if(a===b||got===val)return true;
if(got.length===val.length&&got.substring(0,16)===val.substring(0,16))return true;
await new Promise(function(res){setTimeout(res,400+attempt*350);});
}
return false;
}catch(e){return false;}
}

function cacheEncodeValue(expireAt,url){
return String(expireAt)+'|'+encodeURIComponent(url);
}

function cacheDecodeValue(text){
if(!text)return null;
var idx=text.indexOf('|');
if(idx===-1)return null;
var exp=parseInt(text.substring(0,idx),10);
if(!isFinite(exp)||exp<=0)return null;
var encoded=text.substring(idx+1);
var url='';
try{url=decodeURIComponent(encoded);}catch(e){url=encoded;}
if(!url||!isHttpUrl(url))return null;
return {expireAt:exp,url:url};
}


async function invalidateAudioCache(id,level){
try{
var store=mediaCacheLoad();
var keys=[];
if(level){keys=[String(level)+String(id)];}
else{
keys=['exhigh'+String(id),'standard'+String(id),'lossless'+String(id),'official'+String(id)];
}
for(var i=0;i<keys.length;i++){
var k=keys[i];
delete store.items[k];
var idx=store.order.indexOf(k);
if(idx!==-1)store.order.splice(idx,1);
try{await cacheSetRaw(k,'');}catch(e){}
}
mediaCacheSave(store);
}catch(e){}
}


function audioCacheKeys(id,level){
var lv=String(level||'').toLowerCase();
var ids=String(id||'');
var keys=[lv+ids];
if(lv==='lossless'||lv==='flac'||lv==='hires'){keys.push('lossless'+ids,'flac'+ids);}
else if(lv==='exhigh'||lv==='320k'||lv==='higher'){keys.push('exhigh'+ids,'320k'+ids);}
else if(lv==='standard'||lv==='128k'){keys.push('standard'+ids,'128k'+ids);}
// unique
var out=[],seen={};
for(var i=0;i<keys.length;i++){if(!seen[keys[i]]){seen[keys[i]]=1;out.push(keys[i]);}}
return out;
}
function mediaCacheGetAudio(id,level){
var keys=audioCacheKeys(id,level);
for(var i=0;i<keys.length;i++){
var it=mediaCacheGetEntry(keys[i]);
if(it&&(it.url||(it.payload&&typeof it.payload==='string'))){
return {expireAt:it.expireAt,url:it.url||it.payload,key:keys[i]};
}
}
return null;
}

async function getLocalAudioUrlOnly(id,level,minRemainSec){
if(level==='external')return null;
var local=mediaCacheGetAudio(id,level);
if(local&&local.url){
var remainL=(local.expireAt-Date.now())/1000;
if(remainL>=(minRemainSec||0))return {expireAt:local.expireAt,url:local.url,fromLocal:true};
}
return null;
}
async function getTextdbAudioUrlOnly(id,level,minRemainSec){
if(level==='external')return null;
var keys=typeof audioCacheKeys==='function'?audioCacheKeys(id,level):[level+String(id)];
for(var i=0;i<keys.length;i++){
try{
var text=await cacheGetRaw(keys[i]);
var data=cacheDecodeValue(text);
if(!data||!data.url)continue;
var remainSec=(data.expireAt-Date.now())/1000;
if(remainSec<(minRemainSec||0))continue;
// 回填本地所有别名
try{
if(typeof saveAudioUrlToCache==='function'){
await saveAudioUrlToCache(id,level,data.url,Math.max(60,Math.floor(remainSec)));
}else{
mediaCacheSetEntry(keys[i],data.url,data.expireAt,'audio');
}
}catch(e){}
return {expireAt:data.expireAt,url:data.url};
}catch(e){}
}
return null;
}

async function getCachedAudioUrl(id,level,minRemainSec){
if(level==='external')return null;
var key=level+String(id);
// 1) 本地缓存
var local=mediaCacheGetEntry(key);
if(local&&local.url){
var remainL=(local.expireAt-Date.now())/1000;
if(remainL>=minRemainSec)return {expireAt:local.expireAt,url:local.url,fromLocal:true};
}
// 2) textdb
var text=await cacheGetRaw(key);
var data=cacheDecodeValue(text);
if(!data)return null;
var remainSec=(data.expireAt-Date.now())/1000;
if(remainSec<minRemainSec)return null;
// 回填本地
try{mediaCacheSetEntry(key,data.url,data.expireAt,'audio');}catch(e){}
return data;
}

async function saveAudioUrlToCache(id,level,url,expi){
if(level==='external')return;
if(!url)return;
url=(typeof ensureHttps==='function'?ensureHttps(url):String(url).replace(/^http:\/\//i,'https://'));
var ttl=typeof expi==='number'&&expi>0?expi:(typeof DEFAULT_EXPI==='number'?DEFAULT_EXPI:1200);
if(typeof DEFAULT_EXPI==='number'&&ttl>DEFAULT_EXPI)ttl=DEFAULT_EXPI;
if(ttl<60)ttl=60;
var expireAt=Date.now()+ttl*1000;
var value=cacheEncodeValue(expireAt,url);
var keys=typeof audioCacheKeys==='function'?audioCacheKeys(id,level):[String(level)+String(id)];
// 先写本地（同步），保证立刻可命中
for(var i=0;i<keys.length;i++){
try{mediaCacheSetEntry(keys[i],url,expireAt,'audio');}catch(e){}
}
// 再写 textdb（异步，不阻塞）
try{cacheSetRaw(keys[0],value).catch(function(){});}catch(e){}
// 主 key 再写一次 canonical
try{
var canon=String(level).toLowerCase();
if(canon==='flac'||canon==='hires')canon='lossless';
if(canon==='320k'||canon==='higher')canon='exhigh';
if(canon==='128k')canon='standard';
var ck=canon+String(id);
if(keys.indexOf(ck)===-1){try{mediaCacheSetEntry(ck,url,expireAt,'audio');}catch(e){}}
}catch(e){}
}

function getLocalCoverOnly(id){
var key='cover'+String(id);
var local=mediaCacheGetEntry(key);
if(local&&local.url)return (typeof ensureHttps==='function'?ensureHttps(local.url):local.url);
return '';
}
async function getCachedCover(id){
var loc=getLocalCoverOnly(id);
if(loc)return loc;
var key='cover'+String(id);
var text=await cacheGetRaw(key);
var data=cacheDecodeValue(text);
if(!data)return '';
if(data.expireAt<Date.now())return '';
var u=(typeof ensureHttps==='function'?ensureHttps(data.url):data.url);
try{mediaCacheSetEntry(key,u,data.expireAt,'cover');}catch(e){}
return u;
}

async function saveCoverToCache(id,picUrl){
if(!picUrl)return;
var key='cover'+String(id);
var expireAt=Date.now()+COVER_LYRIC_TTL_MS;
mediaCacheSetEntry(key,picUrl,expireAt,'cover');
var value=cacheEncodeValue(expireAt,picUrl);
await cacheSetRaw(key,value);
}

function getLocalLyricOnly(id){
var key='lyric'+String(id);
var local=mediaCacheGetEntry(key);
if(local&&local.payload&&typeof local.payload==='object'){
return {
main:String(local.payload.l||''),
trans:String(local.payload.t||''),
roma:String(local.payload.r||'')
};
}
return null;
}
async function getCachedLyric(id){
var loc=getLocalLyricOnly(id);
if(loc&&(loc.main||loc.trans||loc.roma))return loc;
var key='lyric'+String(id);
var text=await cacheGetRaw(key);
if(!text)return null;
var idx=text.indexOf('|');
if(idx===-1)return null;
var exp=parseInt(text.substring(0,idx),10);
if(!isFinite(exp)||exp<Date.now())return null;
var jsonStr='';
try{jsonStr=decodeURIComponent(text.substring(idx+1));}catch(e){return null;}
try{
var obj=JSON.parse(jsonStr);
try{mediaCacheSetEntry(key,obj,exp,'lyric');}catch(e){}
return {main:String(obj.l||''),trans:String(obj.t||''),roma:String(obj.r||'')};
}catch(e){return null;}
}

async function saveLyricToCache(id,main,trans,roma){
// 禁止把空歌词/占位文案写入缓存，否则会一直命中「暂无歌词」
var m=String(main||'').trim();
if(!m||m==='暂无歌词'||m==='外部音源，暂无歌词'||m==='视频音源，暂无歌词')return;
var key='lyric'+String(id);
var expireAt=Date.now()+COVER_LYRIC_TTL_MS;
var obj={l:main||'',t:trans||'',r:roma||''};
mediaCacheSetEntry(key,obj,expireAt,'lyric');
var jsonStr=JSON.stringify(obj);
var value=String(expireAt)+'|'+encodeURIComponent(jsonStr);
await cacheSetRaw(key,value);
}

// ==================== 封面解析（内嵌 ID3 APIC） ====================
async function extractCoverFromUrl(url){
if(!url||!window.jsmediatags)return '';
var low=String(url).toLowerCase();
if(low.indexOf('.m3u8')!==-1||low.indexOf('.flv')!==-1||
   low.indexOf('.mp4')!==-1||low.indexOf('.ts')!==-1)return '';
var blob=null;
try{
var res=await fetch(url,{headers:{Range:'bytes=0-1572864'}});
if(!res.ok)return '';
blob=await res.blob();
}catch(e){return '';}
return new Promise(function(resolve){
try{
jsmediatags.read(blob,{
onSuccess:function(tag){
var pic=tag&&tag.tags&&tag.tags.picture;
if(!pic||!pic.data)return resolve('');
try{
var bytes=pic.data;
var bin='';
var CHUNK=0x8000;
for(var i=0;i<bytes.length;i+=CHUNK){
var sub=bytes.subarray(i,i+CHUNK);
bin+=String.fromCharCode.apply(null,sub);
}
resolve('data:'+(pic.format||'image/jpeg')+';base64,'+btoa(bin));
}catch(e){resolve('');}
},
onError:function(){resolve('');}
});
}catch(e){resolve('');}
});
}

`;
