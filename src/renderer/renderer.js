/* ☆Star工具箱☆ · 渲染层逻辑 · GPL-3.0-or-later · star */
'use strict';
(function () {
  const H = window.starHost;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  let currentMedia = null;   // 当前媒体文件路径
  let envInfo = null;

  /* ---------- 通用 ---------- */
  let toastTimer;
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }
  function status(sel, text, isError) {
    const el = $(sel);
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('error', !!isError);
  }
  function fmtSize(n) {
    if (!n && n !== 0) return '';
    const u = ['B', 'KB', 'MB', 'GB']; let i = 0, v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
  }
  function iconFor(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (['mp4','mkv','avi','mov','webm','flv','m4v'].includes(ext)) return '▶';
    if (['mp3','flac','wav','aac','m4a','ogg'].includes(ext)) return '♫';
    if (['xlsx','xlsm','xls','csv'].includes(ext)) return '▦';
    if (ext === 'pdf') return '▤';
    if (['png','jpg','jpeg','webp','gif','bmp'].includes(ext)) return '▧';
    return '▢';
  }

  /* ---------- 导航 ---------- */
  function goto(view) {
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  }
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('.nav-item');
    if (b) goto(b.dataset.view);
  });
  $$('[data-goto]').forEach(t => t.addEventListener('click', () => goto(t.dataset.goto)));
  $('#tile-online').addEventListener('click', () => H.openExternal('https://ffee.me/zh/'));

  /* ---------- 环境检测 ---------- */
  async function loadEnv() {
    try {
      envInfo = await H.probe();
      const info = await H.info();
      const p = envInfo;
      $('#dl-tool-state').textContent = p.downloader.available ? '已就绪' : '未安装';
      $('#env-info').textContent = `${info.platform} · ${info.arch} · Electron ${info.electron}`;
      return p;
    } catch (e) { return null; }
  }
  $('#btn-env').addEventListener('click', async () => {
    const p = envInfo || await loadEnv();
    if (!p) { toast('环境检测失败'); return; }
    const rows = [
      ['mpv 播放器', p.mpv.available, p.mpv.version || '未安装'],
      ['ffmpeg 转码', p.ffmpeg.available, p.ffmpeg.version || '未安装'],
      ['ffprobe 探测', p.ffprobe.available, p.ffprobe.version || '未安装'],
      ['yt-dlp 下载', p.downloader.available, p.downloader.version || '未安装'],
      ['whisper 文案', p.whisper.available, p.whisper.available ? '已就绪' : '未安装']
    ];
    let modal = $('#env-modal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'env-modal'; modal.className = 'env-modal'; $('.app').appendChild(modal); }
    modal.innerHTML = '<h3 style="margin-bottom:10px">运行环境检测</h3>' +
      rows.map(r => `<div class="env-row"><span>${r[0]}</span><span class="${r[1] ? 'env-ok' : 'env-no'}">${r[2]}</span></div>`).join('') +
      '<p class="muted" style="margin:12px 0 0">未安装的工具不影响其他功能。macOS 安装：<code>brew install mpv ffmpeg yt-dlp</code></p>';
    modal.style.top = '66px';
    modal.style.right = '22px';
    const close = (e) => { if (!modal.contains(e.target) && e.target.id !== 'btn-env') { modal.remove(); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  });

  /* ---------- 首页：最近打开 ---------- */
  async function renderRecent() {
    const list = await H.recent.list();
    const box = $('#recent-list');
    box.innerHTML = '';
    $('#recent-empty').style.display = list.length ? 'none' : 'block';
    for (const item of list) {
      const row = document.createElement('div');
      row.className = 'recent-item';
      row.innerHTML =
        `<div class="recent-ic">${iconFor(item.name)}</div>` +
        `<div class="recent-meta"><div class="recent-name">${escapeHtml(item.name)}</div>` +
        `<div class="recent-path">${escapeHtml(item.path)}${item.size ? ' · ' + fmtSize(item.size) : ''}</div></div>` +
        `<button class="recent-del" title="移除">×</button>`;
      row.addEventListener('click', () => openMedia(item.path));
      row.querySelector('.recent-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        await H.recent.remove(item.path);
        renderRecent();
      });
      box.appendChild(row);
    }
  }
  $('#recent-clear').addEventListener('click', async () => { await H.recent.clear(); renderRecent(); });
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  /* ---------- 媒体播放 ---------- */
  const video = $('#player');
  async function openMedia(file) {
    if (!file) return;
    currentMedia = file;
    await H.recent.add(file);
    renderRecent();
    goto('media');
    status('#media-status', '正在载入媒体信息…');
    const meta = await H.media.probe(file);
    const info = meta.ok
      ? `编码 ${meta.codec || '?'} · ${meta.width || '?'}×${meta.height || '?'} · ${meta.duration ? Math.round(meta.duration) + 's' : ''}` + (meta.needTranscode ? ' · 建议转码流畅播放' : '')
      : '';
    status('#media-status', info);

    // 常见格式用 <video>；其余提示用 mpv
    if (/\.(mp4|webm|mov|m4v|mp3|m4a|aac|wav|ogg)$/i.test(file) && !meta.needTranscode) {
      const reg = await H.media.register(file);
      if (reg.ok) {
        video.src = reg.url;
        video.style.display = 'block';
        video.classList.add('ready');
        $('.stage-empty').style.display = 'none';
        video.play().catch(() => {});
        toast('窗口内播放（常见格式）');
      } else {
        status('#media-status', reg.error, true);
      }
    } else {
      video.classList.remove('ready');
      $('.stage-empty').style.display = 'block';
      $('.stage-empty').textContent = '该格式/编码建议用系统 mpv 播放，点击「用 mpv 播放」';
      toast('该格式走系统 mpv 独立窗口');
    }
  }

  $('#media-open').addEventListener('click', async () => {
    const f = await H.openMediaDialog();
    if (f) await openMedia(f);
  });
  $('#media-mpv').addEventListener('click', async () => {
    if (!currentMedia) { toast('请先打开媒体'); return; }
    status('#media-status', '正在启动系统 mpv…');
    const r = await H.mpv.play(currentMedia);
    status('#media-status', r.ok ? '已用系统 mpv 独立窗口播放' : (r.error || '启动失败'), !r.ok);
  });
  $('#media-transcode').addEventListener('click', async () => {
    if (!currentMedia) { toast('请先打开媒体'); return; }
    status('#media-status', '检查是否需要转码…');
    const off = H.transcode.onProgress(p => status('#media-status', `后台转码中… ${p.percent}%`));
    const r = await H.transcode.run(currentMedia);
    off();
    if (r.ok) {
      status('#media-status', r.cached ? '命中缓存，直接播放' : '转码完成，播放流畅版');
      const reg = await H.media.register(r.file);
      if (reg.ok) {
        video.src = reg.url; video.classList.add('ready');
        $('.stage-empty').style.display = 'none'; video.play().catch(() => {});
      }
    } else status('#media-status', r.error || '转码失败', true);
  });
  $('#media-clear-cache').addEventListener('click', async () => {
    await H.transcode.clear(); toast('转码缓存已清空');
  });
  H.mpv.onEvent(() => {});

  /* ---------- 文档编辑 ---------- */
  const editor = $('#doc-editor'), docPath = $('#doc-path');
  $('#doc-new').addEventListener('click', () => { editor.value = ''; docPath.value = ''; status('#doc-status', '新建文档'); });
  $('#doc-open').addEventListener('click', async () => {
    const files = await H.openFiles({ multi: false, filters: [{ name: '文本文件', extensions: ['txt','md','json','csv','log','xml','html','js','css'] }, { name: '所有文件', extensions: ['*'] }] });
    if (!files.length) return;
    const r = await H.text.readFile(files[0]);
    if (r.ok) { editor.value = r.text; docPath.value = files[0]; status('#doc-status', '已打开：' + files[0]); }
    else status('#doc-status', r.error, true);
  });
  $('#doc-save').addEventListener('click', async () => {
    let p = docPath.value.trim();
    if (!p) p = await H.saveFile({ defaultPath: '未命名.txt', filters: [{ name: '文本文件', extensions: ['txt','md'] }] });
    if (!p) return;
    const r = await H.text.saveFile({ file: p, text: editor.value });
    if (r.ok) { docPath.value = p; status('#doc-status', '已保存：' + p); toast('已保存'); }
    else status('#doc-status', r.error, true);
  });
  $('#doc-sysopen').addEventListener('click', async () => {
    const p = docPath.value.trim();
    if (!p) { toast('请先打开一个文件'); return; }
    const r = await H.openPath(p);
    if (!r) toast('系统打开失败');
  });

  /* ---------- 下载 ---------- */
  function setBar(pct) { $('#dl-bar').style.width = Math.max(0, Math.min(100, pct || 0)) + '%'; }
  H.download.onProgress(p => {
    if (p.phase === 'start') { setBar(0); status('#dl-status', '开始下载…'); }
    else if (p.phase === 'progress') { setBar(p.percent); status('#dl-status', `下载中 ${p.percent}%`); }
    else if (p.phase === 'done') { setBar(100); status('#dl-status', '下载完成'); toast('下载完成'); refreshDownloads(); }
    else if (p.phase === 'error') { status('#dl-status', p.error || '下载失败', true); }
  });
  async function startDownload(audioOnly) {
    const url = $('#dl-url').value.trim();
    if (!url) { toast('请输入地址'); return; }
    const r = await H.download.start({ url, audioOnly });
    if (!r.ok) status('#dl-status', r.error || '启动失败', true);
  }
  $('#dl-start').addEventListener('click', () => startDownload(false));
  $('#dl-audio').addEventListener('click', () => startDownload(true));
  $('#dl-cancel').addEventListener('click', async () => { await H.download.cancel(); status('#dl-status', '已取消'); setBar(0); });
  async function refreshDownloads() {
    const list = await H.download.list();
    const box = $('#dl-list'); box.innerHTML = '';
    for (const f of list) {
      const el = document.createElement('div');
      el.className = 'file-item';
      el.innerHTML = `<span>${iconFor(f.name)}</span><span style="flex:1">${escapeHtml(f.name)}</span>`;
      el.addEventListener('click', () => openMedia(f.path));
      box.appendChild(el);
    }
  }

  /* ---------- 文件工具：Excel ---------- */
  $('#excel-split').addEventListener('click', async () => {
    const files = await H.openFiles({ filters: [{ name: 'Excel 工作簿', extensions: ['xlsx','xlsm'] }] });
    if (!files.length) return;
    status('#excel-status', `正在拆分 ${files.length} 个工作簿…`);
    const r = await H.excel.split(files);
    if (r.ok) { status('#excel-status', `已拆分 ${r.count} 个文件到：${r.folder}`); toast(`拆分完成：${r.count} 个文件`); }
    else if (r.canceled) status('#excel-status', '已取消');
    else status('#excel-status', r.error, true);
  });
  $('#excel-merge').addEventListener('click', async () => {
    const files = await H.openFiles({ filters: [{ name: 'Excel 工作簿', extensions: ['xlsx','xlsm'] }] });
    if (files.length < 2) { toast('请至少选择两个工作簿'); return; }
    status('#excel-status', `正在合并 ${files.length} 个工作簿…`);
    const r = await H.excel.merge({ files, addPrefix: $('#excel-prefix').checked });
    if (r.ok) { status('#excel-status', '已合并保存到：' + r.file); toast('合并完成'); }
    else if (r.canceled) status('#excel-status', '已取消');
    else status('#excel-status', r.error, true);
  });

  /* ---------- PDF ---------- */
  $('#pdf-split').addEventListener('click', async () => {
    const files = await H.openFiles({ multi: false, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (!files.length) return;
    status('#pdf-status', '正在拆分 PDF…');
    const r = await H.pdf.split(files[0]);
    if (r.ok) { status('#pdf-status', `已拆分为 ${r.count} 页，保存到：${r.folder}`); toast('PDF 拆分完成'); }
    else status('#pdf-status', r.error || '已取消', !r.canceled);
  });
  $('#pdf-merge').addEventListener('click', async () => {
    const files = await H.openFiles({ filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (files.length < 2) { toast('请至少选择两个 PDF'); return; }
    status('#pdf-status', '正在合并 PDF…');
    const r = await H.pdf.merge(files);
    if (r.ok) { status('#pdf-status', '已合并保存到：' + r.file); toast('PDF 合并完成'); }
    else status('#pdf-status', r.error || '已取消', !r.canceled);
  });

  /* ---------- 图片 ---------- */
  $('#img-convert').addEventListener('click', async () => {
    const files = await H.openFiles({ filters: [{ name: '图片', extensions: ['png','jpg','jpeg','webp','gif','bmp','tiff'] }] });
    if (!files.length) return;
    status('#img-status', '正在转换…');
    const r = await H.image.convert({ files, format: $('#img-format').value });
    if (r.ok) { status('#img-status', `已转换 ${r.files.length} 张图片`); toast('转换完成'); }
    else status('#img-status', r.error, true);
  });

  /* ---------- 文本工具 ---------- */
  $$('[data-text]').forEach(b => b.addEventListener('click', async () => {
    const mode = b.dataset.text;
    const r = await H.text.process({ mode, text: $('#text-input').value });
    if (r.ok) {
      if (mode === 'count') { status('#text-status', r.result); }
      else { $('#text-input').value = r.result; status('#text-status', '已处理：' + mode); }
    } else status('#text-status', r.error, true);
  }));

  /* ---------- 菜单事件 ---------- */
  H.onMenu(async (payload) => {
    if (payload === 'menu:openMedia') {
      const f = await H.openMediaDialog(); if (f) await openMedia(f);
    } else if (payload === 'menu:openFolder') {
      const d = await H.openFolder();
      if (d) { const files = await H.openFiles({ filters: [{ name: '媒体', extensions: ['mp4','mkv','mp3','flac','webm'] }] }); }
    } else if (payload === 'menu:mpvStop') { await H.mpv.stop(); toast('已停止'); }
    else if (payload === 'menu:mpvQuit') { await H.mpv.quit(); toast('mpv 已退出'); }
    else if (payload === 'app:about') {
      const info = await H.info();
      toast(`☆Star工具箱☆ v${info.version} · GPL-3.0-or-later`);
    }
  });

  /* ---------- 启动 ---------- */
  loadEnv();
  renderRecent();
  refreshDownloads();
})();
