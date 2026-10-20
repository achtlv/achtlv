export const PLAYLISTS_SCRIPT = String.raw`
// ==================== 歌单 / 历史列表 / 收藏 ====================
function songKey(s){
if(!s)return '';
if(s.external)return 'ext:'+String(s.url||'').trim();
return 'id:'+String(s.id||'').trim();
}

function genPlId(){
return 'pl_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
}

function defaultPlaylistName(){
var base='新建歌单';
var names={};
(state.playlists||[]).forEach(function(p){names[p.name]=1;});
if(!names[base])return base;
for(var i=1;i<1000;i++){
var n=base+'（'+i+'）';
if(!names[n])return n;
}
return base+'（'+Date.now()+'）';
}

function createPlaylist(name,songs){
var pl={
id:genPlId(),
name:name||defaultPlaylistName(),
songs:songs?songs.slice():[],
updatedAt:Date.now(),
createdAt:Date.now()
};
state.playlists.unshift(pl);
markLocalChange();
savePlaylistsLocal();
return pl;
}

function getPlaylist(id){
for(var i=0;i<(state.playlists||[]).length;i++){
if(state.playlists[i].id===id)return state.playlists[i];
}
return null;
}

function markLocalChange(){
state.lastLocalChangeAt=Date.now();
if(typeof notifyDataChanged==='function')notifyDataChanged('playlists');
}

function savePlaylistsLocal(){
try{localStorage.setItem(COOKIE_PLAYLISTS,JSON.stringify(state.playlists||[]));}catch(e){}
}
function restorePlaylistsLocal(){
try{
var s=localStorage.getItem(COOKIE_PLAYLISTS);
if(s)state.playlists=JSON.parse(s)||[];
}catch(e){state.playlists=[];}
}

function saveSettingsLocal(){
try{
localStorage.setItem(COOKIE_SETTINGS,JSON.stringify({
theme:state.theme,
mode:state.mode,
syncPlaylists:state.syncPlaylists,
syncSettings:state.syncSettings
}));
}catch(e){}
}
function restoreSettingsLocal(){
try{
var s=localStorage.getItem(COOKIE_SETTINGS);
if(!s)return;
var o=JSON.parse(s);
if(o.theme)state.theme=o.theme;
if(o.mode)state.mode=o.mode;
if(typeof o.syncPlaylists==='boolean')state.syncPlaylists=o.syncPlaylists;
if(typeof o.syncSettings==='boolean')state.syncSettings=o.syncSettings;
}catch(e){}
}

function applyTheme(theme){
state.theme=theme||'green';
if(theme&&theme!=='green')document.documentElement.setAttribute('data-theme',theme);
else document.documentElement.removeAttribute('data-theme');
saveSettingsLocal();
if(typeof notifyDataChanged==='function')notifyDataChanged('settings');
}

function isSongFavorited(song){
if(!song)return false;
var k=songKey(song);
for(var i=0;i<(state.playlists||[]).length;i++){
var songs=state.playlists[i].songs||[];
for(var j=0;j<songs.length;j++){
if(songKey(songs[j])===k)return true;
}
}
return false;
}

function addSongToPlaylist(plId,song,toTop){
var pl=getPlaylist(plId);
if(!pl||!song)return;
var k=songKey(song);
pl.songs=pl.songs.filter(function(s){return songKey(s)!==k;});
var copy={
id:song.id,name:song.name,artist:song.artist,pic:song.pic||'',
duration:song.duration||0,external:!!song.external,url:song.url||'',format:song.format||''
};
if(toTop!==false)pl.songs.unshift(copy);
else pl.songs.push(copy);
pl.updatedAt=Date.now();
markLocalChange();
savePlaylistsLocal();
updateFavBtn();
}

function removeSongFromPlaylist(plId,song){
var pl=getPlaylist(plId);
if(!pl||!song)return;
var k=songKey(song);
pl.songs=(pl.songs||[]).filter(function(s){return songKey(s)!==k;});
pl.updatedAt=Date.now();
markLocalChange();
savePlaylistsLocal();
updateFavBtn();
}

function updateFavBtn(){
var btn=$('favBtn');
if(!btn)return;
var song=(state.playlist&&state.current>=0)?state.playlist[state.current]:null;
var on=!!song&&isSongFavorited(song);
btn.innerHTML=on?ICON.starFilled:ICON.star;
btn.classList.toggle('fav-on',!!on);
}

function pushListHistory(){
// 保存当前列表到历史，最多保留 2 个历史 + 当前 = 3
var snap={
playlist:state.playlist.map(function(s){
return {id:s.id,name:s.name,artist:s.artist,pic:s.pic||'',duration:s.duration||0,external:!!s.external,url:s.url||'',format:s.format||''};
}),
current:state.current,
at:Date.now()
};
state.listHistory=state.listHistory||[];
state.listHistory.unshift(snap);
if(state.listHistory.length>2)state.listHistory=state.listHistory.slice(0,2);
try{localStorage.setItem(COOKIE_LIST_HIST,JSON.stringify(state.listHistory));}catch(e){}
}

function restoreListHistory(){
try{
var s=localStorage.getItem(COOKIE_LIST_HIST);
if(s)state.listHistory=JSON.parse(s)||[];
}catch(e){state.listHistory=[];}
}

function replacePlaylistFromSongs(songs,startIndex){
pushListHistory();
state.playlist=songs.map(function(s){
return {id:s.id,name:s.name,artist:s.artist,pic:s.pic||'',duration:s.duration||0,external:!!s.external,url:s.url||'',format:s.format||''};
});
state.current=-1;
savePlaylist();
render();
if(typeof startIndex==='number'&&startIndex>=0&&startIndex<state.playlist.length){
playIndex(startIndex);
}
}

var plSortMode='time'; // 默认按最近修改
var viewingPlId=null;
var viewingPlEditingOrder=false;

function sortPlaylists(mode){
// mode: 'alpha' | 'time'
if(!state.playlists)state.playlists=[];
if(mode==='alpha'){
state.playlists.sort(function(a,b){
return String(a.name||'').localeCompare(String(b.name||''),'zh-CN');
});
}else{
state.playlists.sort(function(a,b){
return (b.updatedAt||0)-(a.updatedAt||0);
});
}
}

function applyPlaylistSort(){
sortPlaylists(plSortMode||'time');
}

function togglePlaylistSort(){
plSortMode=(plSortMode==='time')?'alpha':'time';
applyPlaylistSort();
savePlaylistsLocal();
if(typeof markLocalChange==='function'){/* 仅排序不强制同步 */}
renderPlaylistsPage();
toast(plSortMode==='alpha'?'按名称排序':'按最近修改排序');
}

function renderPlaylistsPage(){
var box=$('plList');
if(!box)return;
box.innerHTML='';
applyPlaylistSort();
var list=(state.playlists||[]).slice();
if(!list.length){
box.innerHTML='<div class="sheet-empty">暂无歌单，点击右上角新建</div>';
return;
}
setTimeout(function(){if(typeof ensurePlaylistCovers==='function')ensurePlaylistCovers();},50);

list.forEach(function(pl){
var row=document.createElement('div');
row.className='pl-item';
var coverUrl=(pl.songs&&pl.songs[0]&&pl.songs[0].pic)||'';
if(coverUrl){
var img=document.createElement('img');
img.className='pl-cover';
img.src=coverUrl;
img.alt='';
row.appendChild(img);
}else{
var ph=document.createElement('div');
ph.className='pl-cover-ph';
ph.innerHTML='<svg viewBox="0 0 24 24"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>';
row.appendChild(ph);
}
var info=document.createElement('div');
info.className='pl-info';
info.innerHTML='<div class="pl-name"></div><div class="pl-meta"></div>';
info.querySelector('.pl-name').textContent=pl.name||'未命名';
info.querySelector('.pl-meta').textContent=(pl.songs?pl.songs.length:0)+' 首';
row.appendChild(info);
row.addEventListener('click',function(){openPlaylistDetail(pl.id);});
box.appendChild(row);
});
}

function openPlaylistDetail(id){
viewingPlId=id;
var pl=getPlaylist(id);
if(!pl)return;
$('pagePlaylists').style.display='none';
$('pagePlaylists').classList.remove('page-active');
var det=$('pagePlaylistDetail');
det.style.display='flex';
det.classList.add('page-active');
$('plDetailTitle').textContent=pl.name||'歌单';
try{
var sortBtn=$('plDetailSort');
if(sortBtn){
sortBtn.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>';
sortBtn.title=viewingPlEditingOrder?'完成排序':'自定义排序';
sortBtn.setAttribute('aria-label',viewingPlEditingOrder?'完成排序':'自定义排序');
if(viewingPlEditingOrder)sortBtn.classList.add('on');else sortBtn.classList.remove('on');
}
if($('plDetailRename'))$('plDetailRename').innerHTML=(typeof ICON!=='undefined'&&ICON.edit)||'<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
}catch(e){}
var box=$('plDetailList');
box.innerHTML='';
var songs=pl.songs||[];
songs.forEach(function(song,idx){
var row=document.createElement('div');
row.className='pl-song-row';
var info=document.createElement('div');
info.className='pl-song-info';
info.innerHTML='<div class="pl-song-name"></div><div class="pl-song-artist"></div>';
info.querySelector('.pl-song-name').textContent=song.name||'未知';
info.querySelector('.pl-song-artist').textContent=song.artist||'';
row.appendChild(info);
var acts=document.createElement('div');
acts.className='pl-song-actions';
function mkBtn(html,title,fn,disabled){
var b=document.createElement('button');
b.className='icon-btn';
b.type='button';
b.innerHTML=html;
b.title=title;
b.setAttribute('aria-label',title);
if(disabled)b.disabled=true;
b.addEventListener('click',function(e){
e.stopPropagation();
if(disabled)return;
fn();
});
return b;
}
if(viewingPlEditingOrder){
acts.appendChild(mkBtn((typeof ICON!=='undefined'&&ICON.arrowUp)||'↑','上移',function(){
if(idx<=0)return;
var arr=pl.songs;
var t=arr[idx-1];arr[idx-1]=arr[idx];arr[idx]=t;
pl.updatedAt=Date.now();
if(typeof markLocalChange==='function')markLocalChange();
savePlaylistsLocal();
if(typeof notifyDataChanged==='function')notifyDataChanged('playlists');
openPlaylistDetail(id);
},idx===0));
acts.appendChild(mkBtn((typeof ICON!=='undefined'&&ICON.arrowDown)||'↓','下移',function(){
if(idx>=songs.length-1)return;
var arr=pl.songs;
var t=arr[idx+1];arr[idx+1]=arr[idx];arr[idx]=t;
pl.updatedAt=Date.now();
if(typeof markLocalChange==='function')markLocalChange();
savePlaylistsLocal();
if(typeof notifyDataChanged==='function')notifyDataChanged('playlists');
openPlaylistDetail(id);
},idx===songs.length-1));
}else{
acts.appendChild(mkBtn(ICON.play,'播放',function(){playSongFromPlaylist(song);}));
acts.appendChild(mkBtn(ICON.add,'下一首播放',function(){insertSongNext(song);toast('已加入下一首');}));
acts.appendChild(mkBtn(ICON.del,'从歌单删除',function(){
if(!confirm('确定从歌单中删除「'+(song.name||'该歌曲')+'」？'))return;
removeSongFromPlaylist(id,song);
openPlaylistDetail(id);
}));
}
row.appendChild(acts);
box.appendChild(row);
});
}


function closePlaylistDetail(){
try{if(typeof blurControl==='function')blurControl(document.activeElement);else if(document.activeElement)document.activeElement.blur();}catch(e){}
viewingPlEditingOrder=false;
viewingPlId=null;
$('pagePlaylistDetail').style.display='none';
$('pagePlaylistDetail').classList.remove('page-active');
$('pagePlaylists').style.display='';
$('pagePlaylists').classList.add('page-active');
renderPlaylistsPage();
}

function insertSongNext(song){
if(!song)return;
var copy={
id:song.id,name:song.name,artist:song.artist,pic:song.pic||'',
duration:song.duration||0,external:!!song.external,url:song.url||'',format:song.format||''
};
var k=songKey(copy);
// 若已在列表中，先移除再插入
state.playlist=state.playlist.filter(function(s){return songKey(s)!==k;});
if(state.current<0||!state.playlist.length){
state.playlist.unshift(copy);
state.current=0;
}else{
state.playlist.splice(state.current+1,0,copy);
}
savePlaylist();
render();
}

function playSongFromPlaylist(song){
if(!song)return;
var copy={
id:song.id,name:song.name,artist:song.artist,pic:song.pic||'',
duration:song.duration||0,external:!!song.external,url:song.url||'',format:song.format||''
};
var k=songKey(copy);
if(state.current>=0&&state.playlist.length){
// 插入到下一首并播放
state.playlist=state.playlist.filter(function(s){return songKey(s)!==k;});
state.playlist.splice(state.current+1,0,copy);
savePlaylist();
playIndex(state.current+1);
}else{
state.playlist=state.playlist.filter(function(s){return songKey(s)!==k;});
state.playlist.unshift(copy);
savePlaylist();
playIndex(0);
}
}

function playEntirePlaylist(plId){
var pl=getPlaylist(plId);
if(!pl||!pl.songs||!pl.songs.length){toast('歌单为空');return;}
replacePlaylistFromSongs(pl.songs,0);
toast('已开始播放「'+(pl.name||'歌单')+'」');
}

function renderMePage(){
var label=$('meUserLabel');
var loginBtn=$('meLoginBtn');
var logoutBtn=$('meLogoutBtn');
var syncBtn=$('meSyncBtn');
var changeBtn=$('meChangePassBtn');
var syncOpts=$('meSyncOpts');
if(state.user){
label.textContent='已登录：'+state.user.username;
loginBtn.style.display='none';
if(logoutBtn)logoutBtn.style.display='';
if(syncBtn)syncBtn.style.display='';
if(changeBtn)changeBtn.style.display='';
if(syncOpts)syncOpts.style.display='';
if($('syncPlaylists'))$('syncPlaylists').checked=!!state.syncPlaylists;
if($('syncSettings'))$('syncSettings').checked=!!state.syncSettings;
}else{
label.textContent='未登录';
loginBtn.style.display='';
if(logoutBtn)logoutBtn.style.display='none';
if(syncBtn)syncBtn.style.display='none';
if(changeBtn)changeBtn.style.display='none';
if(syncOpts)syncOpts.style.display='none';
}
document.querySelectorAll('.theme-dot').forEach(function(dot){
dot.classList.toggle('active',dot.getAttribute('data-theme')===(state.theme||'green'));
});
}

function switchTab(tab){
if(window.__pendingTab){var p=window.__pendingTab;window.__pendingTab=null;if(!tab)tab=p;}

if(!tab)return;
state.tab=tab;
var map={player:'pagePlayer',playlists:'pagePlaylists',me:'pageMe'};
Object.keys(map).forEach(function(t){
var el=$(map[t]);
if(!el)return;
var on=(t===tab);
el.classList.toggle('page-active',on);
el.style.display=on?'flex':'none';
});
var det=$('pagePlaylistDetail');
if(det){
if(tab!=='playlists'){det.style.display='none';det.classList.remove('page-active');}
}
document.querySelectorAll('.tab-item').forEach(function(btn){
btn.classList.toggle('active',btn.getAttribute('data-tab')===tab);
});
if(tab==='playlists'&&typeof renderPlaylistsPage==='function')renderPlaylistsPage();
if(tab==='me'&&typeof renderMePage==='function')renderMePage();
if(tab==='player'&&typeof render==='function'&&state._booted){
try{render();}catch(e){}
}
}

var plCoverTimer=null;
function ensurePlaylistCovers(){
var list=state.playlists||[];
var need=[];
list.forEach(function(pl){
if(!pl||!pl.songs||!pl.songs.length)return;
var top=pl.songs[0];
if(top.pic)return;
need.push(pl);
});
if(!need.length){
if(plCoverTimer){clearInterval(plCoverTimer);plCoverTimer=null;}
return;
}
if(!plCoverTimer){
plCoverTimer=setInterval(function(){ensurePlaylistCovers();},5000);
}
need.forEach(function(pl){
var song=pl.songs[0];
if(!song||song.external||!song.id)return;
(async function(){
try{
var cached='';
if(typeof getCachedCover==='function'){
try{cached=await getCachedCover(song.id);}catch(e){}
}
if(cached){
song.pic=cached;
savePlaylistsLocal();
if(typeof renderPlaylistsPage==='function')renderPlaylistsPage();
return;
}
var info=await post('/api/getSongInfo',{id:song.id});
var m=typeof extractInfo==='function'?extractInfo(info):null;
if(m&&m.pic){
song.pic=m.pic;
if(typeof saveCoverToCache==='function')await saveCoverToCache(song.id,m.pic);
savePlaylistsLocal();
if(typeof notifyDataChanged==='function')notifyDataChanged('playlists');
if(typeof renderPlaylistsPage==='function')renderPlaylistsPage();
}
}catch(e){}
})();
});
}

if(typeof __bindTabBar==='function')__bindTabBar();
if(window.__pendingTab&&typeof switchTab==='function'){var _t=window.__pendingTab;window.__pendingTab=null;switchTab(_t);}
`;
