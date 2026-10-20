export const LYRIC_SCRIPT = String.raw`// ==================== 歌词解析 ====================
function parseRichLyric(raw){
if(!raw||typeof raw!=='string')return '';
if(raw.indexOf('{"t":')===-1&&raw.indexOf('"c":[')===-1)return raw;

var lines=raw.split(LF);
var credits=[];
var lyrics=[];

for(var i=0;i<lines.length;i++){
var line=lines[i];
var trimmed=line.split(CR).join('').trim();
if(!trimmed)continue;

if(trimmed.charAt(0)==='{'&&trimmed.indexOf('"c"')!==-1){
try{
var obj=JSON.parse(trimmed);
if(obj&&Array.isArray(obj.c)){
var text='';
for(var j=0;j<obj.c.length;j++){
if(obj.c[j]&&typeof obj.c[j].tx==='string'){
text+=obj.c[j].tx;
}
}
text=text.trim();
if(text&&credits.indexOf(text)===-1)credits.push(text);
}
}catch(e){}
continue;
}
lyrics.push(line.split(CR).join(''));
}

var out='';
if(credits.length){
out+=credits.join(LF);
if(lyrics.length)out+=LF+LF;
}
out+=lyrics.join(LF);
return out;
}

function parseTimeTagContent(content){
if(!content)return null;
content=String(content).trim();
// 支持 [mm:ss] [mm:ss.xx] [mm:ss.xxx] [mm:ss:xx]（冒号分秒）[h:mm:ss] [h:mm:ss.xx]
var parts=content.split(':');
if(parts.length<2||parts.length>3)return null;

function toMs(fracStr){
if(!fracStr)return 0;
if(!isAllDigits(fracStr))return -1;
// 1位→*100ms, 2位→*10ms, 3位→ms
if(fracStr.length===1)return parseInt(fracStr,10)*100;
if(fracStr.length===2)return parseInt(fracStr,10)*10;
return parseInt(fracStr.substring(0,3),10);
}

if(parts.length===2){
// mm:ss 或 mm:ss.xx
var minStr=parts[0];
var rest=parts[1];
if(!isAllDigits(minStr))return null;
var dot=rest.indexOf('.');
var secStr=dot===-1?rest:rest.substring(0,dot);
var msStr=dot===-1?'':rest.substring(dot+1);
if(!isAllDigits(secStr))return null;
if(msStr&&!isAllDigits(msStr))return null;
var min=parseInt(minStr,10);
var sec=parseInt(secStr,10);
if(!isFinite(min)||!isFinite(sec)||sec>=60)return null;
var ms=toMs(msStr);
if(ms<0)return null;
return min*60+sec+ms/1000;
}

// parts.length===3 → mm:ss:cs 或 h:mm:ss(.xx)
var a=parts[0], b=parts[1], c=parts[2];
if(!isAllDigits(a)||!isAllDigits(b))return null;
var cDot=c.indexOf('.');
var cMain=cDot===-1?c:c.substring(0,cDot);
var cFrac=cDot===-1?'':c.substring(cDot+1);
if(!isAllDigits(cMain))return null;
if(cFrac&&!isAllDigits(cFrac))return null;

var n0=parseInt(a,10), n1=parseInt(b,10), n2=parseInt(cMain,10);
if(!isFinite(n0)||!isFinite(n1)||!isFinite(n2))return null;

// 若第三段只有 1～3 位且前两段像 mm:ss（n0 较小、n1<60），按 mm:ss:cs 解析
if(cDot===-1&&cMain.length<=3&&n1<60&&n0<180){
var fracMs=toMs(cMain);
if(fracMs<0)return null;
return n0*60+n1+fracMs/1000;
}

// 否则按 h:mm:ss 或 h:mm:ss.xx
if(n1>=60||n2>=60)return null;
var ms2=toMs(cFrac);
if(ms2<0)return null;
return n0*3600+n1*60+n2+ms2/1000;
}

function stripTimeTags(line){
var tags=[];
var j=0;
while(j<line.length){
var lb=line.indexOf('[',j);
if(lb===-1)break;
var rb=line.indexOf(']',lb);
if(rb===-1)break;
var content=line.substring(lb+1,rb);
var t=parseTimeTagContent(content);
if(t===null){j=rb+1;continue;}
tags.push({time:t,start:lb,end:rb+1});
j=rb+1;
}
var pure=line;
if(tags.length){
for(var k=tags.length-1;k>=0;k--){
pure=pure.substring(0,tags[k].start)+pure.substring(tags[k].end);
}
pure=pure.trim();
}
return {tags:tags,pure:pure};
}

function parseLyricLines(text){
var rawLines=String(text||'').split(LF);
var result=[];
var hasTime=false;
var anyMultiTag=false;
for(var i=0;i<rawLines.length;i++){
var line=rawLines[i].split(CR).join('');
if(!line)continue;
var parsed=stripTimeTags(line);
if(!parsed.pure)continue;
if(parsed.tags.length===0){
result.push({time:null,text:parsed.pure});
}else{
hasTime=true;
if(parsed.tags.length>1)anyMultiTag=true;
for(var k=0;k<parsed.tags.length;k++){
result.push({time:parsed.tags[k].time,text:parsed.pure});
}
}
}
if(hasTime&&anyMultiTag){
result.sort(function(a,b){
var ta=a.time===null?-1:a.time;
var tb=b.time===null?-1:b.time;
return ta-tb;
});
}
return {lines:result,hasTime:hasTime};
}

function pickLyricField(obj,keys){
if(!obj||typeof obj!=='object')return '';
for(var i=0;i<keys.length;i++){
var v=obj[keys[i]];
if(!v)continue;
if(typeof v==='string'&&v.trim())return v;
if(typeof v==='object'&&typeof v.lyric==='string'&&v.lyric.trim())return v.lyric;
}
return '';
}

function extractLyricMulti(r){
if(!r)return {main:'',trans:'',roma:''};
if(typeof r==='string')return {main:parseRichLyric(r),trans:'',roma:''};

var candidates=[r,r.data,r.result,r.data&&r.data.data,r.result&&r.result.data];
var main='',trans='',roma='';
for(var i=0;i<candidates.length;i++){
var c=candidates[i];
if(!c||typeof c!=='object')continue;
if(!main)main=pickLyricField(c,['lrc','lyric','lyrics','lrcText']);
if(!trans)trans=pickLyricField(c,['tlyric','translation','trans']);
if(!roma)roma=pickLyricField(c,['romalrc','roma','romaji','klyric']);
}
if(!main){
var legacy=[
r.lyric,r.lyrics,r.lrcText,r.lrc,
r.data&&r.data.lyric,r.data&&r.data.lyrics,r.data&&r.data.lrcText,r.data&&r.data.lrc,
r.data&&r.data.data&&r.data.data.lyric,
r.data&&r.data.data&&r.data.data.lrc,
r.result&&r.result.lyric,
r.result&&r.result.lrc
];
for(var i=0;i<legacy.length;i++){
var v=legacy[i];
if(!v)continue;
if(typeof v==='string'&&v.trim()){main=v;break;}
if(typeof v==='object'&&typeof v.lyric==='string'&&v.lyric.trim()){main=v.lyric;break;}
}
}
var mainP=parseRichLyric(main),transP=parseRichLyric(trans),romaP=parseRichLyric(roma);
// 仅时间轴、无有效正文的翻译/音译视为空
if(transP&&!hasMeaningfulLyricText(transP))transP='';
if(romaP&&!hasMeaningfulLyricText(romaP))romaP='';
return {main:mainP,trans:transP,roma:romaP};
}

function attachText(mainLines,otherLines,key){
for(var i=0;i<mainLines.length;i++)mainLines[i][key]='';
if(!otherLines.length)return;
var sorted=[];
for(var i=0;i<otherLines.length;i++){
if(otherLines[i].time!==null)sorted.push(otherLines[i]);
}
sorted.sort(function(a,b){return a.time-b.time});
if(!sorted.length)return;
for(var i=0;i<mainLines.length;i++){
var m=mainLines[i];
if(m.time===null)continue;
var best=null,bestDiff=0.35;
for(var j=0;j<sorted.length;j++){
var t=sorted[j].time;
if(t>m.time+0.35)break;
var d=Math.abs(t-m.time);
if(d<bestDiff){bestDiff=d;best=sorted[j];}
}
if(best)m[key]=best.text;
}
}

function buildLyricView(){
var parsed=parseLyricLines(state.lyric||'');
var mainLines=parsed.lines;
var transLines=state.lyricTrans?parseLyricLines(state.lyricTrans).lines:[];
var romaLines=state.lyricRoma?parseLyricLines(state.lyricRoma).lines:[];

attachText(mainLines,transLines,'trans');
attachText(mainLines,romaLines,'roma');

state.lyricLines=mainLines;
state.lyricHasTime=parsed.hasTime;
state.lyricCurrent=-1;
state.lyricUserScrolled=false;
if(state._lyricScrollTimer){clearTimeout(state._lyricScrollTimer);state._lyricScrollTimer=null;}

var box=$('lyricText');
box.innerHTML='';

function isPlaceholderText(t){
if(!t)return true;
var s=String(t).trim();
return s===''||s==='暂无歌词'||s==='播放以获取歌词'||s==='正在加载歌词...'||s==='外部音源，暂无歌词'||s==='视频音源，暂无歌词';
}

var showEmpty=!mainLines.length||state.lyricLoading||(!parsed.hasTime&&mainLines.length===1&&isPlaceholderText(mainLines[0].text));
if(showEmpty){
var d=document.createElement('div');
d.className='line line-empty';
if(state.lyricLoading)d.className+=' loading';
var bodyEl=document.createElement('div');
bodyEl.className='line-body';
var dm=document.createElement('div');
dm.className='line-main';
if(state.lyricLoading){
dm.textContent='正在加载歌词...';
}else{
var msg='';
if(mainLines.length)msg=mainLines[0].text||'';
else msg=state.lyric||'';
if(isPlaceholderText(msg)){
// 列表里有歌但还没真正播放取词
if(state.playlist&&state.playlist.length&&!state.audioUrl){
msg='播放以获取歌词';
}else{
msg=msg||'暂无歌词';
if(msg==='暂无歌词'||!msg)msg='暂无歌词';
}
}
dm.textContent=msg;
}
bodyEl.appendChild(dm);
d.appendChild(bodyEl);
box.appendChild(d);
updateLyricToolbar();
return;
}

for(var i=0;i<mainLines.length;i++){
var line=mainLines[i];
var el=document.createElement('div');
el.className='line';
el.setAttribute('data-i',String(i));
var hasTime=line.time!==null&&line.time!==undefined;
if(!hasTime)el.className+=' no-time';

if(hasTime){
var jumpBtn=document.createElement('button');
jumpBtn.className='line-jump';
jumpBtn.type='button';
jumpBtn.setAttribute('data-time',String(line.time));
jumpBtn.setAttribute('aria-label','跳转到此句');
jumpBtn.innerHTML='<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
el.appendChild(jumpBtn);
}else{
var jumpPh=document.createElement('span');
jumpPh.className='line-jump ph';
el.appendChild(jumpPh);
}

var bodyEl=document.createElement('div');
bodyEl.className='line-body';

var mainEl=document.createElement('div');
mainEl.className='line-main';
mainEl.textContent=line.text;
bodyEl.appendChild(mainEl);

if(line.trans&&state.transEnabled){
var te=document.createElement('div');
te.className='line-trans';
te.textContent=line.trans;
bodyEl.appendChild(te);
}
if(line.roma&&state.romaEnabled){
var re=document.createElement('div');
re.className='line-roma';
re.textContent=line.roma;
bodyEl.appendChild(re);
}
el.appendChild(bodyEl);

var timeEl=document.createElement('span');
timeEl.className='line-time';
if(hasTime){
timeEl.textContent=fmt(line.time);
}else{
timeEl.textContent='';
}
el.appendChild(timeEl);

box.appendChild(el);
}
updateLyricToolbar();
}

function hasMeaningfulLyricText(text){
if(!text||!String(text).trim())return false;
var parsed=parseLyricLines(String(text));
var lines=parsed&&parsed.lines?parsed.lines:[];
for(var i=0;i<lines.length;i++){
var t=(lines[i].text||'').trim();
if(t&&t!=='暂无歌词')return true;
}
// 无时间轴纯文本
var pure=String(text).replace(/\[[^\]]*\]/g,' ').replace(/\s+/g,' ').trim();
return pure.length>0&&pure!=='暂无歌词';
}
function updateLyricToolbar(){
var hasTrans=hasMeaningfulLyricText(state.lyricTrans);
var hasRoma=hasMeaningfulLyricText(state.lyricRoma);
var tb=$('transBtn');
var rb=$('romaBtn');
if(tb){
if(hasTrans)tb.classList.remove('hidden');else tb.classList.add('hidden');
if(hasTrans&&state.transEnabled)tb.classList.add('on');else tb.classList.remove('on');
}
if(rb){
if(hasRoma)rb.classList.remove('hidden');else rb.classList.add('hidden');
if(hasRoma&&state.romaEnabled)rb.classList.add('on');else rb.classList.remove('on');
}
if(!hasTrans)state.transEnabled=false;
if(!hasRoma)state.romaEnabled=false;
}

function updateLyricScroll(force){
if(!state.lyricHasTime)return;
if(!state.lyricLines.length)return;
var t=audio.currentTime||0;
var cur=-1;
for(var i=0;i<state.lyricLines.length;i++){
var lt=state.lyricLines[i].time;
if(lt===null)continue;
if(lt<=t)cur=i;
else break;
}
if(cur===state.lyricCurrent&&!force)return;
state.lyricCurrent=cur;

var box=$('lyricText');
var lines=box.children;
for(var i=0;i<lines.length;i++){
if(i===cur)lines[i].classList.add('current');
else lines[i].classList.remove('current');
}
if(cur<0)return;
if(state.lyricUserScrolled)return;
var el=lines[cur];
if(!el)return;
var outer=$('lyricScroll')||$('lyricBox');
var outerRect=outer.getBoundingClientRect();
var elRect=el.getBoundingClientRect();
var target=outer.scrollTop+(elRect.top-outerRect.top)-outer.clientHeight/2+el.clientHeight/2;
if(target<0)target=0;
try{outer.scrollTo({top:target,behavior:'smooth'})}
catch(e){outer.scrollTop=target}
}

function markLyricUserScrolled(){
if(!state.lyricHasTime)return;
state.lyricUserScrolled=true;
if(state._lyricScrollTimer)clearTimeout(state._lyricScrollTimer);
state._lyricScrollTimer=setTimeout(function(){
state._lyricScrollTimer=null;
state.lyricUserScrolled=false;
updateLyricScroll(true);
},LYRIC_RESUME_DELAY);
}

`;
