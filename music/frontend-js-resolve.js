export const RESOLVE_SCRIPT = String.raw`// ==================== 播放链接检测 ====================
async function fetchPlayUrlOnce(id){
for(var i=0;i<LEVELS.length;i++){
try{
var r=await post('/api/getSongUrl',{id:id,level:LEVELS[i]});
var url=extractUrl(r);
if(url&&isHttpUrl(url)){return {url:url,level:LEVELS[i],expi:extractExpi(r)};}
}catch(e){}
}
var off=await probeOfficialLocal(id);
if(off&&off.url){
return {url:off.url,level:'official',expi:off.expi||0,fromCache:!!off.fromCache};
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
var off=await probeOfficialLocal(id);
if(off&&off.url){
return {url:off.url,level:'official',expi:off.expi||0,fromCache:!!off.fromCache};
}
return null;
}

async function tryGetLevelWithCache(id,level,minRemainSec){
var cached=await getCachedAudioUrl(id,level,minRemainSec);
if(cached){
var expi=Math.max(1,Math.floor((cached.expireAt-Date.now())/1000));
return {url:cached.url,level:level,expi:expi,fromCache:true};
}
for(var i=0;i<DETECT_TIMES;i++){
try{
var r=await fetchPlayUrlLevelOnce(id,level);
if(r&&r.url){
await saveAudioUrlToCache(id,level,r.url,r.expi||DEFAULT_EXPI);
return {url:r.url,level:level,expi:r.expi||DEFAULT_EXPI};
}
}catch(e){}
}
return null;
}

async function fetchPlayUrl(id,durationHint){
var durSec=(durationHint&&durationHint>0)?durationHint:360;
var needRemain=durSec+URL_SAFETY_BUFFER;

var r1=await tryGetLevelWithCache(id,'exhigh',needRemain);
if(r1)return r1;

var r2=await tryGetLevelWithCache(id,'standard',needRemain);
if(r2)return r2;

var off=await probeOfficialLocal(id);
if(off&&off.url){
return {url:off.url,level:'official',expi:off.expi||0,fromCache:!!off.fromCache};
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
return {url:url,expi:extractExpi(r)};
}
}catch(e){}
return null;
}

async function fetchPlayUrlLevel(id,level,minRemainSec){
if(level==='official')return '';
if(typeof minRemainSec!=='number')minRemainSec=300;

var cached=await getCachedAudioUrl(id,level,minRemainSec);
if(cached)return cached.url;

for(var attempt=0;attempt<DETECT_TIMES;attempt++){
var r=await fetchPlayUrlLevelOnce(id,level);
if(r&&r.url){
await saveAudioUrlToCache(id,level,r.url,r.expi);
return r.url;
}
}
return '';
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

if(!name||!artist||!pic){
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

for(var i=0;i<LEVELS.length;i++){
var lv=LEVELS[i];
var cached=await getCachedAudioUrl(id,lv,needRemain);
if(cached)return lv;
}

var best='';
for(var attempt=0;attempt<DETECT_TIMES;attempt++){
var q=await detectNeteaseQualityOnce(id,durSec);
if(q&&qualityRank(q)>qualityRank(best))best=q;
if(best&&qualityRank(best)>=MAX_PLAY_RANK)break;
}
return best;
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
var check=await post('/api/checkAudio',{url:url});
if(check&&check.ok){
var fmt=check.format||getFormatFromUrl(url);
var pic='';
try{
pic=await extractCoverFromUrl(check.url||url);
}catch(e){pic='';}
return {
id:uid(),
name:check.name||'外部音源',
artist:isVideoFormat(fmt)?'视频音源':'外部音源',
pic:pic,
external:true,
url:check.url||url,
srcUrl:url,
format:fmt,
quality:'external'
};
}
return null;
}

async function resolveInput(text){
text=(text||'').trim();
if(!text)throw new Error('请输入内容');

if(isSongId(text)){
var meta=await fetchMetaById(text);
var q=await detectNeteaseQuality(text,meta.duration);
if(!q)throw new Error('该歌曲暂无可用音源');
meta.quality=q;
return meta;
}

var urls=extractAllUrlsFromText(text);
if(urls.length>0){
for(var i=0;i<urls.length;i++){
if(!isNeteaseUrl(urls[i]))continue;
try{
var nm=await tryNeteaseLink(urls[i]);
if(nm)return nm;
}catch(e){}
}
for(var j=0;j<urls.length;j++){
if(isNeteaseUrl(urls[j]))continue;
try{
var em=await tryThirdPartyLink(urls[j]);
if(em)return em;
}catch(e){}
}
}

var rs=await post('/api/search',{word:text});
if(rs&&rs.id){
var meta3={id:String(rs.id),name:rs.name||text,artist:rs.artist||'未知歌手',pic:rs.pic||'',duration:0};
var q3=await detectNeteaseQuality(meta3.id,meta3.duration);
if(!q3)throw new Error('该歌曲暂无可用音源');
meta3.quality=q3;
return meta3;
}
throw new Error((rs&&rs.msg)||(urls.length?'所有链接均不可用，且未搜索到歌曲':'未找到歌曲'));
}

`;
