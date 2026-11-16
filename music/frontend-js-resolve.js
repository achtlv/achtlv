export const RESOLVE_SCRIPT = String.raw`// ==================== 播放链接检测 ====================
async function fetchPlayUrlOnce(id){
for(var i=0;i<LEVELS.length;i++){
try{
var r=await post('/api/getSongUrl',{id:id,level:LEVELS[i]});
var url=extractUrl(r);
if(url&&isHttpUrl(url)){return {url:url,level:LEVELS[i],expi:extractExpi(r)};}
}catch(e){}
}
if(!(String(id||'').indexOf('kg')===0||/^[a-fA-F0-9]{32}$/.test(String(id||'')))){
var off=await probeOfficialLocal(id);
if(off&&off.url){return {url:off.url,level:'official',expi:off.expi||0,fromCache:!!off.fromCache};}
}
return null;
}


async function fetchPlayUrlFresh(id){
for(var i=0;i<LEVELS.length;i++){
try{
var r=await post('/api/getSongUrl',{id:id,level:LEVELS[i]});
var url=extractUrl(r);
if(url&&isHttpUrl(url)){
var expi=extractExpi(r);
if(LEVELS[i]!=='official'){
try{await saveAudioUrlToCache(id,LEVELS[i],url,expi);}catch(e){}
}
return {url:url,level:LEVELS[i],expi:expi};
}
}catch(e){}
}
if(!(String(id||'').indexOf('kg')===0||/^[a-fA-F0-9]{32}$/.test(String(id||'')))){
var off=await probeOfficialLocal(id);
if(off&&off.url){return {url:off.url,level:'official',expi:off.expi||0,fromCache:!!off.fromCache};}
}
return null;
}

async function tryGetLevelWithCache(id,level,minRemainSec){
// 1) 仅本地
var local=await getLocalAudioUrlOnly(id,level,minRemainSec);
if(local){
var expiL=Math.max(1,Math.floor((local.expireAt-Date.now())/1000));
try{if(typeof logAction==='function')logAction('取链命中本地',level+' id='+id);}catch(e){}
return {url:upgradeMediaUrl(local.url),level:level,expi:expiL,fromCache:true,fromLocal:true};
}
// 2) TextDB（再回填本地）
var remote=await getTextdbAudioUrlOnly(id,level,minRemainSec);
if(remote&&remote.url){
var expiR=Math.max(1,Math.floor((remote.expireAt-Date.now())/1000));
try{await saveAudioUrlToCache(id,level,remote.url,expiR);}catch(e){}
try{if(typeof logAction==='function')logAction('取链命中TextDB',level+' id='+id);}catch(e){}
return {url:upgradeMediaUrl(remote.url),level:level,expi:expiR,fromCache:true};
}
// 3) 解析 API（一次）
try{
var r=await fetchPlayUrlLevelOnce(id,level);
if(r&&r.url){
try{await saveAudioUrlToCache(id,level,r.url,r.expi||DEFAULT_EXPI);}catch(e){}
try{if(typeof logAction==='function')logAction('取链命中API',level+' id='+id);}catch(e){}
return {url:upgradeMediaUrl(r.url),level:level,expi:r.expi||DEFAULT_EXPI};
}
}catch(e){}
return null;
}

async function fetchPlayUrl(id,durationHint){
var durSec=(durationHint&&durationHint>0)?durationHint:360;
// 播放取链：本地缓存只要还剩一段时间就可用（不必强求覆盖整首歌时长）
// 过严会导致「本地有缓存却提示音源无法加载」，点刷新又立刻命中
var needRemain=45;

// 播放只考虑：极高 > 标准 > 官方（不含无损）
// 0) 本地任意可用缓存先用（避免误报无法加载）
try{
var levelsTry=['exhigh','standard','lossless'];
for(var li=0;li<levelsTry.length;li++){
var loc0=await getLocalAudioUrlOnly(id,levelsTry[li],10);
if(loc0&&loc0.url){
return {
url:upgradeMediaUrl(loc0.url),
level:levelsTry[li]==='lossless'?'exhigh':levelsTry[li],
expi:Math.max(1,Math.floor((loc0.expireAt-Date.now())/1000)),
fromCache:true,
fromLocal:true
};
}
}
}catch(e){}
// 1) 优先整条链路冲极高：本地 → API(各源一次) → TextDB；任一步拿到极高立即返回
var hi=await tryGetLevelWithCache(id,'exhigh',needRemain);
if(hi&&hi.url){
hi.url=upgradeMediaUrl(hi.url);
return hi;
}

// 2) 没有极高：用已有音质里最高的（先本地/TextDB 标准，再 API 标准，最后官方）
var stdLocal=await getLocalAudioUrlOnly(id,'standard',needRemain);
if(stdLocal&&stdLocal.url){
return {
url:upgradeMediaUrl(stdLocal.url),
level:'standard',
expi:Math.max(1,Math.floor((stdLocal.expireAt-Date.now())/1000)),
fromCache:true,
fromLocal:true
};
}
var stdDb=await getTextdbAudioUrlOnly(id,'standard',needRemain);
if(stdDb&&stdDb.url){
return {
url:upgradeMediaUrl(stdDb.url),
level:'standard',
expi:Math.max(1,Math.floor((stdDb.expireAt-Date.now())/1000)),
fromCache:true
};
}
// 标准：API 一次（tryGet 内会再扫本地/API/TextDB，本地与 TextDB 已空则主要打 API）
var std=await tryGetLevelWithCache(id,'standard',needRemain);
if(std&&std.url){
std.url=upgradeMediaUrl(std.url);
return std;
}

var off=await probeOfficialLocal(id);
if(off&&off.url){
return {url:upgradeMediaUrl(off.url),level:'official',expi:off.expi||0,fromCache:!!off.fromCache};
}

throw new Error('暂无可用音源');
}

async function fetchPlayUrlLevelOnce(id,level){
if(level==='official'){
var off=await probeOfficialLocal(id);
if(off&&off.url){
return {url:off.url,expi:off.expi||0,fromCache:!!off.fromCache};
}
return null;
}
try{
var r=await post('/api/getSongUrl',{id:id,level:level});
var url=extractUrl(r);
if(url&&isHttpUrl(url)){
var expi=extractExpi(r)||DEFAULT_EXPI;
var rq='';
try{rq=String((r.data&&r.data.respQuality)||'');}catch(e){}
// 仅当接口明确表示落成 128k 时不当作极高
if(level==='exhigh'&&(/^(128k|128|lq)$/i.test(rq))){
try{await maybeCacheSideStandard(id,url,expi);}catch(e){}
return null;
}
return {url:url,expi:expi};
}
}catch(e){}
return null;
}

async function fetchPlayUrlLevel(id,level,minRemainSec){
if(level==='official')return '';
if(typeof minRemainSec!=='number')minRemainSec=300;
var got=await tryGetLevelWithCache(id,level,minRemainSec);
return got&&got.url?got.url:'';
}


// URL ?add= 专用解析：不依赖当前 ADD_SOURCE 标签
async function resolveShareAdd(text){
text=String(text||'').trim();
if(!text)throw new Error('空的分享内容');

// 1) 酷狗：kg 开头且不含点
if(/^kg/i.test(text)&&text.indexOf('.')===-1){
var kid=normalizeKgId(text);
var metaK={id:kid,name:'酷狗歌曲',artist:'',pic:'',duration:0,source:'kg',quality:'exhigh'};
try{
var info=await fetchMetaById(kid).catch(function(){return null;});
if(info){
if(info.name)metaK.name=info.name;
if(info.artist)metaK.artist=info.artist;
if(info.pic)metaK.pic=info.pic;
if(info.duration)metaK.duration=info.duration;
}
}catch(e){}
return metaK;
}

// 2) 纯数字：网易云 ID
if(isSongId(text)||(/^\d{5,}$/.test(text))){
var id=String(text).replace(/\D/g,'')||text;
var meta={id:id,name:'网易云歌曲',artist:'',pic:'',duration:0,source:'wy'};
try{
var m=await fetchMetaById(id);
if(m){
meta.name=m.name||meta.name;
meta.artist=m.artist||'';
meta.pic=m.pic||'';
meta.duration=m.duration||0;
}
}catch(e){}
// 不因音质探测失败而拒绝弹窗
try{
var q=await detectNeteaseQuality(id,meta.duration||0);
if(q)meta.quality=q;
else meta.quality='exhigh';
}catch(e){meta.quality='exhigh';}
return meta;
}

// 3) 链接 / 域名：一律第三方；补全 https
var link=text;
// 去掉包裹引号
if((link[0]==='"'&&link.slice(-1)==='"')||(link[0]==="'"&&link.slice(-1)==="'"))link=link.slice(1,-1);
// 从文本抽 URL
var urls=typeof extractAllUrlsFromText==='function'?extractAllUrlsFromText(link):[];
if(urls&&urls.length)link=urls[0];
// 域名开头无协议
if(!/^https?:\/\//i.test(link)&&!/^\/\//.test(link)&&/^[a-z0-9.-]+\.[a-z]{2,}/i.test(link)){
link='https://'+link;
}
if(/^\/\//.test(link))link='https:'+link;
if(/^http:\/\//i.test(link))link=link.replace(/^http:\/\//i,'https://');
if(typeof upgradeMediaUrl==='function')link=upgradeMediaUrl(link);
if(!/^https?:\/\//i.test(link))throw new Error('无法识别的分享内容');

// 网易链接仍走网易解析
if(typeof isNeteaseUrl==='function'&&isNeteaseUrl(link)){
try{
var nm=await tryNeteaseLink(link);
if(nm)return nm;
}catch(e){}
}
// 第三方直链
try{
var em=await tryThirdPartyLink(link);
if(em)return em;
}catch(e){}
// 即使探测失败，也给出可添加的外部项
return {
id:'ext_'+Date.now(),
name:link.split('/').pop()||'外部音频',
artist:'外部音源',
pic:'',
duration:0,
external:true,
url:link,
srcUrl:link,
format:(link.match(/\.([a-z0-9]+)(?:\?|$)/i)||[])[1]||'',
quality:'external'
};
}

// ==================== 解析输入 ====================
async function fetchMetaById(id){
var idStr=String(id);
var name='',artist='',pic='',duration=0;

for(var i=0;i<state.playlist.length;i++){
var s=state.playlist[i];
if(s.id===idStr&&!s.external){
if(s.name&&s.name!=='未知歌曲')name=s.name;
if(s.artist&&s.artist!=='未知歌手')artist=s.artist;
if(s.pic)pic=s.pic;
if(s.duration&&s.duration>0)duration=s.duration;
break;
}
}

if(!pic){
try{
var cachedPic=await getCachedCover(idStr);
if(cachedPic)pic=cachedPic;
}catch(e){}
}

if((!name||!artist||!pic)&&!/^kg/i.test(idStr)){
try{
var info=await post('/api/getSongInfo',{id:idStr});
var m=extractInfo(info);
if(!name&&m.name)name=m.name;
if(!artist&&m.artist)artist=m.artist;
if(!pic&&m.pic){
pic=m.pic;
await saveCoverToCache(idStr,m.pic);
}
if(!duration&&m.duration>0)duration=m.duration;
}catch(e){}
}

if((!pic||!name)&&name){
try{
var r=await post('/api/search',{word:name});
if(r&&r.id&&r.id===idStr){
if(!pic&&r.pic){
pic=r.pic;
await saveCoverToCache(idStr,r.pic);
}
if(!artist&&r.artist)artist=r.artist;
}
}catch(e){}
}

return {id:idStr,name:name||'未知歌曲',artist:artist||'未知歌手',pic:pic||'',duration:duration};
}

async function detectNeteaseQualityOnce(id,durationHint){
var durSec=(durationHint&&durationHint>0)?durationHint:0;
var minExpi=durSec>0?(durSec+URL_SAFETY_BUFFER):0;
for(var i=0;i<LEVELS.length;i++){
try{
var r=await post('/api/getSongUrl',{id:id,level:LEVELS[i]});
var url=extractUrl(r);
if(url&&isHttpUrl(url)){
var expi=extractExpi(r)||DEFAULT_EXPI;
if(minExpi>0&&expi<minExpi)continue;
await saveAudioUrlToCache(id,LEVELS[i],url,expi);
return LEVELS[i];
}
}catch(e){}
}
var off=await probeOfficialLocal(id, (minExpi||URL_SAFETY_BUFFER||60));
if(off&&off.url){
try{await saveAudioUrlToCache(id,'official',off.url,off.expi||DEFAULT_EXPI);}catch(e){}
return 'official';
}
return '';
}

async function detectNeteaseQuality(id,durationHint){
var hasDuration=(durationHint&&durationHint>0);
var durSec=hasDuration?durationHint:0;
var needRemain=hasDuration?(durSec+URL_SAFETY_BUFFER):300;

// 与播放一致：优先确认极高（本地→API→TextDB），没有再退标准/官方
var hi=await tryGetLevelWithCache(id,'exhigh',needRemain);
if(hi&&hi.url)return 'exhigh';
var std=await getLocalAudioUrlOnly(id,'standard',needRemain);
if(std&&std.url)return 'standard';
var std2=await getTextdbAudioUrlOnly(id,'standard',needRemain);
if(std2&&std2.url)return 'standard';
var std3=await tryGetLevelWithCache(id,'standard',needRemain);
if(std3&&std3.url)return 'standard';
var off=await probeOfficialLocal(id,needRemain);
if(off&&off.url)return 'official';
return '';
}

async function tryNeteaseLink(url){
var r=await post('/api/resolve',{url:url});
if(r&&r.id){
var m=await fetchMetaById(r.id);
var q=await detectNeteaseQuality(r.id,m.duration);
if(q){
m.quality=q;
return m;
}
}
return null;
}

async function tryThirdPartyLink(url){
url=String(url||'').trim();
if(!url)return null;
if(url.indexOf('//')===0)url='https:'+url;
if(/^http:\/\//i.test(url))url=url.replace(/^http:\/\//i,'https://');
var check=null;
try{check=await post('/api/checkAudio',{url:url});}catch(e){check=null;}
if(!check||!check.ok){
var msg=(check&&check.msg)||'直链不可用';
throw new Error(msg);
}
var fmt=check.format||getFormatFromUrl(url)||'';
if(!fmt&&/bilivideo|\.m4s/i.test(url))fmt='m4s';
// B站等需要 Referer：播放走 Worker 代理
var playUrl=url;
if(check.needProxy){
playUrl=toAbsoluteApiUrl('/api/mediaProxy?u='+encodeURIComponent(url));
}
var pic='';
try{pic=await extractCoverFromUrl(url);}catch(e){pic='';}
return {
id:uid(),
name:check.name||'外部音源',
artist:isVideoFormat(fmt)?'视频音源':'外部音源',
pic:pic,
external:true,
url:playUrl,
srcUrl:url,
format:fmt||'m4s',
quality:'external',
needProxy:!!check.needProxy
};
}



async function resolveInput(text){
text=(text||'').trim();
if(!text)throw new Error('请输入内容');
var src=(typeof ADD_SOURCE!=='undefined'?ADD_SOURCE:'wy');

// 第三方源模式：只解析直链
if(src==='ext'){
var urlsE=extractAllUrlsFromText(text);
if(!urlsE.length)throw new Error('请输入音频/视频直链');
var lastErr='直链不可用';
for(var je=0;je<urlsE.length;je++){
try{
var eme=await tryThirdPartyLink(urlsE[je]);
if(eme)return eme;
}catch(e){lastErr=(e&&e.message)||lastErr;}
}
throw new Error(lastErr||'直链不可用');
}

// 酷狗模式：只搜元数据，音质留给播放时探测（避免添加卡住）
if(src==='kg'){
if(typeof isKgId==='function'&&isKgId(text)){
var kid=normalizeKgId(text);
return {id:kid,name:'酷狗歌曲',artist:'',pic:'',duration:0,source:'kg',quality:'exhigh'};
}
var rsk=null;
try{
rsk=await Promise.race([
localSearchKg(text),
new Promise(function(res){setTimeout(function(){res({code:408,msg:'搜索超时'});},12000);})
]);
}catch(e){rsk={code:500,msg:String(e&&e.message||e)};}
if(rsk&&rsk.id){
var meta4={id:String(rsk.id),name:rsk.name||text,artist:rsk.artist||'未知歌手',pic:rsk.pic||'',duration:rsk.duration||0,source:'kg',quality:'exhigh',hash:rsk.hash||'',hqHash:rsk.hqHash||'',sqHash:rsk.sqHash||''};
if(meta4.id.indexOf('kg')!==0&&/^[a-fA-F0-9]{32}$/.test(meta4.id))meta4.id='kg'+meta4.id.toLowerCase();
if(!meta4.hash&&meta4.id.indexOf('kg')===0)meta4.hash=meta4.id.substring(2);
if(meta4.pic){try{await saveCoverToCache(meta4.id,meta4.pic);}catch(e){}}
return meta4;
}
throw new Error((rsk&&rsk.msg)||'未找到酷狗歌曲');
}

// 默认网易云：拿到 ID/元数据即可添加，音质在播放时再确认
if(typeof isSongId==='function'&&isSongId(text)){
var meta=null;
try{
meta=await Promise.race([
fetchMetaById(text),
new Promise(function(res){setTimeout(function(){res(null);},8000);})
]);
}catch(e){meta=null;}
if(!meta)meta={id:String(text),name:'网易云歌曲',artist:'',pic:'',duration:0};
meta.id=String(meta.id||text);
meta.source=meta.source||'wy';
meta.quality=meta.quality||'exhigh';
return meta;
}

var urls=extractAllUrlsFromText(text);
if(urls.length>0){
for(var i=0;i<urls.length;i++){
if(typeof isNeteaseUrl==='function'&&!isNeteaseUrl(urls[i]))continue;
try{
var nm=await tryNeteaseLink(urls[i]);
if(nm){nm.quality=nm.quality||'exhigh';return nm;}
}catch(e){}
}
}

var rs=null;
try{
rs=await Promise.race([
post('/api/search',{word:text}),
new Promise(function(res){setTimeout(function(){res({code:408,msg:'搜索超时'});},12000);})
]);
}catch(e){rs={code:500,msg:String(e&&e.message||e)};}
if(rs&&rs.id){
var meta3={id:String(rs.id),name:rs.name||text,artist:rs.artist||'未知歌手',pic:rs.pic||'',duration:rs.duration||0,source:'wy',quality:'exhigh'};
if(meta3.pic){try{await saveCoverToCache(meta3.id,meta3.pic);}catch(e){}}
return meta3;
}
throw new Error((rs&&rs.msg)||(urls.length?'网易云链接不可用，且未搜索到歌曲':'未找到歌曲'));
}

`;
