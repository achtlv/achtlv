export const BODY_INNER = `<div class="app">
<header>
<button class="icon-btn" id="shareBtn" title="分享" aria-label="分享"></button>
<div class="meta">
<h1 id="title">未在播放</h1>
<p><span class="artist-text" id="artist">—</span><span class="badge" id="qualityBadge" style="display:none"></span><button class="retry-btn" id="retryBtn" style="display:none" aria-label="重新检测音源"></button></p>
</div>
</header>

<div id="stage">
<div class="empty-actions" id="emptyActions">
<button class="empty-add" id="emptyAdd" aria-label="添加歌曲">
<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
<span>添加歌曲</span>
</button>
<button class="empty-add" id="emptyImport" aria-label="导入歌曲">
<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
<span>导入歌曲</span>
</button>
</div>
<div class="cover-box" id="coverBox">
<img id="coverImg" alt="">
<div class="cover-fallback" id="coverFallback">
<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
</div>
<div class="cover-loading" id="coverLoading">
<div class="cover-loading-spinner"></div>
</div>
</div>
<div class="lyric-box" id="lyricBox">
<div class="lyric-scroll" id="lyricScroll">
<div id="lyricText"></div>
</div>
<div class="lyric-toolbar" id="lyricToolbar">
<button class="chip hidden" id="transBtn" title="翻译" aria-label="翻译">译</button>
<button class="chip hidden" id="romaBtn" title="发音" aria-label="发音">あ</button>
</div>
</div>
</div>

<div class="progress-row">
<span id="curTime">0:00</span>
<input type="range" id="seek" min="0" max="1000" value="0" step="1" aria-label="播放进度">
<span id="durTime">0:00</span>
</div>

<div class="controls">
<button class="icon-btn" id="prevBtn" disabled aria-label="上一首"></button>
<button class="play-btn" id="playBtn" aria-label="播放/暂停"></button>
<button class="icon-btn" id="nextBtn" disabled aria-label="下一首"></button>
</div>

<footer>
<button class="text-btn" id="modeBtn"></button>
<button class="text-btn" id="downloadBtn"></button>
<button class="text-btn" id="listBtn"></button>
</footer>
</div>

<div class="scrim" id="addScrim">
<div class="dialog">
<div id="addStage1">
<h2>添加歌曲</h2>
<div class="input-row">
<input id="addInput" placeholder="歌曲 ID / 链接 / 歌名" autocomplete="off" enterkeyhint="go">
<button class="filled-icon" id="addGo" aria-label="确认"></button>
</div>
<p class="hint">支持歌曲 ID、网易云链接（含短链）、第三方音频/视频直链（MP3 / M4A / FLAC / M3U8 / MP4 / FLV / WMV 等）或歌名搜索。多个链接会优先取网易云，其次按顺序取第一个可用音源。</p>
</div>
<div id="addStage2" style="display:none">
<h2>已找到歌曲</h2>
<div class="found">
<div class="found-name" id="foundName"></div>
<div class="found-artist" id="foundArtist"></div>
<div class="found-meta" id="foundMeta"></div>
</div>
<p class="hint" id="addHint">是否将此歌曲加入播放列表？</p>
<div class="dlg-actions">
<button class="text-btn" id="addCancel">取消</button>
<button class="filled-btn" id="addConfirm">确认</button>
</div>
</div>
</div>
</div>

<div class="scrim" id="clearScrim">
<div class="dialog">
<h2>清空播放列表</h2>
<p class="dialog-text">将删除播放列表中的所有歌曲，此操作无法撤销。</p>
<div class="dlg-actions">
<button class="text-btn" id="clearCancel">取消</button>
<button class="filled-btn danger" id="clearConfirm">确认清空</button>
</div>
</div>
</div>

<div class="scrim" id="renameScrim">
<div class="dialog">
<h2>重命名</h2>
<div class="input-row">
<input id="renameInput" placeholder="输入新名称" autocomplete="off" maxlength="100" enterkeyhint="done">
<button class="filled-icon" id="renameGo" aria-label="确认"></button>
</div>
<div class="dlg-actions">
<button class="text-btn" id="renameCancel">取消</button>
<button class="filled-btn" id="renameConfirm">确认</button>
</div>
</div>
</div>

<div class="scrim" id="shareScrim">
<div class="dialog">
<h2>分享歌曲</h2>
<p class="dialog-text" id="shareSongName">—</p>
<div class="share-menu">
<button class="filled-btn block" id="shareCopyLink">复制分享链接</button>
<button class="filled-btn block" id="shareSystem">系统分享</button>
<button class="text-btn block" id="shareCancel" style="justify-content:center">取消</button>
</div>
</div>
</div>

<div class="scrim" id="downloadScrim">
<div class="dialog">
<div class="dialog-head">
<h2>选择下载音质</h2>
<button class="dlg-retry" id="downloadRetryBtn" aria-label="重新检测音质"></button>
</div>
<p class="dialog-text" id="downloadSongName">—</p>
<div id="qualityList"></div>
<div class="dlg-actions">
<button class="text-btn" id="downloadCancel">取消</button>
</div>
</div>
</div>

<div class="scrim" id="exportScrim">
<div class="dialog">
<h2>网络导出</h2>
<div class="input-row">
<input id="exportKey" readonly placeholder="正在上传...">
<button class="filled-icon" id="exportCopy" aria-label="复制密钥" disabled></button>
</div>
<p class="hint" id="exportHint">正在将歌单上传到网络...</p>
<div class="dlg-actions">
<button class="text-btn" id="exportDownload">下载 .txt</button>
<button class="filled-btn" id="exportClose">关闭</button>
</div>
</div>
</div>

<div class="scrim" id="importScrim">
<div class="dialog">
<h2>导入播放列表</h2>
<div class="input-row">
<input id="importKey" placeholder="密钥 / GZIP / 明文歌单" autocomplete="off" maxlength="8000">
<button class="filled-icon" id="importGo" aria-label="获取"></button>
</div>
<input type="file" id="importFile" accept=".txt,text/plain" style="display:none">
<div class="import-toolbar">
<button class="text-btn" id="importPickFile">选择 .txt 文件</button>
<span class="file-name" id="importFileName"></span>
</div>
<div class="import-mode">
<label><input type="radio" name="importMode" value="merge" checked>合并到原列表</label>
<label><input type="radio" name="importMode" value="replace">覆盖原列表</label>
</div>
<p class="hint" id="importHint"></p>
<div class="dlg-actions">
<button class="text-btn" id="importCancel">取消</button>
<button class="filled-btn" id="importConfirm">确认导入</button>
</div>
</div>
</div>

<div class="scrim bottom" id="listScrim">
<div class="sheet">
<div class="sheet-head">
<h2 id="sheetTitle">播放列表</h2>
<div class="head-actions">
<button class="icon-btn" id="sheetEdit" aria-label="编辑顺序" title="编辑顺序"></button>
<button class="icon-btn" id="sheetImport" aria-label="导入列表" title="导入列表"></button>
<button class="icon-btn" id="sheetExport" aria-label="导出列表" title="导出列表"></button>
<button class="icon-btn" id="sheetClear" aria-label="清空列表" title="清空列表"></button>
<button class="icon-btn" id="sheetAdd" aria-label="添加歌曲" title="添加歌曲"></button>
</div>
</div>
<div class="sheet-list" id="sheetList"></div>
</div>
</div>
`;