/*!
 * ☆Star工具箱☆ · 视频下载（yt-dlp 外部程序）
 * GPL-3.0-or-later · star
 * 对应 Windows 版下载栏目。yt-dlp 为 Unlicense 公共领域，作为外部程序调用，不随包分发。
 * 进度通过 IPC 事件 'download:progress' 推送给渲染层。
 */
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { which, pkgInstall } = require('./system-tools');

let current = null; // 当前下载进程

function register(ipcMain, win) {
  const send = (payload) => { if (win && win.webContents) win.webContents.send('download:progress', payload); };

  ipcMain.handle('download:probe', async () => {
    const yt = which('yt-dlp') || which('youtube-dl');
    return { available: !!yt, path: yt };
  });

  ipcMain.handle('download:start', async (_e, opts) => {
    const url = opts && opts.url;
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { ok: false, error: '请输入有效的 http(s) 地址' };
    }
    if (current && !current.killed) return { ok: false, error: '已有一个下载任务在进行' };
    const yt = which('yt-dlp') || which('youtube-dl');
    if (!yt) return { ok: false, error: `需要 yt-dlp，请执行 ${pkgInstall('yt-dlp')}` };

    const outdir = opts.outdir || (require('electron').app.getPath('downloads'));
    try { fs.mkdirSync(outdir, { recursive: true }); } catch (_) {}
    const args = ['--no-playlist', '-o', path.join(outdir, '%(title)s.%(ext)s'), url];
    if (opts.audioOnly) args.unshift('-x', '--audio-format', 'mp3');

    return new Promise((resolve) => {
      const proc = spawn(yt, args, { windowsHide: true });
      current = proc;
      send({ phase: 'start', url });
      proc.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        const m = [...text.matchAll(/(\d+(?:\.\d+)?)%/g)].pop();
        if (m) send({ phase: 'progress', percent: parseFloat(m[1]) });
      });
      proc.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        const m = [...text.matchAll(/(\d+(?:\.\d+)?)%/g)].pop();
        if (m) send({ phase: 'progress', percent: parseFloat(m[1]) });
      });
      proc.on('error', (e) => {
        current = null;
        send({ phase: 'error', error: String(e.message || e) });
        resolve({ ok: false, error: String(e.message || e) });
      });
      proc.on('close', (code) => {
        current = null;
        if (code === 0) { send({ phase: 'done' }); resolve({ ok: true }); }
        else { send({ phase: 'error', error: `yt-dlp 退出码 ${code}` }); resolve({ ok: false, error: `退出码 ${code}` }); }
      });
    });
  });

  ipcMain.handle('download:cancel', async () => {
    if (current && !current.killed) { current.kill(); current = null; return { ok: true }; }
    return { ok: false };
  });

  ipcMain.handle('download:list', async () => {
    const d = require('electron').app.getPath('downloads');
    try {
      return fs.readdirSync(d).map(f => ({ name: f, path: path.join(d, f) }))
        .filter(x => /\.(mp4|mkv|webm|mp3|m4a|flac)$/i.test(x.name))
        .slice(0, 50);
    } catch (_) { return []; }
  });
}

module.exports = { register };
