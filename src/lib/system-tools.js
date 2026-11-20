/*!
 * ☆Star工具箱☆ · 系统外部工具探测 / 媒体信息 / 自动转码
 * GPL-3.0-or-later · star
 * 对应 Windows 版 Transcoder.cs 与 libmpv 探测逻辑，改为调用系统 ffmpeg/ffprobe。
 * 绝不随包携带这些二进制：规避 GPL 传染，也绕开龙芯/申威交叉编译。
 */
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { app } = require('electron');

/** 按当前系统生成依赖安装命令（麒麟/Linux 用 apt，macOS 用 brew） */
function pkgInstall(names) {
  if (process.platform === 'darwin') return `brew install ${names}`;
  if (process.platform === 'linux') return `sudo apt install ${names}`;
  return `install ${names}`;
}

function which(bin) {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const r = spawnSync(cmd, [bin], { encoding: 'utf8', timeout: 3000 });
    if (r.status === 0) {
      const first = String(r.stdout || '').split(/\r?\n/).find(Boolean);
      if (first && fs.existsSync(first.trim())) return first.trim();
    }
  } catch (_) {}
  // 常见 homebrew / 系统路径兜底
  const extras = process.platform === 'darwin'
    ? ['/opt/homebrew/bin/', '/usr/local/bin/', '/usr/bin/']
    : ['/usr/bin/', '/usr/local/bin/'];
  for (const dir of extras) {
    const p = path.join(dir, bin);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function versionOf(bin, args = ['-version']) {
  if (!bin) return null;
  try {
    const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 4000 });
    const out = String(r.stdout || '') + String(r.stderr || '');
    const m = out.match(/(?:version|ffmpeg version|mpv)\s*([^\s]+)/i);
    return m ? m[1] : (out.split('\n')[0] || '').slice(0, 60);
  } catch (_) { return null; }
}

function probeAll() {
  const ffmpeg = which('ffmpeg');
  const ffprobe = which('ffprobe');
  const mpv = which('mpv');
  const yt = which('yt-dlp') || which('youtube-dl');
  const whisper = which('whisper') || which('whisper-cli') || which('whisper.cpp');
  return {
    platform: process.platform,
    ffmpeg: { available: !!ffmpeg, path: ffmpeg, version: versionOf(ffmpeg) },
    ffprobe: { available: !!ffprobe, path: ffprobe, version: versionOf(ffprobe) },
    mpv: { available: !!mpv, path: mpv, version: versionOf(mpv, ['--version']) },
    downloader: { available: !!yt, path: yt, version: versionOf(yt, ['--version']) },
    whisper: { available: !!whisper, path: whisper, version: null }
  };
}

/** 用 ffprobe 探测编码/分辨率，判断是否需要转码（大码率 HEVC/AV1/VP9） */
function probeMedia(file) {
  const ffprobe = which('ffprobe');
  if (!ffprobe || !fs.existsSync(file)) {
    return { ok: false, error: 'ffprobe 不可用或文件不存在' };
  }
  return new Promise((resolve) => {
    const args = ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height,bit_rate,r_frame_rate:format=duration',
      '-of', 'json', file];
    const r = spawnSync(ffprobe, args, { encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
    try {
      const info = JSON.parse(r.stdout || '{}');
      const s = (info.streams && info.streams[0]) || {};
      const codec = (s.codec_name || '').toLowerCase();
      const heavy = ['hevc', 'h265', 'av1', 'vp9'].includes(codec);
      const big = (s.width || 0) >= 1920;
      resolve({
        ok: true, codec, width: s.width, height: s.height,
        bitRate: s.bit_rate, fps: s.r_frame_rate,
        duration: info.format && info.format.duration,
        needTranscode: heavy && big
      });
    } catch (_) {
      resolve({ ok: false, error: '无法解析媒体信息' });
    }
  });
}

function cacheDir() {
  const d = path.join(app.getPath('userData'), 'transcode');
  try { fs.mkdirSync(d, { recursive: true }); } catch (_) {}
  return d;
}

function cacheKey(file) {
  let size = 0, mtime = 0;
  try { const st = fs.statSync(file); size = st.size; mtime = Math.floor(st.mtimeMs); } catch (_) {}
  return crypto.createHash('md5').update(`${file}|${size}|${mtime}`).digest('hex');
}

/**
 * 自动转码为大码率视频的 720p H.264 缓存。
 * onProgress(percent) 通过 IPC 回调给渲染层显示进度。
 */
function transcode(file, onProgress) {
  const ffmpeg = which('ffmpeg');
  if (!ffmpeg) return Promise.resolve({ ok: false, error: `需要 ffmpeg，请执行 ${pkgInstall('ffmpeg')}` });
  const info = probeMedia(file);
  // probeMedia 返回 Promise
  return Promise.resolve(info).then((meta) => {
    if (!meta.ok) return { ok: false, error: meta.error };
    const out = path.join(cacheDir(), `${cacheKey(file)}.mp4`);
    if (fs.existsSync(out) && fs.statSync(out).size > 0) {
      return { ok: true, cached: true, file: out };
    }
    const args = ['-y', '-i', file,
      '-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', out];
    return new Promise((resolve) => {
      const proc = spawn(ffmpeg, args, { windowsHide: true });
      let errBuf = '';
      proc.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        errBuf += text;
        const m = [...text.matchAll(/time=\s*(\d+):(\d+):([\d.]+)/g)].pop();
        if (m && meta.duration && onProgress) {
          const sec = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
          onProgress(Math.min(100, Math.round(sec / (+meta.duration) * 100)));
        }
      });
      proc.on('error', (e) => resolve({ ok: false, error: String(e.message || e) }));
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(out)) resolve({ ok: true, cached: false, file: out });
        else resolve({ ok: false, error: errBuf.slice(-600) || `ffmpeg 退出码 ${code}` });
      });
    });
  });
}

function clearCache() {
  try {
    const d = cacheDir();
    for (const f of fs.readdirSync(d)) {
      if (/\.mp4$/i.test(f)) { try { fs.unlinkSync(path.join(d, f)); } catch (_) {} }
    }
  } catch (_) {}
  return { ok: true };
}

module.exports = { which, pkgInstall, probeAll, probeMedia, transcode, clearCache, cacheDir };
