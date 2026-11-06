export const CACHE_SCRIPT = String.raw`// ==================== textdb 缓存封装 ====================
async function cacheGetRaw(key){
try{
var r=await post('/api/cacheGet',{key:key});
if(r&&r.ok&&r.value)return r.value;
}catch(e){}
return '';
}

async function cacheSetRaw(key,value){
if(!key||!value)return false;
try{
var r=await post('/api/cacheSet',{key:key,value:value});
return !!(r&&r.ok);
}catch(e){}
return false;
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
try{
url=decodeURIComponent(encoded);
}catch(e){
url=encoded;
}
if(!url||!isHttpUrl(url))return null;
return {expireAt:exp,url:url};
}

async function getCachedAudioUrl(id,level,minRemainSec){
if(level==='external')return null;
var key=level+String(id);
var text=await cacheGetRaw(key);
var data=cacheDecodeValue(text);
if(!data)return null;
var remainSec=(data.expireAt-Date.now())/1000;
if(remainSec<minRemainSec)return null;
return data;
}

async function saveAudioUrlToCache(id,level,url,expi){
if(level==='external')return;
if(!url)return;
var expireAt=Date.now()+(expi||DEFAULT_EXPI)*1000;
var key=level+String(id);
var value=cacheEncodeValue(expireAt,url);
await cacheSetRaw(key,value);
}

async function getCachedCover(id){
var key='cover'+String(id);
var text=await cacheGetRaw(key);
var data=cacheDecodeValue(text);
if(!data)return '';
if(data.expireAt<Date.now())return '';
return data.url;
}

async function saveCoverToCache(id,picUrl){
if(!picUrl)return;
var key='cover'+String(id);
var expireAt=Date.now()+COVER_LYRIC_TTL_MS;
var value=cacheEncodeValue(expireAt,picUrl);
await cacheSetRaw(key,value);
}

async function getCachedLyric(id){
var key='lyric'+String(id);
var text=await cacheGetRaw(key);
if(!text)return null;
var idx=text.indexOf('|');
if(idx===-1)return null;
var exp=parseInt(text.substring(0,idx),10);
if(!isFinite(exp)||exp<Date.now())return null;
var jsonStr='';
try{
jsonStr=decodeURIComponent(text.substring(idx+1));
}catch(e){
return null;
}
try{
var obj=JSON.parse(jsonStr);
return {
main:String(obj.l||''),
trans:String(obj.t||''),
roma:String(obj.r||'')
};
}catch(e){
return null;
}
}

async function saveLyricToCache(id,main,trans,roma){
var key='lyric'+String(id);
var expireAt=Date.now()+COVER_LYRIC_TTL_MS;
var obj={l:main||'',t:trans||'',r:roma||''};
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
