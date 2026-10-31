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
function isHttpUrl(u){
if(!u)return false;
var s=String(u).toLowerCase();
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
// Web-to-App / Gecko 等环境 location 可能不是 https，统一走线上域名
return 'https://music.achtlv.kdns.fr';
}
function toAbsoluteApiUrl(path){
if(!path)return getApiOrigin();
var s=String(path);
if(/^https?:\/\//i.test(s))return s;
if(s.charAt(0)!=='/')s='/'+s;
return getApiOrigin()+s;
}
function post(path,body){
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
if(r.data&&r.data.url)return r.data.url;
if(r.data&&r.data[0]&&r.data[0].url)return r.data[0].url;
return r.url||'';
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
function base64ToBytes(b64){
var bin=atob(b64);
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
return bytesToBase64(all);
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
if(!text)return null;
if(text.indexOf('#GZIP')===0){
var b64=text.substring(6).trim();
var decoded=await gzipDecompress(b64);
return decoded;
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
}else{
if(song.id)keys.push('id:'+String(song.id));
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
function savePlaylist(){
try{
var data=state.playlist.map(function(s){
var obj={id:s.id,name:s.name||'',artist:s.artist||''};
if(s.external){obj.ext=true;obj.url=s.url||'';obj.srcUrl=s.srcUrl||'';obj.format=s.format||'';}
if(s.pic)obj.pic=s.pic;
return obj;
});
localStorage.setItem(COOKIE_NAME,JSON.stringify({v:1,list:data,current:state.current}));
try{
var encoded=encodeURIComponent(JSON.stringify(data));
if(encoded.length<=COOKIE_MAX)setCookieRaw(COOKIE_NAME,encoded);
}catch(e2){}
}catch(e){console.error('savePlaylist',e);}
}
function restorePlaylist(){
try{
var raw=localStorage.getItem(COOKIE_NAME);
if(raw){
try{
var obj=JSON.parse(raw);
var list=Array.isArray(obj)?obj:(obj&&obj.list);
if(Array.isArray(list)&&list.length>=0){
state.playlist=list.map(function(s){
var o={id:String(s.id||''),name:s.name||'未知歌曲',artist:s.artist||'未知歌手',pic:s.pic||'',duration:0};
if(s.ext){o.external=true;o.url=String(s.url||'');o.srcUrl=String(s.srcUrl||'');o.format=String(s.format||'');}
return o;
}).filter(function(s){return !!s.id&&(!s.external||!!s.url);});
// 恢复上次歌曲索引，但不自动播放、进度清零
if(obj&&typeof obj.current==='number'&&obj.current>=0&&obj.current<state.playlist.length){
state.current=obj.current;
}else{
state.current=state.playlist.length?0:-1;
}
state.playing=false;
state.audioUrl='';
state.quality='';
state.showLyric=false;
return;
}
}catch(e1){}
}
raw=getCookieRaw(COOKIE_NAME);
if(!raw)return;
try{
var list2=JSON.parse(decodeURIComponent(raw));
if(!Array.isArray(list2))return;
state.playlist=list2.map(function(s){
var o={id:String(s.id||''),name:s.name||'未知歌曲',artist:s.artist||'未知歌手',pic:'',duration:0};
if(s.ext){o.external=true;o.url=String(s.url||'');o.srcUrl=String(s.srcUrl||'');o.format=String(s.format||'');}
return o;
}).filter(function(s){return !!s.id&&(!s.external||!!s.url);});
}catch(e2){}
}catch(e){console.error('restorePlaylist',e);}
}
function clearPlaylistCookie(){
document.cookie=COOKIE_NAME+'=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
}

// ==================== 导入 / 导出 ====================
function exportListText(){
return state.playlist.map(function(s){
var name=(s.name||'').split('|').join(' ');
var artist=(s.artist||'').split('|').join(' ');
if(s.external){
return (s.url||'')+'|'+name+'|'+artist+'|'+(s.srcUrl||'');
}
return s.id+'|'+name+'|'+artist;
}).join(LF);
}
function parseListText(text){
var lines=String(text||'').split(LF);
var out=[];
var seen={};
for(var i=0;i<lines.length;i++){
var line=lines[i].split(CR).join('').trim();
if(!line)continue;
if(line.charAt(0)==='#')continue;
var parts=line.split('|');
var key=(parts[0]||'').trim();
if(!key)continue;

var item=null;
if(isSongId(key)){
item={id:key,name:(parts[1]||'').trim()||'未知歌曲',artist:(parts[2]||'').trim()||'未知歌手',pic:'',duration:0};
}else if(isHttpUrl(key)){
var srcUrl=(parts[3]||'').trim();
if(!isHttpUrl(srcUrl))srcUrl='';
item={id:uid(),name:(parts[1]||'').trim()||'外部音源',artist:(parts[2]||'').trim()||'外部音源',pic:'',external:true,url:key,srcUrl:srcUrl,format:getFormatFromUrl(key)};
}
if(!item)continue;

if(hasAnyKeyInSeen(seen,item))continue;
addKeysToSeen(seen,item);
out.push(item);
}
return out;
}
function applyImport(imported,mode){
if(!imported.length)return 0;
if(mode==='new'){
if(typeof pushListHistory==='function')pushListHistory();
state.playlist=imported.slice();
state.current=-1;
return imported.length;
}
if(mode==='replace'){
state.playlist=imported.slice();
state.current=-1;
return imported.length;
}
var seen={};
state.playlist.forEach(function(s){addKeysToSeen(seen,s)});
var added=[];
imported.forEach(function(s){
if(hasAnyKeyInSeen(seen,s))return;
added.push(s);
addKeysToSeen(seen,s);
});
if(added.length===0)return 0;
var oldCurrent=state.current;
state.playlist=added.concat(state.playlist);
if(oldCurrent>=0)state.current=oldCurrent+added.length;
return added.length;
}

`;
