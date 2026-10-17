export const STYLE = `<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{
--primary:#386A20;--on-primary:#FFFFFF;--primary-container:#B7F397;--on-primary-container:#042100;
--surface:#F7FBF1;--surface-container:#ECEFE5;--surface-container-high:#E6E9DF;--surface-container-highest:#E0E4DA;
--on-surface:#191D17;--on-surface-variant:#43483E;--outline:#73796D;--outline-variant:#C3C8BA;
--scrim:rgba(0,0,0,.35);--shadow:rgba(56,106,32,.22);--shadow-2:rgba(56,106,32,.35);
--hover:rgba(56,106,32,.08);--active:rgba(56,106,32,.14);
--danger:#B3261E;--on-danger:#FFFFFF;
}
@media (prefers-color-scheme: dark){
:root{
--primary:#9CD67D;--on-primary:#0A3900;--primary-container:#215200;--on-primary-container:#B7F397;
--surface:#11140F;--surface-container:#1D211A;--surface-container-high:#272B24;--surface-container-highest:#32362E;
--on-surface:#E1E4DA;--on-surface-variant:#C3C8BA;--outline:#8D9386;--outline-variant:#43483E;
--scrim:rgba(0,0,0,.6);--shadow:rgba(0,0,0,.4);--shadow-2:rgba(0,0,0,.55);
--hover:rgba(225,228,218,.08);--active:rgba(225,228,218,.14);
--danger:#F2B8B5;--on-danger:#601410;
}
}
html,body{height:100%}
body{
font-family:'Roboto','Google Sans',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
background:var(--surface);color:var(--on-surface);overflow:hidden;
-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
transition:background-color .3s,color .3s;
}
.app{height:100dvh;display:flex;flex-direction:column;max-width:520px;margin:0 auto;
padding:env(safe-area-inset-top) 16px env(safe-area-inset-bottom);width:100%}
header{position:relative;padding:22px 46px 10px;flex-shrink:0;text-align:center}
.meta{min-width:0;display:flex;flex-direction:column;align-items:center}
.meta h1{font-size:20px;font-weight:500;line-height:1.3;white-space:nowrap;overflow:hidden;
text-overflow:ellipsis;color:var(--on-surface);max-width:100%}
.meta p{font-size:13px;color:var(--on-surface-variant);white-space:nowrap;overflow:hidden;
text-overflow:ellipsis;margin-top:2px;display:flex;align-items:center;gap:8px;justify-content:center;max-width:100%}
.meta p .artist-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#shareBtn{position:absolute;top:18px;right:0}
.badge{display:inline-block;padding:1px 8px;border-radius:9px;font-size:11px;font-weight:500;
background:color-mix(in srgb,var(--primary) 15%,transparent);color:var(--primary);
vertical-align:middle;line-height:1.5;flex-shrink:0;white-space:nowrap}
.badge.ext{background:color-mix(in srgb,var(--outline) 22%,transparent);color:var(--on-surface-variant)}
.retry-btn{width:20px;height:20px;border-radius:50%;border:none;padding:0;
background:color-mix(in srgb,var(--primary) 15%,transparent);color:var(--primary);
display:flex;align-items:center;justify-content:center;cursor:pointer;
flex-shrink:0;transition:background .18s,transform .15s}
.retry-btn:hover{background:color-mix(in srgb,var(--primary) 25%,transparent)}
.retry-btn:active{transform:scale(.92)}
.retry-btn:disabled{cursor:default;opacity:.7}
.retry-btn svg{width:12px;height:12px;fill:currentColor;pointer-events:none}
.retry-btn.spinning svg{animation:retry-spin .8s linear infinite}
@keyframes retry-spin{to{transform:rotate(360deg)}}
.dlg-retry{width:32px;height:32px;border-radius:50%;border:none;padding:0;
background:color-mix(in srgb,var(--primary) 15%,transparent);color:var(--primary);
display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;
transition:background .18s,transform .15s}
.dlg-retry:hover{background:color-mix(in srgb,var(--primary) 25%,transparent)}
.dlg-retry:active{transform:scale(.92)}
.dlg-retry:disabled{cursor:default;opacity:.7}
.dlg-retry svg{width:17px;height:17px;fill:currentColor;pointer-events:none}
.dlg-retry.spinning svg{animation:retry-spin .8s linear infinite}
.dialog-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px}
.dialog-head h2{margin-bottom:0}
.icon-btn{width:40px;height:40px;border:none;border-radius:50%;background:transparent;
color:var(--on-surface-variant);display:flex;align-items:center;justify-content:center;
cursor:pointer;transition:background .18s,color .18s;flex-shrink:0}
.icon-btn:hover{background:var(--hover);color:var(--on-surface)}
.icon-btn:active{background:var(--active)}
.icon-btn svg{width:22px;height:22px;fill:currentColor;pointer-events:none}
.icon-btn:disabled{opacity:.4;cursor:default;pointer-events:none}
.icon-btn.active{background:color-mix(in srgb,var(--primary) 18%,transparent);color:var(--primary)}
#stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;
position:relative;overflow:hidden;padding:8px 0}
.empty-actions{display:none;flex-direction:row;align-items:center;justify-content:center;
gap:12px;flex-wrap:wrap;max-width:100%;max-height:100%}
.empty-add{display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;
padding:10px 22px;border:1px dashed var(--outline-variant);border-radius:20px;
background:transparent;color:var(--on-surface-variant);cursor:pointer;font-size:14px;
font-family:inherit;transition:all .2s;max-height:100%}
.empty-add:hover,.empty-add:active{border-color:var(--primary);color:var(--primary);
background:color-mix(in srgb,var(--primary) 8%,transparent)}
.empty-add svg{width:20px;height:20px;fill:currentColor}
.cover-box{display:none;height:100%;max-height:340px;aspect-ratio:1;max-width:100%;
border-radius:28px;overflow:hidden;position:relative;cursor:pointer;
background:var(--surface-container-high);
transition:transform .3s}
.cover-box img{width:100%;height:100%;object-fit:cover;display:block}
.cover-fallback{position:absolute;inset:0;display:none;align-items:center;justify-content:center;
color:var(--on-surface-variant)}
.cover-fallback svg{width:80px;height:80px;fill:currentColor;opacity:.55}
.cover-loading{position:absolute;inset:0;display:none;align-items:center;justify-content:center;
background:var(--surface-container-high)}
.cover-loading-spinner{width:38px;height:38px;border-radius:50%;
border:3px solid color-mix(in srgb,var(--primary) 25%,transparent);
border-top-color:var(--primary);animation:spin .8s linear infinite}
.lyric-box{display:none;width:100%;height:100%;overflow:hidden;padding:0;
border-radius:20px;position:relative}
.lyric-scroll{width:100%;height:100%;overflow-y:auto;padding:4px 8px;
scrollbar-width:none;border-radius:20px}
.lyric-scroll::-webkit-scrollbar{display:none}
.lyric-toolbar{display:none;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;
position:absolute;bottom:10px;right:10px;z-index:3;padding:0;pointer-events:auto}
.chip{width:32px;height:32px;padding:0;border-radius:50%;border:1px solid var(--outline-variant);
background:color-mix(in srgb,var(--surface-container-high) 88%,transparent);color:var(--on-surface-variant);
font-size:13px;font-family:inherit;cursor:pointer;transition:all .18s;font-weight:600;
display:flex;align-items:center;justify-content:center;line-height:1;
box-shadow:0 2px 8px var(--shadow);
backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.chip:hover{border-color:var(--outline);color:var(--on-surface)}
.chip.on{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 22%,transparent);
color:var(--primary)}
.chip.hidden{display:none}
.lyric-box #lyricText{font-family:inherit;font-size:15px;line-height:1.75;
color:var(--on-surface-variant);text-align:center;padding:36px 0 48px;width:100%}
.lyric-box .line{padding:6px 0;transition:color .3s;white-space:pre-wrap;word-break:break-word;
display:grid;grid-template-columns:40px minmax(0,1fr) 40px;align-items:flex-start;column-gap:4px;
width:100%;box-sizing:border-box}
.lyric-box .line-jump{width:28px;height:28px;margin:0;padding:0;border:none;justify-self:center;
border-radius:50%;background:transparent;color:var(--outline);cursor:pointer;
display:flex;align-items:center;justify-content:center;opacity:.4;transition:opacity .18s,color .18s,background .18s}
.lyric-box .line-jump:hover,.lyric-box .line-jump:active{opacity:1;color:var(--primary);
background:color-mix(in srgb,var(--primary) 12%,transparent)}
.lyric-box .line-jump svg{width:12px;height:12px;fill:currentColor;pointer-events:none}
.lyric-box .line-jump.ph{visibility:hidden;pointer-events:none;cursor:default}
.lyric-box .line-body{min-width:0;text-align:center;padding:0 2px}
.lyric-box .line-time{justify-self:center;align-self:flex-start;margin-top:4px;
font-size:10px;line-height:1.2;color:var(--outline);font-variant-numeric:tabular-nums;
opacity:.55;user-select:none;white-space:nowrap}
.lyric-box .line.current .line-time{color:var(--primary);opacity:.75}
.lyric-box .line-empty{
display:flex!important;align-items:center;justify-content:center;
width:100%;min-height:min(42vh,240px);padding:24px 20px;
grid-template-columns:none!important;column-gap:0}
.lyric-box .line-empty .line-body{width:100%;text-align:center}
.lyric-box .line.no-time{display:block;text-align:center;grid-template-columns:none}
.lyric-box .line.no-time .line-jump,.lyric-box .line.no-time .line-time{display:none}
.lyric-box .line.no-time .line-body{display:block;width:100%;text-align:center;padding:0 12px}
.lyric-box .line-main{font-size:15px;line-height:1.6}
.lyric-box .line.loading .line-main{color:var(--on-surface-variant);font-style:italic;opacity:.7}
.lyric-box .line-trans{font-size:13.5px;line-height:1.6;margin-top:2px;
color:var(--on-surface-variant);opacity:.72}
.lyric-box .line-roma{font-size:13px;line-height:1.6;margin-top:2px;
color:var(--on-surface-variant);opacity:.6;font-style:italic}
.lyric-box .line.current .line-main{color:var(--primary);font-weight:600;font-size:16px}
.lyric-box .line.current .line-trans{color:var(--primary);opacity:.78}
.lyric-box .line.current .line-roma{color:var(--primary);opacity:.68}
.progress-row{display:flex;align-items:center;gap:10px;padding:6px 4px;flex-shrink:0}
.progress-row span{font-size:12px;color:var(--on-surface-variant);
font-variant-numeric:tabular-nums;min-width:38px}
.progress-row span:first-child{text-align:left}
.progress-row span:last-child{text-align:right}
input[type=range]{-webkit-appearance:none;appearance:none;flex:1;height:6px;border-radius:3px;
background:var(--outline-variant);outline:none;cursor:pointer;border:none;transition:background .2s}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;
background:var(--primary);cursor:pointer;border:none;transition:box-shadow .2s,transform .15s}
input[type=range]:active::-webkit-slider-thumb{box-shadow:0 0 0 8px color-mix(in srgb,var(--primary) 20%,transparent);
transform:scale(1.1)}
input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--primary);
border:none;cursor:pointer;transition:box-shadow .2s}
.controls{display:flex;align-items:center;justify-content:center;gap:20px;padding:10px 0 6px;flex-shrink:0}
.controls .icon-btn{width:54px;height:54px}
.controls .icon-btn svg{width:32px;height:32px}
.controls .icon-btn:disabled{opacity:.3;cursor:default}
.controls .icon-btn:disabled:hover{background:transparent;color:var(--on-surface-variant)}
.play-btn{width:70px;height:70px;border:none;border-radius:50%;background:var(--primary);
color:var(--on-primary);display:flex;align-items:center;justify-content:center;cursor:pointer;
transition:transform .15s,box-shadow .25s,background .3s;
box-shadow:0 4px 16px var(--shadow)}
@media (hover:hover){
.play-btn:hover{box-shadow:0 6px 26px var(--shadow-2)}
}
.play-btn:active{transform:scale(.93)}
.play-btn svg{width:34px;height:34px;fill:currentColor;pointer-events:none}
footer{display:flex;align-items:center;justify-content:space-between;gap:6px;
padding:6px 0 14px;flex-shrink:0}
.text-btn{display:flex;align-items:center;gap:6px;height:40px;padding:0 12px;border:none;
border-radius:20px;background:transparent;color:var(--on-surface-variant);font-size:13px;
font-family:inherit;cursor:pointer;transition:background .18s,color .18s;white-space:nowrap}
.text-btn:hover{background:var(--hover);color:var(--on-surface)}
.text-btn:active{background:var(--active)}
.text-btn svg{width:19px;height:19px;fill:currentColor;pointer-events:none}
.text-btn:focus{outline:none}
.text-btn:focus:not(:focus-visible){background:transparent;color:var(--on-surface-variant)}
.text-btn:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.text-btn.danger{color:var(--danger)}
.text-btn.danger:hover{background:color-mix(in srgb,var(--danger) 12%,transparent)}
.scrim{position:fixed;inset:0;background:var(--scrim);display:none;align-items:center;
justify-content:center;z-index:100;padding:20px;
backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:fadeIn .2s}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.scrim.show{display:flex}
.scrim.bottom{align-items:flex-end;padding:0}
.dialog{background:var(--surface-container-high);border-radius:28px;padding:24px;width:100%;
max-width:440px;animation:pop .22s cubic-bezier(.2,.8,.2,1);
box-shadow:0 16px 48px var(--shadow-2);max-height:calc(100dvh - 40px);overflow-y:auto}
@keyframes pop{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
.dialog h2{font-size:18px;font-weight:500;margin-bottom:16px;color:var(--on-surface)}
.dialog .dialog-text{font-size:14px;color:var(--on-surface-variant);line-height:1.6;word-break:break-all}
.input-row{display:flex;gap:8px;align-items:center}
.input-row input{flex:1;height:48px;padding:0 18px;border-radius:24px;
border:1px solid var(--outline);background:transparent;color:var(--on-surface);
font-size:15px;font-family:inherit;outline:none;transition:border-color .2s,background .2s;min-width:0}
.input-row input:focus{border-color:var(--primary);
background:color-mix(in srgb,var(--primary) 5%,transparent)}
.input-row input::placeholder{color:var(--on-surface-variant)}
.filled-icon{width:48px;height:48px;border-radius:50%;border:none;background:var(--primary);
color:var(--on-primary);display:flex;align-items:center;justify-content:center;cursor:pointer;
flex-shrink:0;transition:box-shadow .2s,opacity .2s,transform .15s}
@media (hover:hover){
.filled-icon:hover{box-shadow:0 0 0 6px color-mix(in srgb,var(--primary) 15%,transparent)}
}
.filled-icon:active{transform:scale(.94)}
.filled-icon:disabled{opacity:.5;cursor:default;box-shadow:none}
.filled-icon svg{width:22px;height:22px;fill:currentColor;pointer-events:none}
.hint{font-size:12px;color:var(--on-surface-variant);margin-top:10px;line-height:1.5}
.found{background:var(--surface-container-highest);border-radius:16px;padding:14px 16px;margin-bottom:4px}
.found-name{font-size:15px;color:var(--on-surface);word-break:break-all}
.found-artist{font-size:13px;color:var(--on-surface-variant);margin-top:5px;word-break:break-all}
.found-meta{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px}
.meta-tag{display:inline-block;padding:3px 10px;border-radius:10px;font-size:11.5px;
font-weight:500;line-height:1.6;white-space:nowrap}
.meta-tag.q{background:color-mix(in srgb,var(--primary) 15%,transparent);color:var(--primary)}
.meta-tag.ext{background:color-mix(in srgb,var(--outline) 22%,transparent);color:var(--on-surface-variant)}
.meta-tag.vid{background:color-mix(in srgb,#7E5700 22%,transparent);color:#7E5700}
@media (prefers-color-scheme: dark){
.meta-tag.vid{background:color-mix(in srgb,#E8C87A 22%,transparent);color:#E8C87A}
}
.meta-tag.warn{background:color-mix(in srgb,#B3261E 18%,transparent);color:var(--danger)}
.dlg-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;flex-wrap:wrap}
.filled-btn{height:40px;padding:0 24px;border-radius:20px;border:none;background:var(--primary);
color:var(--on-primary);font-size:14px;font-weight:500;font-family:inherit;cursor:pointer;
transition:box-shadow .2s,transform .15s}
@media (hover:hover){
.filled-btn:hover{box-shadow:0 0 0 4px color-mix(in srgb,var(--primary) 15%,transparent)}
}
.filled-btn:active{transform:scale(.97)}
.filled-btn.danger{background:var(--danger);color:var(--on-danger)}
.filled-btn.block{display:flex;align-items:center;justify-content:center;width:100%;height:48px;
padding:0 16px;border-radius:16px;font-size:15px}
.sheet{background:var(--surface-container-high);width:100%;max-width:520px;
border-radius:28px 28px 0 0;max-height:75dvh;display:flex;flex-direction:column;
animation:slideUp .26s cubic-bezier(.2,.8,.2,1);padding-bottom:env(safe-area-inset-bottom);
box-shadow:0 -8px 40px var(--shadow-2)}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.sheet-head{display:flex;align-items:center;justify-content:space-between;
padding:18px 12px 10px 18px;flex-shrink:0;gap:8px}
.sheet-head h2{font-size:16px;font-weight:500;color:var(--on-surface);flex:1;min-width:0;
white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sheet-head .head-actions{display:flex;gap:2px;flex-shrink:0}
.sheet-head .head-actions .icon-btn{width:38px;height:38px}
.sheet-head .head-actions .icon-btn svg{width:20px;height:20px}
.sheet-list{overflow-y:auto;padding:0 8px 16px;flex:1;scrollbar-width:thin}
.sheet-list::-webkit-scrollbar{width:6px}
.sheet-list::-webkit-scrollbar-thumb{background:var(--outline-variant);border-radius:3px}
.sheet-empty{text-align:center;color:var(--on-surface-variant);font-size:14px;padding:40px 0}
.song-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:16px;
cursor:pointer;transition:background .15s}
.song-row:hover{background:var(--hover)}
.song-row.playing{background:color-mix(in srgb,var(--primary) 12%,transparent)}
.song-row-info{flex:1;min-width:0}
.song-row-name{font-size:14px;color:var(--on-surface);white-space:nowrap;
overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px}
.song-row-name .name-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.song-row.playing .song-row-name{color:var(--primary);font-weight:500}
.song-row-name .ext-tag{font-size:10px;padding:1px 6px;border-radius:6px;
background:color-mix(in srgb,var(--outline) 22%,transparent);color:var(--on-surface-variant);
font-weight:500;flex-shrink:0;text-transform:uppercase}
.song-row-name .ext-tag.vid{background:color-mix(in srgb,#7E5700 22%,transparent);color:#7E5700}
@media (prefers-color-scheme: dark){
.song-row-name .ext-tag.vid{background:color-mix(in srgb,#E8C87A 22%,transparent);color:#E8C87A}
}
.song-row-artist{font-size:12px;color:var(--on-surface-variant);white-space:nowrap;
overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.song-row-actions{display:flex;gap:2px;flex-shrink:0}
.song-row-move{width:32px;height:32px;border-radius:50%;border:none;background:transparent;
color:var(--on-surface-variant);display:flex;align-items:center;justify-content:center;
cursor:pointer;transition:all .18s;flex-shrink:0}
.song-row-move:hover{background:color-mix(in srgb,var(--primary) 15%,transparent);color:var(--primary)}
.song-row-move:disabled{opacity:.25;cursor:default;background:transparent;color:var(--on-surface-variant)}
.song-row-move svg{width:16px;height:16px;fill:currentColor;pointer-events:none}
.song-row-del{width:36px;height:36px;border-radius:50%;border:none;background:transparent;
color:var(--on-surface-variant);display:flex;align-items:center;justify-content:center;
cursor:pointer;flex-shrink:0;transition:all .18s}
.song-row-del:hover{background:color-mix(in srgb,var(--primary) 18%,transparent);color:var(--primary)}
.song-row-del svg{width:18px;height:18px;fill:currentColor;pointer-events:none}
.song-row-rename{width:36px;height:36px;border-radius:50%;border:none;background:transparent;
color:var(--on-surface-variant);display:flex;align-items:center;justify-content:center;
cursor:pointer;flex-shrink:0;transition:all .18s}
.song-row-rename:hover{background:color-mix(in srgb,var(--primary) 18%,transparent);color:var(--primary)}
.song-row-rename svg{width:18px;height:18px;fill:currentColor;pointer-events:none}
.toast{position:fixed;bottom:110px;left:50%;transform:translateX(-50%) translateY(20px);
background:var(--surface-container-highest);color:var(--on-surface);padding:12px 20px;
border-radius:12px;font-size:14px;opacity:0;transition:all .3s cubic-bezier(.2,.8,.2,1);
pointer-events:none;z-index:200;box-shadow:0 6px 20px var(--shadow-2);max-width:88vw;text-align:center}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.import-toolbar{display:flex;align-items:center;gap:10px;margin-top:10px}
.file-name{font-size:12px;color:var(--on-surface-variant);flex:1;min-width:0;
overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.import-mode{display:flex;gap:8px;margin-top:12px}
.import-mode label{flex:1;display:flex;align-items:center;gap:8px;padding:8px 12px;
border-radius:14px;border:1px solid var(--outline-variant);cursor:pointer;font-size:13px;
color:var(--on-surface-variant);transition:all .18s;user-select:none}
.import-mode label:hover{border-color:var(--outline)}
.import-mode label:has(input:checked){border-color:var(--primary);
background:color-mix(in srgb,var(--primary) 10%,transparent);color:var(--primary);font-weight:500}
.import-mode input[type=radio]{accent-color:var(--primary);margin:0;width:16px;height:16px}
.share-menu{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.quality-loading{text-align:center;color:var(--on-surface-variant);font-size:13px;
padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:12px}
.quality-spinner{width:26px;height:26px;border-radius:50%;
border:3px solid var(--outline-variant);border-top-color:var(--primary);
animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.quality-list{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.quality-item{display:flex;align-items:center;justify-content:space-between;gap:10px;
padding:14px 18px;border-radius:16px;border:1px solid var(--outline-variant);
background:transparent;color:var(--on-surface);font-size:15px;font-family:inherit;
cursor:pointer;transition:all .18s;text-align:left;width:100%}
.quality-item:hover:not(:disabled){border-color:var(--primary);
background:color-mix(in srgb,var(--primary) 8%,transparent)}
.quality-item:active:not(:disabled){transform:scale(.99)}
.quality-item:disabled{opacity:.38;cursor:not-allowed}
.quality-item.current{border-color:var(--primary);
background:color-mix(in srgb,var(--primary) 10%,transparent)}
.quality-label{font-weight:500}
.quality-tag{font-size:11px;padding:2px 8px;border-radius:8px;
background:color-mix(in srgb,var(--primary) 20%,transparent);color:var(--primary);font-weight:500}
.quality-tag.unavailable{background:color-mix(in srgb,var(--outline) 22%,transparent);
color:var(--on-surface-variant)}
@media (min-width:640px){
body{display:flex;align-items:center;justify-content:center;padding:32px;
background:radial-gradient(circle at 50% 0%,color-mix(in srgb,var(--primary) 8%,var(--surface)) 0%,var(--surface) 60%)}
.app{
height:min(calc(100dvh - 64px),860px);
max-width:600px;
background:var(--surface-container);
border-radius:32px;
padding:24px 32px 20px;
box-shadow:0 12px 48px var(--shadow-2);
border:1px solid var(--outline-variant);
margin:0;
}
header{padding:4px 46px 10px}
.meta h1{font-size:22px}
.meta p{font-size:13.5px}
#shareBtn{top:0}
.cover-box{max-height:400px;border-radius:24px}
.controls{gap:24px;padding:14px 0 8px}
.controls .icon-btn{width:58px;height:58px}
.controls .icon-btn svg{width:34px;height:34px}
.play-btn{width:76px;height:76px}
.play-btn svg{width:36px;height:36px}
footer{padding:8px 0 6px}
.toast{bottom:40px}
.sheet{max-width:600px;border-radius:28px;margin:0 auto}
.scrim.bottom{align-items:center;padding:32px}
}
@media (max-width:360px){
.meta h1{font-size:17px}
.controls{gap:14px}
.controls .icon-btn{width:48px;height:48px}
.controls .icon-btn svg{width:28px;height:28px}
.play-btn{width:62px;height:62px}
.play-btn svg{width:30px;height:30px}
.text-btn{padding:0 8px;font-size:12px}
.text-btn svg{width:17px;height:17px}
.sheet-head .head-actions .icon-btn{width:34px;height:34px}
.song-row-move{width:28px;height:28px}
}
</style>`;