export const UTILS_SCRIPT = String.raw`// ==================== 基础工具 ====================
function isAllDigits(s){
if(!s)return false;
for(var i=0;i<s.length;i++){
var c=s.charCodeAt(i);
if(c<48||c>57)return false;
}
return true;
}
function isSongId(s){
if(!s)return false;
var str=String(s);
return str.length>=5&&isAllDigits(str);
}
function isKgId(s){
if(!s)return false;
var str=String(s);
if(str.indexOf('kg')===0&&str.length>=34)return true;
return /^[a-fA-F0-9]{32}$/.test(str);
}
function normalizeKgId(s){
var str=String(s||'');
if(str.indexOf('kg')===0)return str;
if(/^[a-fA-F0-9]{32}$/.test(str))return 'kg'+str.toLowerCase();
return str;
}
function isHttpUrl(u){
if(!u)return false;
var s=String(u).toLowerCase().trim();
if(s.indexOf('//')===0)return true; // 协议相对，后续会补 https
return s.indexOf('http://')===0||s.indexOf('https://')===0;
}
function isNeteaseUrl(u){
if(!u)return false;
var s=String(u).toLowerCase();
for(var i=0;i<NETEASE_HOSTS.length;i++){
if(s.indexOf(NETEASE_HOSTS[i])!==-1)return true;
}
return false;
}

function genShareKey(){
var chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
var key='';
var t=Date.now();
var r1=Math.floor(Math.random()*16777216);
var r2=Math.floor(Math.random()*16777216);
var s=t;
for(var i=0;i<8;i++){
key+=chars.charAt(s%64);
s=Math.floor(s/64);
}
var s2=r1*16777216+r2;
for(var j=0;j<7;j++){
key+=chars.charAt(s2%64);
s2=Math.floor(s2/64);
}
var shift=r1%15;
if(shift>0){
key=key.substring(shift)+key.substring(0,shift);
}
return key;
}

function detectImportType(val){
var s=String(val||'').trim();
if(!s)return 'empty';
if(s.indexOf('#GZIP')===0&&s.length>15)return 'gzip';
// 密钥：无换行、无 |、较短纯字母数字（兼容 15 位旧密钥与 pl 开头新密钥）
if(s.indexOf('|')===-1&&s.indexOf('\n')===-1&&s.indexOf(' ')===-1&&s.length>=8&&s.length<=40&&/^[a-zA-Z0-9_-]+$/.test(s))return 'key';
return 'plain';
}

function extractAllUrlsFromText(text){
var urls=[];
var seen={};
if(!text)return urls;
var t=String(text);
var i=0;
while(i<t.length){
var httpIdx=t.indexOf('http://',i);
var httpsIdx=t.indexOf('https://',i);
var start=-1;
if(httpIdx===-1&&httpsIdx===-1)break;
if(httpIdx===-1)start=httpsIdx;
else if(httpsIdx===-1)start=httpIdx;
else start=Math.min(httpIdx,httpsIdx);

var s=t.substring(start);
var end=s.length;
for(var k=0;k<s.length;k++){
var c=s.charCodeAt(k);
if(c===32||c===9||c===10||c===13||c===34||c===39||c===60||c===62){end=k;break}
}
var url=s.substring(0,end);
while(url.length>0){
var last=url.charCodeAt(url.length-1);
if(last===41||last===93||last===125||last===33){url=url.substring(0,url.length-1);}
else break;
}
if(url&&isHttpUrl(url)&&!seen[url]){
seen[url]=true;
urls.push(url);
}
i=start+end;
if(end===0)i++;
}
return urls;
}

function getFormatFromUrl(u){
if(!u)return '';
var s=String(u).toLowerCase();
var qi=s.indexOf('?');if(qi!==-1)s=s.substring(0,qi);
var hi=s.indexOf('#');if(hi!==-1)s=s.substring(0,hi);
var all=AUDIO_FORMATS.concat(VIDEO_FORMATS);
for(var i=0;i<all.length;i++){
var ext=all[i];
var needLen=ext.length+1;
if(s.length>=needLen){
var tail=s.substring(s.length-needLen);
if(tail==='.'+ext)return ext;
}
}
return '';
}
function isHlsFormat(url,format){
if(format==='m3u8')return true;
if(!url)return false;
return String(url).toLowerCase().indexOf('.m3u8')!==-1;
}
function isFlvFormat(url,format){
if(format==='flv')return true;
if(!url)return false;
return String(url).toLowerCase().indexOf('.flv')!==-1;
}
function isVideoFormat(fmt){
if(!fmt)return false;
var f=String(fmt).toLowerCase();
for(var i=0;i<VIDEO_FORMATS.length;i++){
if(VIDEO_FORMATS[i]===f)return true;
}
return false;
}
function safeFileName(s){
if(!s)return 'song';
var bad=BS+'/:*?"<>|';
var out='';
for(var i=0;i<s.length;i++){
var c=s.charAt(i);
if(bad.indexOf(c)!==-1)out+='_';
else out+=c;
}
return out;
}

function getApiOrigin(){
try{
if(typeof location!=='undefined'&&location.origin&&/^https?:/i.test(location.origin)&&location.protocol!=='file:'){
return location.origin;
}
}catch(e){}
return 'https://music.achtlv.kdns.fr';
}
function toAbsoluteApiUrl(path){
if(!path)return getApiOrigin();
var s=String(path);
if(/^https?:\/\//i.test(s))return s;
if(s.charAt(0)!=='/')s='/'+s;
return getApiOrigin()+s;
}
// ==================== 浏览器直连（尽量不走 Worker） ====================
function upgradeNeteaseUrl(url){
if(!url||typeof url!=='string')return url;
return url.replace(/^http:\/\/(([a-z0-9.-]+)\.music\.126\.net)\//i,'https://$1/');
}
function upgradeMediaUrl(url){
if(!url||typeof url!=='string')return url;
var u=String(url).trim();
// 协议相对 //host/path
if(u.indexOf('//')===0)u='https:'+u;
// 裸域名媒体（极少见）
if(/^([a-z0-9.-]+\.(?:music\.126\.net|netease\.com|kugou\.com|kt\.com))\//i.test(u))u='https://'+u;
if(/^http:\/\//i.test(u))u=u.replace(/^http:\/\//i,'https://');
return u;
}
function ensureHttps(u){
if(!u||typeof u!=='string')return u;
return upgradeMediaUrl(u);
}
function ensureHttpsInText(text){
// 把文本中的 http:// 媒体链升为 https://（歌词内嵌图等）
if(!text||typeof text!=='string')return text;
return text.replace(/http:\/\//gi,'https://');
}
// 并发竞速：第一个成功结果即返回（其余忽略）
function raceFirstOk(taskFns){
return new Promise(function(resolve,reject){
var list=taskFns||[];
var pending=list.length;
var settled=false;
if(!pending){reject(new Error('empty'));return;}
list.forEach(function(fn){
Promise.resolve().then(function(){return fn();}).then(function(r){
if(settled)return;
if(r){settled=true;resolve(r);return;}
pending--;
if(pending<=0)reject(new Error('all failed'));
}).catch(function(){
if(settled)return;
pending--;
if(pending<=0)reject(new Error('all failed'));
});
});
});
}
function qualitiesForLevel(level){
var lv=String(level||'').toLowerCase();
if(lv==='lossless'||lv==='flac'||lv==='hires')return ['flac'];
if(lv==='exhigh'||lv==='320k'||lv==='higher')return ['320k'];
if(lv==='standard'||lv==='128k')return ['128k'];
return ['320k'];
}
function isCorsBrokenHost(url){
return /zddyr\.top|wwwweb\.top|lxmusicapi\.onrender\.com|gdstudio\.xyz|vkeys\.cn|music-api\.|onrender\.com/i.test(String(url||''));
}
function localFetchJson(url,options,timeoutMs){
options=options||{};
timeoutMs=timeoutMs||12000;
var u=String(url||'');
// 已知无 CORS 的域名：直接走 Worker 代理，避免浏览器预检失败刷屏
if(isCorsBrokenHost(u)&&u.indexOf('/api/proxyFetch')===-1){
return fetch(toAbsoluteApiUrl('/api/proxyFetch'),{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({url:u,method:options.method||'GET',headers:options.headers||{},body:options.body,timeoutMs:timeoutMs})
}).then(function(r){
return r.json().then(function(j){
return {ok:!!(j&&j.ok),status:(j&&j.status)||r.status,data:j&&j.data,text:j&&j.text};
}).catch(function(){return {ok:false,status:0,data:null};});
}).catch(function(){return {ok:false,status:0,data:null};});
}
var ctrl=typeof AbortController!=='undefined'?new AbortController():null;
var timer=null;
var opts={method:options.method||'GET',headers:options.headers||{}};
if(ctrl)opts.signal=ctrl.signal;
if(options.body!==undefined)opts.body=options.body;
return new Promise(function(resolve){
if(ctrl)timer=setTimeout(function(){try{ctrl.abort();}catch(e){}},timeoutMs);
fetch(u,opts).then(function(r){
return r.text().then(function(t){
var data=null;
try{data=JSON.parse(t);}catch(e){}
resolve({ok:r.ok,status:r.status,data:data,text:t});
});
}).catch(function(e){
resolve({ok:false,status:0,data:null,error:String(e&&e.message||e),corsFail:true});
}).then(function(v){if(timer)clearTimeout(timer);return v;});
}).then(function(res){
var needProxy=res&&(res.corsFail||res.status===0||(!res.ok&&!res.data&&res.status!==404));
if(needProxy&&isCorsBrokenHost(u)&&u.indexOf('/api/proxyFetch')===-1){
return fetch(toAbsoluteApiUrl('/api/proxyFetch'),{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({url:u,method:options.method||'GET',headers:options.headers||{},body:options.body,timeoutMs:timeoutMs})
}).then(function(r){return r.json().then(function(j){
return {ok:!!(j&&j.ok),status:(j&&j.status)||r.status,data:j&&j.data,text:j&&j.text};
}).catch(function(){return res;});}).catch(function(){return res;});
}
return res;
});
}



async function maybeCacheSideStandard(id,url,expi){
if(!id||!url)return;
var ttl=typeof expi==='number'&&expi>0?expi:(DEFAULT_EXPI||1200);
if(ttl>(DEFAULT_EXPI||1200))ttl=DEFAULT_EXPI||1200;
var expireAt=Date.now()+ttl*1000;
try{
if(typeof getLocalAudioUrlOnly==='function'){
var local=await getLocalAudioUrlOnly(String(id),'standard',0);
if(local&&local.expireAt&&local.expireAt>=expireAt)return;
}
}catch(e){}
try{
if(typeof saveAudioUrlToCache==='function'){
var u=url;
if(typeof upgradeMediaUrl==='function')u=upgradeMediaUrl(u);
else if(typeof upgradeNeteaseUrl==='function')u=upgradeNeteaseUrl(u);
await saveAudioUrlToCache(String(id),'standard',u,ttl);
}
}catch(e){}
}

async function localGetSongUrl(id,level){
var songId=String(id||'').trim();
if(!songId)return {code:400,msg:'无效歌曲 ID'};
if(/^kg[a-fA-F0-9]{32}$/i.test(songId)||(songId.indexOf('kg')===0&&songId.length>10)){
return localGetKgSongUrl(songId,level);
}
if(!/^\d+$/.test(songId))return {code:400,msg:'无效歌曲 ID'};
var qualities=qualitiesForLevel(level);
var backends=[
{name:'GD',run:async function(q){
var br=q==='flac'?'740':(q==='320k'?'320':'128');
var url='https://music-api.gdstudio.xyz/api.php?types=url&source=netease&id='+encodeURIComponent(songId)+'&br='+br;
var r=await localFetchJson(url,{method:'GET'});
var u=(r.data&&r.data.url)||'';
var gotBr=(r.data&&r.data.br)||0;
var gq=q;
if(gotBr&&gotBr>0&&gotBr<=160)gq='128k';
else if(gotBr&&gotBr<=400)gq='320k';
if(u)return {url:ensureHttps(u),quality:gq,expi:0};
throw new Error('GD无结果');
}},
{name:'星海',run:async function(q){
var url='https://yy.zddyr.top/lx/api/?source=wy&songmid='+encodeURIComponent(songId)+'&quality='+encodeURIComponent(q);
var r=await localFetchJson(url,{method:'GET'});
var u=(r.data&&(r.data.url||(r.data.data&&r.data.data.url)))||'';
if(u)return {url:ensureHttps(u),quality:(r.data&&r.data.quality)||q,expi:(r.data&&r.data.expi)||0};
throw new Error((r.data&&(r.data.msg||r.data.message))||'星海无结果');
}},
{name:'ikun',run:async function(q){
var r=await localFetchJson('https://c.wwwweb.top/music/url',{
method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({source:'wy',musicId:songId,quality:q})
});
if(r.data&&Number(r.data.code)===200&&r.data.url)return {url:ensureHttps(r.data.url),quality:r.data.quality||q,expi:0};
throw new Error((r.data&&r.data.message)||'ikun无结果');
}},
{name:'Huibq',run:async function(q){
if(q==='flac')q='320k';
var url='https://lxmusicapi.onrender.com/url/wy/'+encodeURIComponent(songId)+'/'+encodeURIComponent(q);
var r=await localFetchJson(url,{method:'GET',headers:{'X-Request-Key':'share-v3','User-Agent':'lx-music-desktop/2.10.0'}});
if(r.data&&Number(r.data.code)===0&&r.data.url){
var rq=(r.data.extra&&r.data.extra.quality&&r.data.extra.quality.result)||q;
return {url:ensureHttps(r.data.url),quality:rq,expi:0};
}
throw new Error((r.data&&r.data.msg)||'Huibq无结果');
}},
{name:'oiapi',run:async function(q){
var r=await localFetchJson('https://oiapi.net/api/Music_163?id='+encodeURIComponent(songId),{method:'GET'});
var u='';
if(r.data&&r.data.data&&r.data.data[0])u=r.data.data[0].url||'';
if(u)return {url:ensureHttps(u),quality:q,expi:0};
throw new Error('oiapi无结果');
}}
];
// 并发：textdb 缓存 + 各解析接口，先到先得
for(var qi=0;qi<qualities.length;qi++){
var q=qualities[qi];
var tasks=[];
// textdb 缓存（带过期）
tasks.push(async function(){
try{
if(typeof getTextdbAudioUrlOnly==='function'){
var db=await getTextdbAudioUrlOnly(songId,level,30);
if(db&&db.url)return {url:ensureHttps(db.url),quality:q,expi:Math.max(1,Math.floor((db.expireAt-Date.now())/1000)),fromCache:true};
}
// 兼容直接读
if(typeof cacheGetRaw==='function'){
var key=level+String(songId);
var text=await cacheGetRaw(key);
if(text&&typeof cacheDecodeValue==='function'){
var data=cacheDecodeValue(text);
if(data&&data.url&&data.expireAt>Date.now()+30000){
return {url:ensureHttps(data.url),quality:q,expi:Math.max(1,Math.floor((data.expireAt-Date.now())/1000)),fromCache:true};
}
}
}
}catch(e){}
return null;
});
backends.forEach(function(b){
tasks.push(async function(){
try{
var r=await b.run(q);
if(r&&r.url){
r.url=ensureHttps(r.url);
// 拿到即上传 textdb
try{if(typeof saveAudioUrlToCache==='function')await saveAudioUrlToCache(songId,level,r.url,r.expi||0);}catch(e){}
return r;
}
}catch(e){}
return null;
});
});
try{
var hit=await raceFirstOk(tasks);
if(hit&&hit.url){
var finalUrl=ensureHttps(hit.url);
try{if(typeof saveAudioUrlToCache==='function')await saveAudioUrlToCache(songId,level,finalUrl,hit.expi||0);}catch(e){}
return {code:200,data:{url:finalUrl,expi:hit.expi||0,respQuality:hit.quality||q}};
}
}catch(e){}
}
return {code:404,msg:'无法获取播放链接'};
}
async function localGetKgSongUrl(id,level){
var raw=String(id||'');
var hash=raw.indexOf('kg')===0?raw.substring(2):raw;
hash=String(hash).toLowerCase().replace(/[^a-f0-9]/g,'');
if(hash.length!==32)return {code:400,msg:'无效酷狗 hash'};
var songObj=null;
try{if(typeof state!=='undefined'&&state.playlist){for(var si=0;si<state.playlist.length;si++){var s=state.playlist[si];if(!s)continue;if(String(s.id).toLowerCase()===('kg'+hash)){songObj=s;break;}if(s.hash&&String(s.hash).toLowerCase()===hash){songObj=s;break;}}}}catch(e){}
var hq=songObj&&songObj.hqHash?String(songObj.hqHash).toLowerCase().replace(/[^a-f0-9]/g,''):'';
var sq=songObj&&songObj.sqHash?String(songObj.sqHash).toLowerCase().replace(/[^a-f0-9]/g,''):'';
var qualities=qualitiesForLevel(level);var errors=[];
for(var qi=0;qi<qualities.length;qi++){
var q=qualities[qi];var useHash=hash;
if(q==='flac'&&sq.length===32)useHash=sq;else if(q==='320k'&&hq.length===32)useHash=hq;
var tryHashes=[useHash];if(useHash!==hash)tryHashes.push(hash);
for(var hi=0;hi<tryHashes.length;hi++){
var hTry=tryHashes[hi];
try{
var url='https://yy.zddyr.top/lx/api/?source=kg&quality='+encodeURIComponent(q)+'&songmid='+encodeURIComponent(hTry)+'&mainHash='+encodeURIComponent(hash)+'&hash='+encodeURIComponent(hTry);
var r=await localFetchJson(url,{method:'GET'});var u=(r.data&&r.data.url)||'';
if(u&&/^https?:\/\//i.test(u)){
var ekey=(r.data&&r.data.ekey)||'';if(ekey&&String(ekey).trim()){errors.push('星海kg/'+q+':加密');continue;}
var outL=(q==='flac')?'lossless':(q==='320k'?'exhigh':'standard');
var gotQ=(r.data&&r.data.quality)||'';if(gotQ==='flac')outL='lossless';else if(gotQ==='320k')outL='exhigh';else if(gotQ==='128k')outL='standard';
return {code:200,data:{url:ensureHttps(u),expi:DEFAULT_EXPI||1200,level:outL,br:outL==='lossless'?999000:(outL==='exhigh'?320000:128000),quality:outL}};
}
errors.push('星海kg/'+q+':'+(r.data&&(r.data.msg||r.data.message)||'无结果'));
}catch(e){errors.push('星海kg/'+q+':'+(e.message||e));}
}
}
return {code:404,msg:'酷狗暂无可用音源',debug:errors.slice(0,6)};
}

async function localSearchKg(word){
if(!word)return {code:400,msg:'缺少搜索关键词'};
function pickFromLists(lists){
if(!lists||!lists[0])return null;
var it=lists[0];
var hash=String(it.FileHash||it.fileHash||it.hash||'').toLowerCase().replace(/[^a-f0-9]/g,'');
if(hash.length!==32)return null;
var pic='';
if(it.Image)pic=String(it.Image).replace('{size}','400');
if(pic&&/stdmusic\/\d+\//.test(pic))pic=pic.replace(/stdmusic\/\d+\//,'stdmusic/400/');
if(pic&&/\/150\//.test(pic))pic=pic.replace(/\/150\//,'/400/');
else if(it.TransParam&&it.TransParam.union_cover)pic=String(it.TransParam.union_cover).replace('{size}','400');
else if(it.trans_param&&it.trans_param.union_cover)pic=String(it.trans_param.union_cover).replace('{size}','400');
return {
code:200,
id:'kg'+hash,
name:it.SongName||it.songname||it.filename||word,
artist:it.SingerName||it.singername||'未知歌手',
pic:pic,
duration:it.Duration||it.duration||0,
source:'kg',
hash:hash,
hqHash:String(it.HQFileHash||'').toLowerCase(),
sqHash:String(it.SQFileHash||'').toLowerCase()
};
}
// 优先 Worker 代理（避免浏览器 CORS）
try{
var url=toAbsoluteApiUrl('/api/searchKg');
var res=await fetch(url,{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({word:String(word)})
});
var data=await res.json();
// Worker 返回 {code:200,data:{songs:[{id,name,...}]}} 或扁平 {code:200,id,...}
if(data&&Number(data.code)===200){
if(data.id)return data;
var songs=(data.data&&data.data.songs)||data.songs||[];
if(songs&&songs[0]&&songs[0].id){
var s0=songs[0];
var id0=String(s0.id);
if(id0.indexOf('kg')!==0&&/^[a-fA-F0-9]{32}$/.test(id0))id0='kg'+id0.toLowerCase();
return {
code:200,
id:id0,
name:s0.name||word,
artist:s0.artist||'未知歌手',
pic:s0.pic||'',
duration:s0.duration||0,
source:'kg',
hash:(s0.hash||String(id0).replace(/^kg/i,'')).toLowerCase(),
hqHash:s0.hqHash||'',
sqHash:s0.sqHash||''
};
}
}
}catch(e){}
// 直连兜底
try{
var r=await localFetchJson('https://songsearch.kugou.com/song_search_v2?keyword='+encodeURIComponent(word)+'&page=1&pagesize=5&userid=-1&clientver=&platform=WebFilter',{
method:'GET',
headers:{'User-Agent':'Mozilla/5.0'}
});
var lists=(r.data&&r.data.data&&r.data.data.lists)||[];
var got=pickFromLists(lists);
if(got)return got;
}catch(e){}
return {code:404,msg:'未找到酷狗歌曲'};
}
async function localSearch(word){
if(!word)return {code:400,msg:'缺少搜索关键词'};
var r=null;
try{
r=await localFetchJson('https://api.vkeys.cn/v2/music/netease?word='+encodeURIComponent(word),{method:'GET'});
}catch(e){return {code:500,msg:'搜索请求失败'};}
var data=(r&&r.data!==undefined)?r.data:r;
var d=(data&&data.data!==undefined)?data.data:data;
var item=null;
if(Array.isArray(d))item=d[0];
else if(d&&Array.isArray(d.list))item=d.list[0];
else if(d&&Array.isArray(d.songs))item=d.songs[0];
else if(d&&(d.id||d.songId||d.songid))item=d;
else if(d&&d.data&&(d.data.id||d.data.songId))item=d.data;
else if(Array.isArray(data))item=data[0];
if(!item)return {code:404,msg:'未找到歌曲'};
var id=item.id||item.songId||item.song_id;
var name=item.name||item.song||item.title||item.songName||word;
var artist=item.singer||item.artist||item.artists||item.ar||'';
if(Array.isArray(artist))artist=artist.map(function(a){return a&&a.name?a.name:a}).filter(Boolean).join(' / ');
else if(artist&&typeof artist==='object')artist=artist.name||'';
var pic=item.cover||item.pic||item.picUrl||item.picture||item.coverUrl||(item.al&&item.al.picUrl)||(item.album&&item.album.picUrl)||'';
return {code:200,id:String(id),name:name,artist:String(artist),pic:pic};
}
var _songInfoMem={};
async function localGetSongInfo(id){
var songId=String(id||'').trim();
if(!songId||!/^\d+$/.test(songId))return {code:400,msg:'无效歌曲 ID'};
if(_songInfoMem[songId])return _songInfoMem[songId];
// 1) 仅本地封面
try{
if(typeof getLocalCoverOnly==='function'){
var lp=getLocalCoverOnly(songId);
if(lp){
var outL={code:200,data:{songs:[{id:Number(songId)||songId,name:'',ar:[{name:''}],al:{picUrl:ensureHttps(lp)}}]}};
_songInfoMem[songId]=outL;
return outL;
}
}
}catch(e){}
// 2) textdb + API 并发
var tasks=[];
tasks.push(async function(){
try{
if(typeof getCachedCover==='function'){
var cp=await getCachedCover(songId);
if(cp)return {code:200,data:{songs:[{id:Number(songId)||songId,name:'',ar:[{name:''}],al:{picUrl:ensureHttps(cp)}}]}};
}
}catch(e){}
return null;
});
tasks.push(async function(){
try{
var r=await localFetchJson('https://api.paugram.com/netease/?id='+encodeURIComponent(songId),{method:'GET'},10000);
var d=r.data;
if(d&&(d.title||d.name||d.cover||d.pic)){
var pic=ensureHttps(d.cover||d.pic||d.picUrl||'');
var name=d.title||d.name||'';
var artist=d.artist||d.singer||'';
if(pic&&typeof saveCoverToCache==='function'){try{await saveCoverToCache(songId,pic);}catch(e){}}
return {code:200,data:{songs:[{id:Number(songId)||songId,name:name,ar:[{name:artist}],al:{picUrl:pic}}]}};
}
}catch(e){}
return null;
});
tasks.push(async function(){
try{
var r=await localFetchJson('https://music-api.gdstudio.xyz/api.php?types=song&source=netease&id='+encodeURIComponent(songId),{method:'GET'});
var d=r.data;
var item=(d&&d.songs&&d.songs[0])||d;
if(item&&(item.name||item.pic||item.picUrl)){
var pic=ensureHttps((item.al&&item.al.picUrl)||item.picUrl||item.pic||'');
if(pic&&typeof saveCoverToCache==='function'){try{await saveCoverToCache(songId,pic);}catch(e){}}
return {code:200,data:{songs:[{id:Number(songId)||songId,name:item.name||'',ar:item.ar||[{name:item.artist||''}],al:{picUrl:pic}}]}};
}
}catch(e){}
return null;
});
try{
var hit=await raceFirstOk(tasks);
if(hit){_songInfoMem[songId]=hit;return hit;}
}catch(e){}
return {code:404,msg:'无信息'};
}
async function localGetSongLyric(id){
var songId=String(id||'').trim();
if(!songId)return {code:400,msg:'无效歌曲 ID'};
// ---------- 酷狗：必须走同源 Worker 代理（浏览器直连 m.kugou.com 会被 CORS 拦截，这是歌词丢失的根因） ----------
if(/^kg/i.test(songId)||/^[a-fA-F0-9]{32}$/.test(songId)){
var hash=songId.indexOf('kg')===0?songId.substring(2):songId;
hash=String(hash).toLowerCase().replace(/[^a-f0-9]/g,'');
if(hash.length!==32)return {code:400,msg:'无效酷狗 hash'};
// 本地缓存（非空才用）
try{
if(typeof getLocalLyricOnly==='function'){
var locK=getLocalLyricOnly(songId);
if(locK&&locK.main&&String(locK.main).trim()&&String(locK.main).trim()!=='暂无歌词'){
var bad=String(locK.main).indexOf('�')!==-1;
if(!bad){
return {code:200,data:{
lrc:{lyric:ensureHttpsInText(locK.main||'')},
tlyric:{lyric:ensureHttpsInText(locK.trans||'')},
romalrc:{lyric:ensureHttpsInText(locK.roma||'')}
}};
}
}
}
}catch(e){}
try{
if(typeof getCachedLyric==='function'){
var cK=await getCachedLyric(songId);
if(cK&&cK.main&&String(cK.main).trim()&&String(cK.main).trim()!=='暂无歌词'){
return {code:200,data:{
lrc:{lyric:ensureHttpsInText(cK.main||'')},
tlyric:{lyric:ensureHttpsInText(cK.trans||'')},
romalrc:{lyric:ensureHttpsInText(cK.roma||'')}
}};
}
}
}catch(e){}
// Worker 代理
try{
var rk=await localFetchJson(toAbsoluteApiUrl('/api/kgLyric'),{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({hash:hash,id:songId})
},15000);
try{if(typeof logAction==='function')logAction('酷狗歌词请求','hash='+hash+' st='+(rk&&rk.status)+' code='+(rk&&rk.data&&rk.data.code));}catch(e){}
var rawK='';
var body=rk&&rk.data;
if(body&&body.code===200&&body.data){
rawK=body.data.lyric||(body.data.lrc&&(body.data.lrc.lyric||body.data.lrc))||'';
}
if(!rawK&&rk&&rk.text){
try{var pj=JSON.parse(rk.text);if(pj&&pj.data)rawK=pj.data.lyric||'';}catch(e){rawK=rk.text;}
}
rawK=String(rawK||'').replace(/^\uFEFF/,'');
if(rawK&&rawK.trim()){
var cleaned=typeof cleanLyricMeta==='function'?cleanLyricMeta(rawK):rawK;
// 若误删成空，回退到仅去元信息行的简单处理
if(!cleaned||!String(cleaned).trim()){
cleaned=rawK.split(/\r?\n/).filter(function(line){
var t=String(line).trim();
if(!t)return false;
if(/^\[[a-zA-Z$][^\]]*:/.test(t)&&!/^\[\d{1,2}:\d{2}/.test(t))return false;
return true;
}).join('\n');
}
if(cleaned&&String(cleaned).trim()){
try{if(typeof saveLyricToCache==='function')await saveLyricToCache(songId,cleaned,'','');}catch(e){}
return {code:200,data:{lrc:{lyric:ensureHttpsInText(cleaned)},tlyric:{lyric:''},romalrc:{lyric:''}}};
}
}
}catch(e){}
return {code:404,msg:'暂无歌词',data:{lrc:{lyric:''},tlyric:{lyric:''},romalrc:{lyric:''}}};
}
// ---------- 网易 ----------
try{
if(typeof getLocalLyricOnly==='function'){
var loc=getLocalLyricOnly(songId);
if(loc&&loc.main&&String(loc.main).trim()&&String(loc.main).trim()!=='暂无歌词'){
return {code:200,data:{
lrc:{lyric:ensureHttpsInText(loc.main||'')},
tlyric:{lyric:ensureHttpsInText(loc.trans||'')},
romalrc:{lyric:ensureHttpsInText(loc.roma||'')}
}};
}
}
}catch(e){}
var tasks=[];
tasks.push(async function(){try{if(typeof getCachedLyric==='function'){var c=await getCachedLyric(songId);if(c&&c.main&&String(c.main).trim()&&String(c.main).trim()!=='暂无歌词'){return {code:200,data:{lrc:{lyric:ensureHttpsInText(c.main||'')},tlyric:{lyric:ensureHttpsInText(c.trans||'')},romalrc:{lyric:ensureHttpsInText(c.roma||'')}}};}}}catch(e){}return null;});
tasks.push(async function(){try{
var rv=await localFetchJson('https://api.vkeys.cn/v2/music/netease/lyric?id='+encodeURIComponent(songId),{method:'GET'});
var d=(rv.data&&rv.data.data)||rv.data||{};
var lrc=d.lrc||'',trans=d.trans||d.tlyric||'',roma=d.roma||d.romalrc||'';
if(typeof lrc==='object')lrc=lrc.lyric||'';if(typeof trans==='object')trans=trans.lyric||'';if(typeof roma==='object')roma=roma.lyric||'';
if(lrc||trans||roma)return {code:200,data:{lrc:{lyric:ensureHttpsInText(String(lrc||''))},tlyric:{lyric:ensureHttpsInText(String(trans||''))},romalrc:{lyric:ensureHttpsInText(String(roma||''))}}};
}catch(e){}return null;});
tasks.push(async function(){try{
var rg=await localFetchJson('https://music-api.gdstudio.xyz/api.php?types=lyric&source=netease&id='+encodeURIComponent(songId),{method:'GET'});
if(rg.data&&rg.data.lyric)return {code:200,data:{lrc:{lyric:ensureHttpsInText(rg.data.lyric||'')},tlyric:{lyric:ensureHttpsInText(rg.data.tlyric||rg.data.trans||'')},romalrc:{lyric:''}}};
}catch(e){}return null;});
var results=await Promise.all(tasks.map(function(fn){return fn().catch(function(){return null;});}));
var best=null;
for(var i=0;i<results.length;i++){
var r=results[i];if(!r||r.code!==200||!r.data)continue;
var hasMain=r.data.lrc&&r.data.lrc.lyric&&String(r.data.lrc.lyric).trim();
var hasRoma=r.data.romalrc&&r.data.romalrc.lyric&&String(r.data.romalrc.lyric).trim();
if(hasMain&&hasRoma){best=r;break;}if(hasMain&&!best)best=r;
}
if(best){
try{var bm=best.data.lrc&&best.data.lrc.lyric||'';var bt=best.data.tlyric&&best.data.tlyric.lyric||'';var br=best.data.romalrc&&best.data.romalrc.lyric||'';
if(!br){for(var j=0;j<results.length;j++){var rj=results[j];if(rj&&rj.data&&rj.data.romalrc&&rj.data.romalrc.lyric){br=rj.data.romalrc.lyric;best.data.romalrc={lyric:br};break;}}}
if(bm&&String(bm).trim()&&typeof saveLyricToCache==='function')await saveLyricToCache(songId,bm,bt,br);}catch(e){}
return best;
}
return {code:404,msg:'暂无歌词',data:{lrc:{lyric:''},tlyric:{lyric:''},romalrc:{lyric:''}}};
}



async function textdbPutOne(safeKey,val){
// 浏览器直连 textdb（不走 Worker）
var v=String(val);
var url='https://textdb.online/update/?key='+encodeURIComponent(safeKey)+'&value='+encodeURIComponent(v);
try{
var r=await localFetchJson(url,{method:'GET'},30000);
if(r.status===0)return {ok:false,msg:r.error||'网络错误(CORS/超时)'};
if(!r.ok)return {ok:false,msg:'HTTP '+r.status};
// textdb 成功: {status:1,...}
if(r.data&&typeof r.data==='object'&&r.data.status!=null&&Number(r.data.status)!==1){
return {ok:false,msg:'textdb status='+r.data.status};
}
return {ok:true};
}catch(e){return {ok:false,msg:String(e.message||e)};}
}
async function textdbGetOne(safeKey){
try{
var r=await localFetchJson('https://textdb.online/'+encodeURIComponent(safeKey),{method:'GET'},20000);
if(r.status===0)return {ok:false,msg:r.error||'网络错误'};
if(!r.ok)return {ok:false,msg:'HTTP '+r.status};
var val=r.text!=null?String(r.text):'';
// 空内容也算成功读到（可能未写入）
return {ok:true,value:val};
}catch(e){return {ok:false,msg:String(e.message||e)};}
}
async function localCacheGet(key){
if(!key)return {ok:false,msg:'缺少 key'};
var safeKey=String(key).replace(/[^a-zA-Z0-9_-]/g,'');
if(!safeKey)return {ok:false,msg:'无效 key'};
var meta=await textdbGetOne(safeKey);
if(!meta.ok)return meta;
var val=String(meta.value||'');
// textdb 有时会在 JSON 里加空格：{"v": 2, "n": 2}
var trimmed=val.trim();
try{
if(trimmed.charAt(0)==='{'){
var o=JSON.parse(trimmed);
if(o&&Number(o.v)===2&&Number(o.n)>1){
var parts=[];
for(var i=0;i<Number(o.n);i++){
var p=await textdbGetOne(safeKey+'_c'+i);
if(!p.ok||p.value==null)return {ok:false,msg:'分片 '+i+' 缺失'};
parts.push(String(p.value));
}
return {ok:true,value:parts.join('')};
}
}
}catch(e){}
// 修复 gzip 里可能被变成空格的 +
if(trimmed.indexOf('#GZIP')===0){
val=trimmed.replace(/^#GZIP:?/, '#GZIP:').replace(/ /g,'+');
// 若已是 base64url，不动；base64ToBytes 会兼容
return {ok:true,value:val};
}
return {ok:true,value:trimmed};
}
async function localCacheSet(key,value){
if(!key||value===undefined||value===null)return {ok:false,msg:'缺少参数'};
var safeKey=String(key).replace(/[^a-zA-Z0-9_-]/g,'');
if(!safeKey)return {ok:false,msg:'无效 key'};
var val=String(value);
// 浏览器直连：分片约 1500 字符，避免 URL 过长
var CHUNK=1500;
if(val.length<=CHUNK){
return await textdbPutOne(safeKey,val);
}
var n=Math.ceil(val.length/CHUNK);
var rm=await textdbPutOne(safeKey,JSON.stringify({v:2,n:n}));
if(!rm.ok)return rm;
for(var i=0;i<n;i++){
var part=val.substring(i*CHUNK,(i+1)*CHUNK);
var rp=await textdbPutOne(safeKey+'_c'+i,part);
if(!rp.ok)return {ok:false,msg:'分片 '+i+' 上传失败:'+(rp.msg||'')};
}
return {ok:true};
}
function post(path,body){
body=body||{};
var p=String(path||'');
if(p==='/api/getSongUrl'||p==='getSongUrl')return localGetSongUrl(body.id,body.level||'exhigh');
if(p==='/api/search'||p==='search')return localSearch(body.word||'');
if(p==='/api/getSongLyric'||p==='getSongLyric')return localGetSongLyric(body.id);
if(p==='/api/getSongInfo'||p==='getSongInfo')return localGetSongInfo(body.id);
if(p==='/api/cacheGet'||p==='cacheGet')return localCacheGet(body.key||'');
if(p==='/api/cacheSet'||p==='cacheSet')return localCacheSet(body.key||'',body.value);
var url=toAbsoluteApiUrl(path);
return fetch(url,{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify(body||{})
}).then(function(r){
if(!r.ok){
return r.text().then(function(t){
try{return JSON.parse(t);}catch(e){return {ok:false,msg:'HTTP '+r.status};}
});
}
return r.json();
}).catch(function(err){
var msg=(err&&err.message)?String(err.message):'网络错误';
if(/Only HTTP/i.test(msg)||/Failed to fetch/i.test(msg)||/NetworkError/i.test(msg)){
msg='网络请求失败，请检查应用是否允许访问 https://music.achtlv.kdns.fr';
}
return Promise.reject(new Error(msg));
});
}
function fmt(s){
s=Math.floor(s||0);if(!isFinite(s)||s<0)s=0;
return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}
function toast(msg){
var t=document.createElement('div');
t.className='toast';t.textContent=msg;
document.body.appendChild(t);
requestAnimationFrame(function(){t.classList.add('show')});
setTimeout(function(){
t.classList.remove('show');
setTimeout(function(){t.remove()},320);
},2200);
}
function extractUrl(r){
if(!r)return '';
var u='';
if(r.data&&r.data.url)u=r.data.url;
else if(r.data&&r.data[0]&&r.data[0].url)u=r.data[0].url;
else u=r.url||'';
if(u&&typeof upgradeMediaUrl==='function')u=upgradeMediaUrl(u);
return u||'';
}
function extractExpi(r){
if(r&&r.data&&typeof r.data.expi==='number')return r.data.expi;
return 0;
}

function qualityRank(q){
if(!q||q==='unavailable'||q==='external')return 0;
var r=QUALITY_RANK[q];
return (r===undefined)?0:r;
}

function normalizeCodec(c){
if(!c)return '';
return String(c).trim();
}

function isCodecSupported(mime,codec,useMse){
if(!codec)return true;
var type=mime+'; codecs="'+codec+'"';
if(useMse&&window.MediaSource&&MediaSource.isTypeSupported){
if(MediaSource.isTypeSupported(type))return true;
}
try{
var testEl=document.createElement('video');
var result=testEl.canPlayType(type);
return result==='probably'||result==='maybe';
}catch(e){
return false;
}
}

// ==================== gzip ====================
function bytesToBase64(bytes){
var bin='';
var chunk=0x8000;
for(var i=0;i<bytes.length;i+=chunk){
var sub=bytes.subarray(i,i+chunk);
bin+=String.fromCharCode.apply(null,sub);
}
return btoa(bin);
}
// textdb 会把 + 变成空格，所以分享内容一律用 base64url（- _ 无 + /）
function bytesToBase64Url(bytes){
return bytesToBase64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function base64ToBytes(b64){
// 兼容标准 base64 与 base64url，并修复 textdb 把 + 变成空格
var s=String(b64||'').replace(/ /g,'+').replace(/-/g,'+').replace(/_/g,'/');
while(s.length%4)s+='=';
var bin=atob(s);
var bytes=new Uint8Array(bin.length);
for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
return bytes;
}
async function gzipCompress(text){
if(typeof CompressionStream==='undefined')return null;
try{
var cs=new CompressionStream('gzip');
var writer=cs.writable.getWriter();
writer.write(new TextEncoder().encode(text));
writer.close();
var chunks=[];
var reader=cs.readable.getReader();
while(true){
var r=await reader.read();
if(r.done)break;
chunks.push(r.value);
}
var total=0;
for(var i=0;i<chunks.length;i++)total+=chunks[i].length;
var all=new Uint8Array(total);
var off=0;
for(var i=0;i<chunks.length;i++){all.set(chunks[i],off);off+=chunks[i].length;}
return bytesToBase64Url(all);
}catch(e){return null;}
}
async function gzipDecompress(b64){
if(typeof DecompressionStream==='undefined')return null;
try{
var bytes=base64ToBytes(b64);
var ds=new DecompressionStream('gzip');
var writer=ds.writable.getWriter();
writer.write(bytes);
writer.close();
var chunks=[];
var reader=ds.readable.getReader();
while(true){
var r=await reader.read();
if(r.done)break;
chunks.push(r.value);
}
var total=0;
for(var i=0;i<chunks.length;i++)total+=chunks[i].length;
var all=new Uint8Array(total);
var off=0;
for(var i=0;i<chunks.length;i++){all.set(chunks[i],off);off+=chunks[i].length;}
return new TextDecoder().decode(all);
}catch(e){return null;}
}
async function decodeImportText(text){
text=String(text||'').trim();
if(!text)return '';
if(text.indexOf('#GZIP')===0){
var b64=text.replace(/^#GZIP:?/,'').replace(/ /g,'+').trim();
try{
var out=await gzipDecompress(b64);
if(out)return out;
}catch(e){}
return '';
}
return text;
}

// ==================== 其他解析工具 ====================
function extractInfo(data){
var d=data&&data.data?data.data:data;
var song=(d&&d.songs&&d.songs[0])||(Array.isArray(d)?d[0]:null)||(d&&d.song)||d||{};
var name=song.name||song.songName||song.title||'';
var artists=song.ar||song.artists||song.singer||song.artist||[];
var artist='';
if(Array.isArray(artists)){artist=artists.map(function(a){return a&&a.name?a.name:a}).filter(Boolean).join(' / ')}
else if(artists&&typeof artists==='object'){artist=artists.name||''}
else if(typeof artists==='string'){artist=artists}
var pic=(song.al&&song.al.picUrl)||(song.album&&song.album.picUrl)||song.picUrl||song.pic||song.cover||song.picimg||'';
var duration=0;
if(typeof song.dt==='number'&&song.dt>0)duration=song.dt/1000;
else if(typeof song.duration==='number'&&song.duration>0)duration=song.duration/1000;
else if(typeof song.duration==='string'&&song.duration.length>0){
var parts=song.duration.split(':');
if(parts.length===2){
var mm=parseInt(parts[0],10);
var ss=parseInt(parts[1],10);
if(isFinite(mm)&&isFinite(ss))duration=mm*60+ss;
}
}
return {name:name,artist:artist,pic:pic,duration:duration};
}
function uid(){return 'ext_'+Date.now()+'_'+Math.random().toString(36).slice(2,8)}
function getQualityText(song,quality){
if(!quality)return '';
if(quality==='external'){
var fm=song&&song.format?song.format.toUpperCase():'';
return fm?'外部音源 · '+fm:'外部音源';
}
if(quality==='unavailable')return '不可用';
return QUALITY_LABEL[quality]||'';
}

// ==================== 去重工具 ====================
function normalizeUrlForKey(u){
if(!u)return '';
var s=String(u).trim();
if(!s)return '';
var low=s.toLowerCase();
if(low.indexOf('http://')!==0&&low.indexOf('https://')!==0){
s='https://'+s;
}
try{
var uo=new URL(s);
var host=(uo.hostname||'').toLowerCase();
var port=uo.port||'';
var path=uo.pathname||'/';
while(path.length>1&&path.charAt(path.length-1)==='/')path=path.substring(0,path.length-1);
if(path==='/')path='';
var search=uo.search||'';
var key=host;
if(port)key+=':'+port;
key+=path+search;
return key;
}catch(e){
var m=s;
var ml=m.toLowerCase();
if(ml.indexOf('http://')===0)m=m.substring(7);
else if(ml.indexOf('https://')===0)m=m.substring(8);
var cut=m.indexOf('/');
if(cut!==-1)m=m.substring(0,cut);
return m.toLowerCase();
}
}

function getSongDedupKeys(song){
var keys=[];
if(!song)return keys;
if(song.external){
var u1=normalizeUrlForKey(song.url||'');
if(u1)keys.push('ext:'+u1);
var u2=normalizeUrlForKey(song.srcUrl||'');
if(u2&&u2!==u1)keys.push('ext:'+u2);
}else if(song.id){
var id=String(song.id);
// 不同平台不算重复：网易数字 ID vs 酷狗 kg+hash
if(/^kg/i.test(id))keys.push('kg:'+id.toLowerCase());
else if(/^[a-fA-F0-9]{32}$/.test(id))keys.push('kg:kg'+id.toLowerCase());
else keys.push('wy:'+id);
}
return keys;
}

function findDuplicateIndex(song,list){
var toKeys=getSongDedupKeys(song);
if(!toKeys.length)return -1;
var toSet={};
for(var a=0;a<toKeys.length;a++)toSet[toKeys[a]]=true;
for(var i=0;i<list.length;i++){
var lk=getSongDedupKeys(list[i]);
for(var j=0;j<lk.length;j++){
if(toSet[lk[j]])return i;
}
}
return -1;
}

function addKeysToSeen(seen,song){
var keys=getSongDedupKeys(song);
for(var i=0;i<keys.length;i++)seen[keys[i]]=true;
}

function hasAnyKeyInSeen(seen,song){
var keys=getSongDedupKeys(song);
for(var i=0;i<keys.length;i++){
if(seen[keys[i]])return true;
}
return false;
}

// ==================== Cookie ====================
function setCookieRaw(name,value){
var exp=new Date(Date.now()+365*864e5).toUTCString();
document.cookie=name+'='+value+'; expires='+exp+'; path=/; SameSite=Lax';
}
function getCookieRaw(name){
var parts=document.cookie.split(';');
for(var i=0;i<parts.length;i++){
var p=parts[i].trim();
if(p.indexOf(name+'=')===0)return p.substring(name.length+1);
}
return null;
}

var _plIdb=null;
function openPlaylistIdb(){
return new Promise(function(resolve,reject){
try{
if(_plIdb){resolve(_plIdb);return;}
var req=indexedDB.open('playlet_db',1);
req.onupgradeneeded=function(){var db=req.result;if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv');};
req.onsuccess=function(){_plIdb=req.result;resolve(_plIdb);};
req.onerror=function(){reject(req.error);};
}catch(e){reject(e);}
});
}
function idbSetPlaylist(payload){
try{openPlaylistIdb().then(function(db){db.transaction('kv','readwrite').objectStore('kv').put(String(payload||''),'playlist');}).catch(function(){});}catch(e){}
}
function idbGetPlaylist(){
return openPlaylistIdb().then(function(db){
return new Promise(function(resolve){
try{var r=db.transaction('kv','readonly').objectStore('kv').get('playlist');r.onsuccess=function(){resolve(r.result||'');};r.onerror=function(){resolve('');};}
catch(e){resolve('');}
});
}).catch(function(){return '';});
}

function clearPlaylistCookie(){
try{localStorage.removeItem(COOKIE_NAME);}catch(e){}
try{localStorage.removeItem(COOKIE_NAME+'_bak');}catch(e){}
try{sessionStorage.removeItem(COOKIE_NAME);}catch(e){}
try{if(typeof idbSetPlaylist==='function')idbSetPlaylist('');}catch(e){}
try{if(typeof idbSetPlaylist==='function')idbSetPlaylist(JSON.stringify({v:1,list:[],current:-1,ts:Date.now()}));}catch(e){}
}
function savePlaylist(forceEmpty){
try{
// 防止瞬时空列表覆盖已有完整列表（除非明确清空）
if(!forceEmpty&&(!state.playlist||!state.playlist.length)){
try{
var exist=localStorage.getItem(COOKIE_NAME)||localStorage.getItem(COOKIE_NAME+'_bak');
if(exist){
var eo=JSON.parse(exist);
var el=Array.isArray(eo)?eo:(eo&&eo.list);
if(Array.isArray(el)&&el.length>0)return;
}
}catch(e){}
}
var data=state.playlist.map(function(s){
var obj={id:s.id,name:s.name||'',artist:s.artist||''};
if(s.external){obj.ext=true;obj.url=s.url||'';obj.srcUrl=s.srcUrl||'';obj.format=s.format||'';}
if(s.pic)obj.pic=s.pic;
if(s.source)obj.source=s.source;
return obj;
});
var lastId='';
try{
if(state.current>=0&&state.playlist[state.current])lastId=String(state.playlist[state.current].id||'');
}catch(e){}
var payload=JSON.stringify({v:1,list:data,current:state.current,lastId:lastId,ts:Date.now()});
localStorage.setItem(COOKIE_NAME,payload);
try{localStorage.setItem(COOKIE_NAME+'_bak',payload);}catch(e3){}
try{sessionStorage.setItem(COOKIE_NAME,payload);}catch(e4){}
try{idbSetPlaylist(payload);}catch(e5){}
try{
var encoded=encodeURIComponent(JSON.stringify(data));
if(encoded.length<=COOKIE_MAX)setCookieRaw(COOKIE_NAME,encoded);
}catch(e2){}
}catch(e){
console.error('savePlaylist',e);
try{if(typeof logError==='function')logError('保存播放列表失败',e);}catch(e5){}
}
}
function applyPlaylistPayload(raw){
if(!raw)return false;
try{
var obj=JSON.parse(raw);
var list=Array.isArray(obj)?obj:(obj&&obj.list);
if(!Array.isArray(list)||!list.length)return false;
var mapped=list.map(function(s){
var o={id:String(s.id||''),name:s.name||'未知歌曲',artist:s.artist||'未知歌手',pic:s.pic||'',duration:0};
if(s.ext){o.external=true;o.url=String(s.url||'');o.srcUrl=String(s.srcUrl||'');o.format=String(s.format||'');}
if(s.source)o.source=s.source;
if(o.pic&&o.pic.indexOf('http://')===0)o.pic=o.pic.replace(/^http:\/\//i,'https://');
return o;
}).filter(function(s){return !!s.id&&(!s.external||!!s.url);});
if(!mapped.length)return false;
state.playlist=mapped;
var restored=-1;
if(obj&&obj.lastId){
var lid=String(obj.lastId);
for(var ri=0;ri<state.playlist.length;ri++){if(String(state.playlist[ri].id)===lid){restored=ri;break;}}
}
if(restored<0&&obj&&typeof obj.current==='number'&&obj.current>=0&&obj.current<state.playlist.length)restored=obj.current;
state.current=restored>=0?restored:0;
return true;
}catch(e){return false;}
}
function readPlaylistRaw(){
var raw=null;
try{raw=localStorage.getItem(COOKIE_NAME);}catch(e){}
if(!raw){try{raw=localStorage.getItem(COOKIE_NAME+'_bak');}catch(e){}}
if(!raw){try{raw=sessionStorage.getItem(COOKIE_NAME);}catch(e){}}
if(!raw){try{raw=localStorage.getItem('m3_playlist');}catch(e){}}
if(!raw){try{raw=localStorage.getItem('m3_playlist_bak');}catch(e){}}
if(!raw){
try{
var m=document.cookie.match(/(?:^|;\s*)m3_playlist=([^;]+)/);
if(m)raw=decodeURIComponent(m[1]);
}catch(e){}
}
return raw;
}
function restorePlaylist(){
try{
var raw=readPlaylistRaw();
if(raw&&applyPlaylistPayload(raw)){
try{state.playlistLoading=false;}catch(e){}
return true;
}
}catch(e){}
return !!(state.playlist&&state.playlist.length);
}
// 进入页面时 storage 可能尚未就绪：短轮询直到读到或超时
function ensurePlaylistRestored(cb){
var done=false;
function finish(ok){
if(done)return;
done=true;
try{state.playlistLoading=false;}catch(e){}
if(typeof cb==='function'){
try{cb(ok);}catch(e){}
}
}
try{
if(restorePlaylist()){finish(true);return;}
}catch(e){}
var tries=0;
var timer=setInterval(function(){
tries++;
var ok=false;
try{ok=restorePlaylist();}catch(e){}
if(ok||tries>=20){
clearInterval(timer);
// 最后尝试 IDB
if(!ok&&typeof idbGetPlaylist==='function'){
idbGetPlaylist().then(function(raw){
try{
if(raw&&typeof applyPlaylistPayload==='function'&&applyPlaylistPayload(raw)){
try{localStorage.setItem(COOKIE_NAME,raw);}catch(e){}
finish(true);
return;
}
}catch(e){}
finish(!!(state.playlist&&state.playlist.length));
}).catch(function(){finish(!!(state.playlist&&state.playlist.length));});
return;
}
finish(!!(state.playlist&&state.playlist.length));
}
},50);
}

// EARLY_RESTORE
try{if(typeof restorePlaylist==='function')restorePlaylist();}catch(e){}
try{
if(typeof ensurePlaylistRestored==='function'){
ensurePlaylistRestored(function(ok){
try{if(ok&&typeof render==='function')render();}catch(e){}
});
}
}catch(e){}

try{
window.addEventListener('pagehide',function(){try{savePlaylist();}catch(e){}});
window.addEventListener('beforeunload',function(){try{savePlaylist();}catch(e){}});
document.addEventListener('visibilitychange',function(){
if(document.visibilityState==='hidden'){try{savePlaylist();}catch(e){}}
});
}catch(e){}
`;
