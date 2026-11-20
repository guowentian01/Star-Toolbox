/*!
 * ☆Star工具箱☆ · Electron 主进程
 * GPL-3.0-or-later · star · 2026-11-19
 * 衍生自开物 Kaiwu v0.4.4（dls0412/kaiwu）。完整 GPL 声明见 NOTICE.md。
 * 职责：窗口、菜单、外链白名单、本地媒体 Range 服务、IPC handlers、系统工具探测。
 */
'use strict';

const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const { MpvBridge, findMpv } = require('./mpv-bridge');
const mediaServer = require('./lib/media-server');
const recent = require('./lib/recent');
const tools = require('./lib/tools');
const download = require('./lib/download');
const systemTools = require('./lib/system-tools');

// 银河麒麟等禁用 user namespace 的系统上，Electron 沙箱可能无法启动。
// 默认不关闭沙箱（保留安全性）；若启动报 namespace/sandbox 错误，用 STAR_NO_SANDBOX=1 启动即可。
if (process.platform === 'linux' && process.env.STAR_NO_SANDBOX === '1') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
}

/** 仅允许这些协议由系统浏览器打开，白名单，防钓鱼 */
const SAFE_URL = /^https?:\/\//i;

let mainWindow = null;
let mpv = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: '☆Star工具箱☆',
    backgroundColor: '#f4f7f2',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  // 阻止渲染层导航到外部 origin；外链一律交给 shell.openExternal。
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
      event.preventDefault();
      if (SAFE_URL.test(url)) shell.openExternal(url).catch(() => {});
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (SAFE_URL.test(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildMenu() {
  const template = [
    {
      label: '☆Star工具箱☆',
      submenu: [
        { label: '关于', click: () => send('app:about') },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '文件',
      submenu: [
        { label: '打开媒体…', accelerator: 'CmdOrCtrl+O', click: () => send('menu:openMedia') },
        { label: '打开文件夹…', click: () => send('menu:openFolder') }
      ]
    },
    {
      label: '播放',
      submenu: [
        { label: '停止', click: () => send('menu:mpvStop') },
        { label: '退出 mpv', click: () => send('menu:mpvQuit') }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '在线工具 ffee.me',
          click: () => shell.openExternal('https://ffee.me/zh/').catch(() => {})
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function send(channel, payload) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
}

function registerIpc() {
  ipcMain.handle('app:info', async () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    home: app.getPath('home'),
    userData: app.getPath('userData')
  }));
  ipcMain.handle('app:about', async () => ({ ok: true }));

  // 系统工具探测（mpv / ffmpeg / ffprobe / yt-dlp / whisper）
  ipcMain.handle('sys:probe', async () => systemTools.probeAll());

  // —— 文件对话框 ——
  ipcMain.handle('dialog:openMedia', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '媒体文件', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'm4v', 'mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg', 'opus', 'srt', 'ass', 'vtt'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('dialog:openFiles', async (_e, opts = {}) => {
    const r = await dialog.showOpenDialog(mainWindow, {
      properties: opts.multi === false ? ['openFile'] : ['openFile', 'multiSelections'],
      filters: opts.filters || [{ name: '所有文件', extensions: ['*'] }]
    });
    return r.canceled ? [] : r.filePaths;
  });
  ipcMain.handle('dialog:openFolder', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('dialog:saveFile', async (_e, opts = {}) => {
    const r = await dialog.showSaveDialog(mainWindow, {
      defaultPath: opts.defaultPath || undefined,
      filters: opts.filters || [{ name: '所有文件', extensions: ['*'] }]
    });
    return r.canceled ? null : r.filePath;
  });

  ipcMain.handle('shell:openExternal', async (_e, url) => {
    if (typeof url !== 'string' || !SAFE_URL.test(url)) return false;
    try { await shell.openExternal(url); return true; } catch (_) { return false; }
  });
  ipcMain.handle('shell:openPath', async (_e, target) => {
    try { const r = await shell.openPath(target); return r === ''; } catch (_) { return false; }
  });

  // —— 最近打开 ——
  ipcMain.handle('recent:list', async () => recent.list());
  ipcMain.handle('recent:add', async (_e, file) => recent.add(file));
  ipcMain.handle('recent:remove', async (_e, file) => recent.remove(file));
  ipcMain.handle('recent:clear', async () => recent.clear());

  // —— 本地媒体 HTTP(Range) 服务：供 <video> 拖动进度、流式播放 ——
  ipcMain.handle('media:register', async (_e, file) => mediaServer.register(file));
  ipcMain.handle('media:list', async () => mediaServer.list());
  ipcMain.handle('media:clear', async () => mediaServer.clear());
  ipcMain.handle('media:probe', async (_e, file) => systemTools.probeMedia(file));

  // —— mpv 外部进程（JSON IPC）——
  ipcMain.handle('mpv:probe', async () => {
    const bin = findMpv();
    return { available: !!bin, path: bin };
  });
  ipcMain.handle('mpv:play', async (_e, file) => {
    if (!mpv) {
      const bin = findMpv();
      if (!bin) return { ok: false, error: `未检测到系统 mpv，请执行 ${systemTools.pkgInstall('mpv')}` };
      mpv = new MpvBridge(bin, (event) => send('mpv:event', event));
    }
    await mpv.start();
    await mpv.play(file);
    return { ok: true };
  });
  ipcMain.handle('mpv:command', async (_e, args) => {
    if (!mpv || !mpv.sock) return { ok: false, error: 'mpv 未就绪' };
    try { const data = await mpv.command(args); return { ok: true, data }; }
    catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.handle('mpv:stop', async () => { if (mpv) await mpv.stop().catch(() => {}); return { ok: true }; });
  ipcMain.handle('mpv:quit', async () => {
    if (mpv) { mpv.destroy(); mpv = null; }
    return { ok: true };
  });

  // —— 文件工具：Excel / PDF / 图片 / 文本 ——
  tools.register(ipcMain, mainWindow);
  // —— 下载 ——
  download.register(ipcMain, mainWindow);
}

app.whenReady().then(async () => {
  await session.defaultSession.cookies.set({ url: 'http://localhost', name: 'star', value: '1' }).catch(() => {});
  registerIpc();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (mpv) { try { mpv.destroy(); } catch (_) {} mpv = null; }
  mediaServer.clear();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (mpv) { try { mpv.destroy(); } catch (_) {} mpv = null; }
});
