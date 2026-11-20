/*!
 * ☆Star工具箱☆ · 本地媒体 HTTP(Range) 服务
 * GPL-3.0-or-later · star
 * 让 <video> 能播本地文件并支持拖动进度（Range 请求），无需把文件读进内存。
 * 只监听 127.0.0.1，且路径先注册、凭 token 访问，防目录穿越与本地文件泄露。
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const registry = new Map(); // token -> filePath
let server = null;
let port = 0;

const MIME = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm',
  '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime',
  '.flv': 'video/x-flv', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.flac': 'audio/flac', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.srt': 'application/x-subrip',
  '.vtt': 'text/vtt', '.ass': 'text/plain'
};

function ensureServer() {
  if (server) return Promise.resolve(port);
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      let urlPath;
      try { urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
      catch (_) { res.writeHead(400).end(); return; }
      const m = urlPath.match(/^\/media\/([a-f0-9]+)\/([^/]+)$/);
      if (!m) { res.writeHead(404).end(); return; }
      const token = m[1];
      const file = registry.get(token);
      if (!file || !fs.existsSync(file)) { res.writeHead(404).end(); return; }

      const stat = fs.statSync(file);
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const range = req.headers.range;

      if (range) {
        const parts = /bytes=(\d*)-(\d*)/.exec(range);
        if (!parts) { res.writeHead(416).end(); return; }
        let start = parts[1] ? parseInt(parts[1], 10) : 0;
        let end = parts[2] ? parseInt(parts[2], 10) : stat.size - 1;
        if (start >= stat.size || end >= stat.size) end = stat.size - 1;
        if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return; }
        res.writeHead(206, {
          'Content-Type': type,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store'
        });
        fs.createReadStream(file, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Type': type,
          'Content-Length': stat.size,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store'
        });
        fs.createReadStream(file).pipe(res);
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve(port);
    });
  });
}

/** 注册文件，返回可访问 URL（同文件重复注册复用 token） */
async function register(file) {
  if (!file || typeof file !== 'string' || !fs.existsSync(file)) {
    return { ok: false, error: '文件不存在' };
  }
  for (const [token, p] of registry) if (p === file) {
    return { ok: true, url: urlOf(token, file), token };
  }
  await ensureServer();
  const token = crypto.randomBytes(8).toString('hex');
  registry.set(token, file);
  return { ok: true, url: urlOf(token, file), token };
}

function urlOf(token, file) {
  return `http://127.0.0.1:${port}/media/${token}/${encodeURIComponent(path.basename(file))}`;
}

function list() {
  return Array.from(registry, ([token, file]) => ({ token, file, url: urlOf(token, file) }));
}

function clear() {
  registry.clear();
  if (server) { try { server.close(); } catch (_) {} server = null; }
}

module.exports = { register, list, clear };
