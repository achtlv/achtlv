export const BODY_INNER = `<div class="app">
<div class="page page-active" id="pagePlayer">
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

<div class="side-row">
<button class="icon-btn side-btn" id="favBtn" title="收藏" aria-label="收藏"></button>
<button class="icon-btn side-btn" id="downloadBtn" title="下载" aria-label="下载"></button>
</div>

<div class="progress-row">
<span id="curTime">0:00</span>
<input type="range" id="seek" min="0" max="1000" value="0" step="1" aria-label="播放进度">
<span id="durTime">0:00</span>
</div>

<div class="controls">
<button class="icon-btn" id="modeBtn" title="播放模式" aria-label="播放模式"></button>
<button class="icon-btn" id="prevBtn" disabled aria-label="上一首"></button>
<button class="play-btn" id="playBtn" aria-label="播放/暂停"></button>
<button class="icon-btn" id="nextBtn" disabled aria-label="下一首"></button>
<button class="icon-btn" id="listBtn" title="播放列表" aria-label="播放列表"></button>
</div>
</div>

<div class="page" id="pagePlaylists">
<div class="page-head">
<h1>歌单</h1>
<div class="page-head-actions">
<button class="icon-btn" id="plSortBtn" title="排序" aria-label="排序"><svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg></button>
<button class="icon-btn" id="plImportBtn" title="导入" aria-label="导入"><svg viewBox="0 0 24 24"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/></svg></button>
<button class="icon-btn" id="plAddBtn" title="新建歌单" aria-label="新建歌单"><svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/></svg></button>
</div>
</div>
<div class="pl-list" id="plList"></div>
</div>

<div class="page" id="pagePlaylistDetail" style="display:none">
<div class="page-head">
<button class="icon-btn" id="plDetailBack" aria-label="返回"><svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg></button>
<h1 id="plDetailTitle">歌单</h1>
<div class="page-head-actions">
<button class="icon-btn" id="plDetailSort" title="排序歌曲" aria-label="排序歌曲"><svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg></button>
<button class="icon-btn" id="plDetailExport" title="导出歌单" aria-label="导出歌单"><svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg></button>
<button class="icon-btn" id="plDetailPlay" title="播放歌单" aria-label="播放歌单"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
<button class="icon-btn" id="plDetailRename" title="重命名" aria-label="重命名"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
<button class="icon-btn" id="plDetailDelete" title="删除歌单" aria-label="删除歌单"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
</div>
</div>
<div class="pl-detail-list" id="plDetailList"></div>
</div>

<div class="page" id="pageMe">
<div class="page-head"><h1>我的</h1></div>
<div class="me-section">
<div class="me-card" id="meAuthCard">
<div class="me-user" id="meUserLabel">未登录</div>
<button class="filled-btn block" id="meLoginBtn">登录 / 注册</button>
<button class="text-btn block" id="meChangePassBtn" style="display:none;justify-content:center">更改密码</button>
<button class="text-btn block" id="meLogoutBtn" style="display:none;justify-content:center">退出登录</button>
<button class="text-btn block" id="meSyncBtn" style="display:none;justify-content:center">立即同步</button>
</div>
<div class="me-card" id="meSyncOpts" style="display:none">
<div class="me-label">同步内容</div>
<label class="me-check"><input type="checkbox" id="syncPlaylists" checked> 歌单</label>
<label class="me-check"><input type="checkbox" id="syncSettings" checked> 设置项</label>
</div>
<div class="me-card">
<div class="me-label">主题颜色</div>
<div class="theme-row" id="themeRow">
<button class="theme-dot" data-theme="green" title="绿色"></button>
<button class="theme-dot" data-theme="blue" title="蓝色"></button>
<button class="theme-dot" data-theme="purple" title="紫色"></button>
<button class="theme-dot" data-theme="red" title="红色"></button>
</div>
</div>
</div>
</div>

</div>
<nav class="tabbar" id="tabbar">
<button class="tab-item active" data-tab="player" aria-label="播放器">
<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
<span>播放</span>
</button>
<button class="tab-item" data-tab="playlists" aria-label="歌单">
<svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v3zm-4 4H9v-3h6v3zm4-8H9V5h10v3z"/></svg>
<span>歌单</span>
</button>
<button class="tab-item" data-tab="me" aria-label="我的">
<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
<span>我的</span>
</button>
</nav>

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
</div>
<input type="file" id="importFile" accept=".txt,text/plain" style="display:none">
<div class="import-toolbar">
<button class="text-btn" id="importPickFile">选择 .txt 文件</button>
<span class="file-name" id="importFileName"></span>
</div>
<div class="import-mode">
<label><input type="radio" name="importMode" value="new" checked>新建</label>
<label><input type="radio" name="importMode" value="merge">合并</label>
<label><input type="radio" name="importMode" value="replace">覆盖</label>
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
<button class="icon-btn" id="sheetHistPrev" title="上一个列表" aria-label="上一个列表" style="display:none"></button>
<h2 id="sheetTitle">播放列表</h2>
<button class="icon-btn" id="sheetHistNext" title="下一个列表" aria-label="下一个列表" style="display:none"></button>
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

<div class="scrim" id="favScrim">
<div class="dialog">
<h2>收藏到歌单</h2>
<div id="favPlList" class="fav-pl-list"></div>
<div class="dlg-actions">
<button class="text-btn" id="favNewPl">新建歌单并收藏</button>
<button class="text-btn" id="favCancel">取消</button>
</div>
</div>
</div>

<div class="scrim" id="changePassScrim">
<div class="dialog">
<h2>更改密码</h2>
<div class="input-row" style="margin-bottom:10px">
<input id="changePassOld" type="password" placeholder="旧密码" autocomplete="current-password">
</div>
<div class="input-row" style="margin-bottom:10px">
<input id="changePassNew" type="password" placeholder="新密码（先验证旧密码）" autocomplete="new-password" disabled>
</div>
<div class="input-row">
<input id="changePassNew2" type="password" placeholder="确认新密码" autocomplete="new-password" disabled>
<button class="filled-icon with-text" id="changePassGo" aria-label="确认">确认</button>
</div>
<p class="hint" id="changePassHint">请先输入旧密码并验证</p>
<div class="dlg-actions">
<button class="text-btn" id="changePassCancel">取消</button>
</div>
</div>
</div>

<div class="scrim" id="loginScrim">
<div class="dialog">
<h2>登录 / 注册</h2>
<div class="input-row" style="margin-bottom:10px">
<input id="loginUser" placeholder="用户名" autocomplete="username">
</div>
<div class="input-row">
<input id="loginPass" type="password" placeholder="密码" autocomplete="current-password" enterkeyhint="go">
<button class="filled-icon with-text" id="loginGo" aria-label="确认">确认</button>
</div>
<p class="hint">若账号不存在将自动注册。数据存储于 textdb，请妥善保管密码。</p>
<div class="dlg-actions">
<button class="text-btn" id="loginCancel">取消</button>
</div>
</div>
</div>

<div class="scrim" id="syncChoiceScrim">
<div class="dialog">
<h2>同步选项</h2>
<p class="dialog-text">选择首次同步时如何处理本地数据</p>
<label class="me-check"><input type="radio" name="syncPlMode" value="merge" checked> 同步登录前的歌单</label>
<label class="me-check"><input type="radio" name="syncPlMode" value="discard"> 删除登录前的本地歌单</label>
<label class="me-check"><input type="radio" name="syncSetMode" value="merge" checked> 同步登录前的设置</label>
<label class="me-check"><input type="radio" name="syncSetMode" value="discard"> 使用云端设置</label>
<div class="dlg-actions">
<button class="filled-btn" id="syncChoiceOk">确认</button>
</div>
</div>
</div>

<div class="scrim" id="plImportScrim">
<div class="dialog">
<h2>导入歌单</h2>
<div class="input-row">
<input id="plImportKey" placeholder="密钥 / GZIP / 明文" autocomplete="off">
</div>
<div class="import-mode">
<label><input type="radio" name="plImportMode" value="new" checked>新建</label>
<label><input type="radio" name="plImportMode" value="merge">合并</label>
</div>
<select id="plImportTarget" style="display:none;width:100%;margin-top:8px;height:40px;border-radius:12px;border:1px solid var(--outline);background:transparent;color:var(--on-surface);padding:0 12px"></select>
<p class="hint" id="plImportHint"></p>
<div class="dlg-actions">
<button class="text-btn" id="plImportCancel">取消</button>
<button class="filled-btn" id="plImportConfirm">确认导入</button>
</div>
</div>
</div>

<div class="scrim" id="urlKeyScrim">
<div class="dialog">
<h2>导入内容</h2>
<p class="dialog-text" id="urlKeyHint">检测到分享密钥，请选择导入位置</p>
<div class="dlg-actions" style="flex-direction:column;align-items:stretch">
<button class="filled-btn block" id="urlKeyToList">导入到歌曲列表</button>
<button class="filled-btn block" id="urlKeyToPl">导入到歌单</button>
<button class="text-btn block" id="urlKeyCancel" style="justify-content:center">取消</button>
</div>
</div>
</div>
<div class="scrim" id="logoutScrim">
<div class="dialog">
<h2>退出登录</h2>
<p class="dialog-text">退出后将清空本地歌单与登录信息（保留当前歌曲列表与主题）。确定退出？</p>
<div class="dlg-actions">
<button class="text-btn" id="logoutCancel">取消</button>
<button class="filled-btn danger" id="logoutConfirm">退出登录</button>
</div>
</div>
</div>
<div class="scrim" id="plExportScrim">
<div class="dialog">
<h2>导出歌单</h2>
<p class="dialog-text" id="plExportName">—</p>
<div class="share-menu">
<button class="filled-btn block" id="plExportKeyBtn">导出为密钥并复制</button>
<button class="filled-btn block" id="plExportGzipBtn">下载 GZIP 文本</button>
<button class="text-btn block" id="plExportCancel" style="justify-content:center">取消</button>
</div>
</div>
</div>
<div class="scrim" id="plNameScrim">
<div class="dialog">
<h2 id="plNameTitle">新建歌单</h2>
<div class="input-row">
<input id="plNameInput" placeholder="输入名称（可留空用默认名）" autocomplete="off" maxlength="40" enterkeyhint="done">
</div>
<div class="dlg-actions">
<button class="text-btn" id="plNameCancel">取消</button>
<button class="filled-btn" id="plNameConfirm">创建</button>
</div>
</div>
</div>
`;
