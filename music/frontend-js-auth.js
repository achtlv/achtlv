export const AUTH_SCRIPT = String.raw`
// ==================== 认证与同步 ====================
// 精简 xxhash64 (非加密，仅用于用户名 key)
function xxhash64(str){
var seed=0;
var utf8=[];
for(var i=0;i<str.length;i++){
var c=str.charCodeAt(i);
if(c<0x80)utf8.push(c);
else if(c<0x800){utf8.push(0xc0|(c>>6),0x80|(c&0x3f));}
else if(c>=0xd800&&c<=0xdbff){
var c2=str.charCodeAt(++i);
var cp=0x10000+((c&0x3ff)<<10)|(c2&0x3ff);
utf8.push(0xf0|(cp>>18),0x80|((cp>>12)&0x3f),0x80|((cp>>6)&0x3f),0x80|(cp&0x3f));
}else{utf8.push(0xe0|(c>>12),0x80|((c>>6)&0x3f),0x80|(c&0x3f));}
}
var PRIME64_1=BigInt('0x9E3779B185EBCA87');
var PRIME64_2=BigInt('0xC2B2AE3D27D4EB4F');
var PRIME64_3=BigInt('0x165667B19E3779F9');
var PRIME64_4=BigInt('0x85EBCA77C2B2AE63');
var PRIME64_5=BigInt('0x27D4EB2F165667C5');
var MASK=BigInt('0xFFFFFFFFFFFFFFFF');
function rotl(x,r){x&=MASK;return ((x<<BigInt(r))|(x>>(BigInt(64-r))))&MASK;}
function mul(a,b){return (a*b)&MASK;}
var len=utf8.length;
var h;
var idx=0;
if(len>=32){
var v1=(BigInt(seed)+PRIME64_1+PRIME64_2)&MASK;
var v2=(BigInt(seed)+PRIME64_2)&MASK;
var v3=BigInt(seed)&MASK;
var v4=(BigInt(seed)-PRIME64_1)&MASK;
while(idx+32<=len){
function lane(o){
return BigInt(utf8[o])|(BigInt(utf8[o+1])<<BigInt(8))|(BigInt(utf8[o+2])<<BigInt(16))|(BigInt(utf8[o+3])<<BigInt(24))|
(BigInt(utf8[o+4])<<BigInt(32))|(BigInt(utf8[o+5])<<BigInt(40))|(BigInt(utf8[o+6])<<BigInt(48))|(BigInt(utf8[o+7])<<BigInt(56));
}
v1=mul(rotl(mul(v1+mul(lane(idx),PRIME64_2),PRIME64_1),31),PRIME64_1);idx+=8;
v2=mul(rotl(mul(v2+mul(lane(idx),PRIME64_2),PRIME64_1),31),PRIME64_1);idx+=8;
v3=mul(rotl(mul(v3+mul(lane(idx),PRIME64_2),PRIME64_1),31),PRIME64_1);idx+=8;
v4=mul(rotl(mul(v4+mul(lane(idx),PRIME64_2),PRIME64_1),31),PRIME64_1);idx+=8;
}
h=(rotl(v1,1)+rotl(v2,7)+rotl(v3,12)+rotl(v4,18))&MASK;
h=(h^mul(rotl(mul(v1,PRIME64_2),31),PRIME64_1))^PRIME64_1;h=mul(h,PRIME64_1);
h=(h^mul(rotl(mul(v2,PRIME64_2),31),PRIME64_1))^PRIME64_1;h=mul(h,PRIME64_1);
h=(h^mul(rotl(mul(v3,PRIME64_2),31),PRIME64_1))^PRIME64_1;h=mul(h,PRIME64_1);
h=(h^mul(rotl(mul(v4,PRIME64_2),31),PRIME64_1))^PRIME64_1;h=mul(h,PRIME64_1);
}else{
h=(BigInt(seed)+PRIME64_5)&MASK;
}
h=(h+BigInt(len))&MASK;
while(idx+8<=len){
var k=BigInt(utf8[idx])|(BigInt(utf8[idx+1])<<BigInt(8))|(BigInt(utf8[idx+2])<<BigInt(16))|(BigInt(utf8[idx+3])<<BigInt(24))|
(BigInt(utf8[idx+4])<<BigInt(32))|(BigInt(utf8[idx+5])<<BigInt(40))|(BigInt(utf8[idx+6])<<BigInt(48))|(BigInt(utf8[idx+7])<<BigInt(56));
k=mul(rotl(mul(k,PRIME64_2),31),PRIME64_1);
h=mul(rotl(h^k,27),PRIME64_1)+PRIME64_4;idx+=8;
}
while(idx+4<=len){
var k32=BigInt(utf8[idx])|(BigInt(utf8[idx+1])<<BigInt(8))|(BigInt(utf8[idx+2])<<BigInt(16))|(BigInt(utf8[idx+3])<<BigInt(24));
h=mul(rotl(h^mul(k32,PRIME64_1),23),PRIME64_2)+PRIME64_3;idx+=4;
}
while(idx<len){
h=mul(rotl(h^mul(BigInt(utf8[idx]),PRIME64_5),11),PRIME64_1);idx++;
}
h^=h>>BigInt(33);h=mul(h,PRIME64_2);
h^=h>>BigInt(29);h=mul(h,PRIME64_3);
h^=h>>BigInt(32);
var hex=h.toString(16);while(hex.length<16)hex='0'+hex;
return hex;
}

async function sha256Hex(str){
var data=new TextEncoder().encode(str);
var buf=await crypto.subtle.digest('SHA-256',data);
var arr=Array.from(new Uint8Array(buf));
return arr.map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

function usernameToKey(username){
var h=xxhash64('achtlvmusicplayerusername'+String(username||''));
return h.slice(0,59);
}

async function passwordToHash(password){
return await sha256Hex('achtlvmusicplayerpassword'+String(password||''));
}

async function textdbGetRaw(key){
if(!key)return '';
// 优先走 Worker 代理（与缓存同源、避免 CORS/接口差异）
try{
var r=await post('/api/cacheGet',{key:String(key)});
if(r&&r.ok&&typeof r.value==='string'){
var v=r.value;
if(!v||v==='404 Not Found'||v.indexOf('Not Found')===0)return '';
return v;
}
}catch(e){}
// 回退直连官方读接口
try{
var r2=await fetch('https://textdb.online/'+encodeURIComponent(key),{method:'GET',cache:'no-store'});
if(!r2.ok)return '';
var t=await r2.text();
if(!t||t==='404 Not Found'||t.indexOf('Not Found')===0)return '';
return String(t).trim();
}catch(e){return '';}
}

async function textdbSetRaw(key,value){
if(!key)return false;
var val=String(value||'');
// 优先走 Worker 代理（官方写入是 update/?key=&value=）
try{
var r=await post('/api/cacheSet',{key:String(key),value:val});
if(r&&r.ok)return true;
}catch(e){}
try{
var url='https://textdb.online/update/?key='+encodeURIComponent(key)+'&value='+encodeURIComponent(val);
var r2=await fetch(url,{method:'GET',cache:'no-store'});
if(!r2.ok)return false;
try{await r2.text();}catch(e){}
return true;
}catch(e){return false;}
}

function buildSyncPayload(){
var data={
v:1,
updatedAt:Date.now(),
playlists:state.syncPlaylists?state.playlists:[],
settings:state.syncSettings?{theme:state.theme,mode:state.mode,syncPlaylists:state.syncPlaylists,syncSettings:state.syncSettings}:null
};
return data;
}

function applyCloudData(cloud,opts){
opts=opts||{};
if(cloud.playlists&&state.syncPlaylists){
if(opts.plMode==='discard'){
state.playlists=cloud.playlists||[];
}else{
var map={};
(state.playlists||[]).forEach(function(p){if(p&&p.id)map[p.id]=p;});
(cloud.playlists||[]).forEach(function(p){
if(!p||!p.id)return;
if(!map[p.id]||(p.updatedAt||0)>=(map[p.id].updatedAt||0))map[p.id]=p;
});
state.playlists=Object.keys(map).map(function(k){return map[k];});
}
savePlaylistsLocal();
}
if(cloud.settings&&state.syncSettings){
if(opts.setMode==='discard'||!opts.keepLocalSettings){
if(cloud.settings.theme)applyTheme(cloud.settings.theme);
if(cloud.settings.mode)state.mode=cloud.settings.mode;
}
saveSettingsLocal();
}
}

async function loginOrRegister(username,password){
username=String(username||'').trim();
password=String(password||'');
if(!username||!password){toast('请输入用户名和密码');return false;}
var key=usernameToKey(username);
var passHash=await passwordToHash(password);
var raw=await textdbGetRaw(key);
raw=String(raw||'').trim();

// 无账号 → 注册：必须写成功且回读非空、哈希一致才算成功
if(!raw){
var payload=buildSyncPayload();
payload.updatedAt=Date.now();
var value=passHash+'\n'+JSON.stringify(payload);
var ok=await textdbSetRaw(key,value);
if(!ok){toast('注册失败');return false;}
var verify=String(await textdbGetRaw(key)||'').trim();
if(!verify){toast('注册失败');return false;}
var vHash=(verify.split('\n')[0]||'').trim();
if(!vHash||vHash!==passHash){toast('注册失败');return false;}
state.user={username:username,key:key,passHash:passHash};
state.lastLocalChangeAt=payload.updatedAt;
saveAuthLocal();
toast('注册并登录成功');
return {isNew:true};
}

// 已有账号 → 登录：第1行必须与密码哈希一致
var lines=raw.split('\n');
var storedHash=String(lines[0]||'').trim();
var body=lines.slice(1).join('\n');
if(!storedHash){toast('账号数据损坏，请更换用户名');return false;}
if(storedHash!==passHash){toast('密码错误');return false;}
var cloud=null;
try{cloud=JSON.parse(body||'{}');}catch(e){cloud={};}
state.user={username:username,key:key,passHash:passHash};
saveAuthLocal();
// 登录成功：先同步，若未推送再刷新 key
await syncAndMaybeRefreshKey();
toast('登录成功');
return {isNew:false,cloud:cloud};
}

/** 从云端拉取完整账号数据后原样写回，用于刷新 textdb key 有效期 */
async function refreshAccountTtl(){
if(!state.user||!state.user.key)return false;
var raw=String(await textdbGetRaw(state.user.key)||'').trim();
if(!raw)return false;
// 若本地 passHash 与云端第1行一致，用完整 raw 回写；否则用本地 hash + 云端 body
var lines=raw.split('\n');
var cloudHash=String(lines[0]||'').trim();
var body=lines.slice(1).join('\n');
var passHash=state.user.passHash||cloudHash;
if(!passHash)return false;
var value=passHash+'\n'+(body||'{}');
var ok=await textdbSetRaw(state.user.key,value);
if(!ok)return false;
var verify=String(await textdbGetRaw(state.user.key)||'').trim();
return !!verify;
}

async function changePassword(oldPass,newPass){
if(!state.user){toast('请先登录');return false;}
oldPass=String(oldPass||'');
newPass=String(newPass||'');
if(!oldPass||!newPass){toast('请输入旧密码和新密码');return false;}
if(newPass.length<1){toast('新密码不能为空');return false;}
var oldHash=await passwordToHash(oldPass);
var newHash=await passwordToHash(newPass);
// 与云端第1行比对
var raw=String(await textdbGetRaw(state.user.key)||'').trim();
if(!raw){toast('无法读取账号数据');return false;}
var lines=raw.split('\n');
var storedHash=String(lines[0]||'').trim();
var body=lines.slice(1).join('\n');
if(storedHash!==oldHash){toast('旧密码错误');return false;}
if(oldHash===newHash){toast('新密码不能与旧密码相同');return false;}
var value=newHash+'\n'+(body||'{}');
var ok=await textdbSetRaw(state.user.key,value);
if(!ok){toast('修改失败：写入失败');return false;}
var verify=String(await textdbGetRaw(state.user.key)||'').trim();
var vHash=(verify.split('\n')[0]||'').trim();
if(!verify||vHash!==newHash){toast('修改失败：校验未通过');return false;}
state.user.passHash=newHash;
saveAuthLocal();
toast('密码已修改');
return true;
}

async function pushSync(){
if(!state.user)return false;
var payload=buildSyncPayload();
var now=Date.now();
payload.updatedAt=Math.max(payload.updatedAt||0,state.lastLocalChangeAt||0,now);
// 用各歌单最大 updatedAt 抬高总时间戳
var maxPl=0;
(payload.playlists||[]).forEach(function(p){if(p&&p.updatedAt&&p.updatedAt>maxPl)maxPl=p.updatedAt;});
if(maxPl>payload.updatedAt)payload.updatedAt=maxPl;
var value=state.user.passHash+'\n'+JSON.stringify(payload);
var ok=await textdbSetRaw(state.user.key,value);
if(!ok)return false;
// 回读确认歌单数量与 updatedAt
var raw=String(await textdbGetRaw(state.user.key)||'').trim();
if(!raw)return false;
var body=raw.split('\n').slice(1).join('\n');
try{
var cloud=JSON.parse(body||'{}');
var cPl=cloud.playlists||[];
var lPl=payload.playlists||[];
if(cPl.length!==lPl.length)return false;
state.lastLocalChangeAt=payload.updatedAt;
saveSyncMetaLocal();
return true;
}catch(e){return false;}
}

async function pullAndMergeSync(){
// 返回: 'pushed' | 'pulled' | 'noop' | 'fail'
if(!state.user)return 'fail';
var raw=await textdbGetRaw(state.user.key);
if(!raw)return 'fail';
var lines=raw.split('\n');
var body=lines.slice(1).join('\n');
var cloud=null;
try{cloud=JSON.parse(body||'{}');}catch(e){return 'fail';}

// 始终按歌单 id 合并：谁的 updatedAt 新用谁（避免整包时间戳误判覆盖）
var map={};
var localNewer=false;
(state.playlists||[]).forEach(function(p){if(p&&p.id)map[p.id]=JSON.parse(JSON.stringify(p));});
(cloud.playlists||[]).forEach(function(p){
if(!p||!p.id)return;
var cur=map[p.id];
if(!cur){map[p.id]=p;return;}
if((p.updatedAt||0)>(cur.updatedAt||0)){
map[p.id]=p;
}else if((p.updatedAt||0)<(cur.updatedAt||0)){
localNewer=true;
}else{
// 相同时间戳：歌曲更多的优先
var cn=(p.songs&&p.songs.length)||0;
var ln=(cur.songs&&cur.songs.length)||0;
if(cn>ln)map[p.id]=p;
else if(ln>cn)localNewer=true;
}
});
// 本地有云端没有的歌单
(state.playlists||[]).forEach(function(p){
if(p&&p.id&&map[p.id]===p){
var found=false;
(cloud.playlists||[]).forEach(function(c){if(c.id===p.id)found=true;});
if(!found)localNewer=true;
}
});

var merged=Object.keys(map).map(function(k){return map[k];});
var before=JSON.stringify(state.playlists||[]);
state.playlists=merged;
var after=JSON.stringify(state.playlists||[]);
if(before!==after){
savePlaylistsLocal();
if(typeof renderPlaylistsPage==='function')renderPlaylistsPage();
if(typeof updateFavBtn==='function')updateFavBtn();
}

if(cloud.settings&&state.syncSettings){
var cloudAt=cloud.updatedAt||0;
var localAt=state.lastLocalChangeAt||0;
if(cloudAt>localAt&&cloud.settings.theme){
applyTheme(cloud.settings.theme);
if(cloud.settings.mode)state.mode=cloud.settings.mode;
}
}

var cloudAt2=cloud.updatedAt||0;
var localAt2=state.lastLocalChangeAt||0;
// 本地有更新或合并后本地仍更新 → 推送
if(localNewer||localAt2>cloudAt2){
var ok=await pushSync();
return ok?'pushed':'fail';
}
if(before!==after){
// 拉取到了更新
state.lastLocalChangeAt=Math.max(localAt2,cloudAt2);
saveSyncMetaLocal();
return 'pulled';
}
return 'noop';
}

/** 先同步；若本次没有推送上传，再原样回写以刷新 textdb key */
async function syncAndMaybeRefreshKey(){
if(!state.user)return;
var result='noop';
try{result=await pullAndMergeSync();}catch(e){result='fail';}
if(result==='pushed')return result;
try{await refreshAccountTtl();}catch(e){}
return result;
}

function saveSyncMetaLocal(){
try{
localStorage.setItem('m3_sync_meta',JSON.stringify({
lastLocalChangeAt:state.lastLocalChangeAt||0
}));
}catch(e){}
}
function restoreSyncMetaLocal(){
try{
var s=localStorage.getItem('m3_sync_meta');
if(!s)return;
var o=JSON.parse(s);
if(o&&o.lastLocalChangeAt)state.lastLocalChangeAt=o.lastLocalChangeAt;
}catch(e){}
}

var syncTimer=null;
// 已取消定时同步：仅在手动 / 登录首次 / 数据变更时同步
function startSyncLoop(){
if(syncTimer){clearInterval(syncTimer);syncTimer=null;}
}

var _syncDebounce=null;
function scheduleSyncSoon(){
if(!state.user)return;
if(_syncDebounce)clearTimeout(_syncDebounce);
_syncDebounce=setTimeout(function(){
_syncDebounce=null;
pushSync().catch(function(){});
},400);
}

function notifyDataChanged(kind){
state.lastLocalChangeAt=Date.now();
saveSyncMetaLocal();
if(!state.user)return;
if(kind==='playlists'&&state.syncPlaylists){
scheduleSyncSoon();
// 额外立即推一次，避免关闭页面丢失
pushSync().catch(function(){});
}
if(kind==='settings'&&state.syncSettings)scheduleSyncSoon();
}

function saveAuthLocal(){
try{
if(state.user)localStorage.setItem(COOKIE_AUTH,JSON.stringify(state.user));
else localStorage.removeItem(COOKIE_AUTH);
}catch(e){}
}
function restoreAuthLocal(){
try{
var s=localStorage.getItem(COOKIE_AUTH);
if(s)state.user=JSON.parse(s);
}catch(e){}
}
`;
