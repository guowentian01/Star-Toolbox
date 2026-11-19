/*!
 * ☆Star工具箱☆ · 安全桥（contextIsolation）
 * GPL-3.0-or-later · star
 * 渲染进程拿不到 Node / fs / child_process，只能通过这里列出的白名单方法访问本机能力。
 */
'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const call = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('starHost', {
  // 应用
  info: () => call('app:info'),
  probe: () => call('sys:probe'),

  // 对话框
  openMediaDialog: () => call('dialog:openMedia'),
  openFiles: (opts) => call('dialog:openFiles', opts),
  openFolder: () => call('dialog:openFolder'),
  saveFile: (opts) => call('dialog:saveFile', opts),
  pathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch (_) { return file && file.path || ''; }
  },
  openExternal: (url) => call('shell:openExternal', url),
  openPath: (target) => call('shell:openPath', target),

  // 最近打开
  recent: {
    list: () => call('recent:list'),
    add: (f) => call('recent:add', f),
    remove: (f) => call('recent:remove', f),
    clear: () => call('recent:clear')
  },

  // 本地媒体 Range 服务
  media: {
    register: (f) => call('media:register', f),
    list: () => call('media:list'),
    clear: () => call('media:clear'),
    probe: (f) => call('media:probe', f)
  },

  // mpv 外部进程
  mpv: {
    probe: () => call('mpv:probe'),
    play: (filePath) => call('mpv:play', filePath),
    command: (args) => call('mpv:command', args),
    stop: () => call('mpv:stop'),
    quit: () => call('mpv:quit'),
    onEvent: (callback) => {
      const listener = (_e, payload) => { if (typeof callback === 'function') callback(payload); };
      ipcRenderer.on('mpv:event', listener);
      return () => ipcRenderer.removeListener('mpv:event', listener);
    }
  },

  // 转码
  transcode: {
    check: (f) => call('transcode:check', f),
    run: (f) => call('transcode:run', f),
    clear: () => call('transcode:clear'),
    onProgress: (callback) => {
      const listener = (_e, payload) => { if (typeof callback === 'function') callback(payload); };
      ipcRenderer.on('transcode:progress', listener);
      return () => ipcRenderer.removeListener('transcode:progress', listener);
    }
  },

  // Excel
  excel: {
    split: (files) => call('excel:split', files),
    merge: (opts) => call('excel:merge', opts),
    inspect: (f) => call('excel:inspect', f),
    onDone: (callback) => {
      const listener = (_e, payload) => { if (typeof callback === 'function') callback(payload); };
      ipcRenderer.on('excel:done', listener);
      return () => ipcRenderer.removeListener('excel:done', listener);
    }
  },

  // PDF / 图片 / 文本
  pdf: {
    split: (f) => call('pdf:split', f),
    merge: (files) => call('pdf:merge', files),
    info: (f) => call('pdf:info', f)
  },
  image: { convert: (opts) => call('image:convert', opts) },
  text: {
    process: (opts) => call('text:process', opts),
    readFile: (f) => call('text:readFile', f),
    saveFile: (opts) => call('text:saveFile', opts)
  },

  // 下载
  download: {
    probe: () => call('download:probe'),
    start: (opts) => call('download:start', opts),
    cancel: () => call('download:cancel'),
    list: () => call('download:list'),
    onProgress: (callback) => {
      const listener = (_e, payload) => { if (typeof callback === 'function') callback(payload); };
      ipcRenderer.on('download:progress', listener);
      return () => ipcRenderer.removeListener('download:progress', listener);
    }
  },

  // 菜单事件（主进程菜单 → 渲染层）
  onMenu: (callback) => {
    const handler = (payload) => { if (typeof callback === 'function') callback(payload); };
    const channels = ['menu:openMedia', 'menu:openFolder', 'menu:mpvStop', 'menu:mpvQuit', 'app:about'];
    channels.forEach(ch => ipcRenderer.on(ch, handler));
    return () => channels.forEach(ch => ipcRenderer.removeListener(ch, handler));
  }
});
