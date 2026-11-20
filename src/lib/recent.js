/*!
 * ☆Star工具箱☆ · 最近打开（跨平台）
 * GPL-3.0-or-later · star
 * 对应 Windows 版 HomeView.cs 的 RecentStore，改存到 Electron userData 下 JSON。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const MAX = 30;
let cache = null;

function file() {
  return path.join(app.getPath('userData'), 'recent-files.json');
}

function load() {
  if (cache) return cache;
  try {
    const data = JSON.parse(fs.readFileSync(file(), 'utf8'));
    cache = Array.isArray(data) ? data.filter(x => x && typeof x.path === 'string') : [];
  } catch (_) {
    cache = [];
  }
  return cache;
}

function save() {
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(cache, null, 2), 'utf8');
  } catch (_) {}
}

function list() {
  return load().slice(0, MAX);
}

function add(file) {
  if (typeof file !== 'string' || !file) return list();
  const items = load().filter(x => x.path.toLowerCase() !== file.toLowerCase());
  let name = path.basename(file);
  let size = null;
  let mtime = null;
  try {
    const st = fs.statSync(file);
    size = st.size;
    mtime = st.mtimeMs;
  } catch (_) {}
  items.unshift({ path: file, name, size, mtime, openedAt: Date.now() });
  cache = items.slice(0, MAX);
  save();
  return list();
}

function remove(file) {
  cache = load().filter(x => x.path.toLowerCase() !== String(file).toLowerCase());
  save();
  return list();
}

function clear() {
  cache = [];
  save();
  return list();
}

module.exports = { list, add, remove, clear };
