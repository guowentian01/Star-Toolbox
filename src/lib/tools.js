/*!
 * ☆Star工具箱☆ · 文件工具 IPC（Excel / PDF / 图片 / 文本）
 * GPL-3.0-or-later · star
 * Excel 保真见 ooxml.js；PDF 用 pdf-lib（MIT，许可见 licenses/pdf-lib.txt）。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const ooxml = require('./ooxml');

function register(ipcMain, win) {
  const send = (ch, payload) => { if (win && win.webContents) win.webContents.send(ch, payload); };

  /* ---------- Excel ---------- */
  ipcMain.handle('excel:split', async (_e, files) => {
    try {
      if (!Array.isArray(files) || !files.length) return { ok: false, error: '未选择文件' };
      const { shell, dialog } = require('electron');
      const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: '选择拆分结果保存文件夹' });
      if (r.canceled) return { ok: false, canceled: true };
      const folder = r.filePaths[0];
      const names = [];
      for (const file of files) {
        const parts = await ooxml.split(file);
        for (const part of parts) {
          let target = path.join(folder, part.name);
          let k = 2;
          const ext = path.extname(target), stem = path.basename(target, ext);
          while (fs.existsSync(target)) { target = path.join(folder, `${stem} (${k++})${ext}`); }
          fs.writeFileSync(target, part.data);
          names.push(path.basename(target));
        }
      }
      send('excel:done', { op: 'split', folder });
      return { ok: true, folder, count: names.length, names };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  ipcMain.handle('excel:merge', async (_e, opts) => {
    try {
      const files = opts && opts.files;
      if (!Array.isArray(files) || files.length < 2) return { ok: false, error: '请至少选择两个 xlsx 文件' };
      const { dialog } = require('electron');
      const r = await dialog.showSaveDialog(win, {
        title: '保存合并结果',
        defaultPath: path.join(path.dirname(files[0]), '合并结果.xlsx'),
        filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
      });
      if (r.canceled) return { ok: false, canceled: true };
      const buf = await ooxml.merge(files, !!opts.addPrefix);
      fs.writeFileSync(r.filePath, buf);
      send('excel:done', { op: 'merge', file: r.filePath });
      return { ok: true, file: r.filePath };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  ipcMain.handle('excel:inspect', async (_e, file) => {
    try {
      const info = await ooxml.inspect(file);
      return { ok: true, sheets: info.sheets.map(s => ({ name: s.name, sheetId: s.sheetId, state: s.state })) };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  /* ---------- PDF ---------- */
  ipcMain.handle('pdf:split', async (_e, file) => {
    try {
      const bytes = fs.readFileSync(file);
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const count = src.getPageCount();
      const { dialog } = require('electron');
      const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: '选择 PDF 拆分保存文件夹' });
      if (r.canceled) return { ok: false, canceled: true };
      const folder = r.filePaths[0];
      const base = path.basename(file, path.extname(file));
      const names = [];
      for (let i = 0; i < count; i++) {
        const doc = await PDFDocument.create();
        const [page] = await doc.copyPages(src, [i]);
        doc.addPage(page);
        const out = path.join(folder, `${base}-第${i + 1}页.pdf`);
        fs.writeFileSync(out, await doc.save());
        names.push(path.basename(out));
      }
      return { ok: true, folder, count, names };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  ipcMain.handle('pdf:merge', async (_e, files) => {
    try {
      if (!Array.isArray(files) || files.length < 2) return { ok: false, error: '请至少选择两个 PDF' };
      const { dialog } = require('electron');
      const r = await dialog.showSaveDialog(win, {
        defaultPath: path.join(path.dirname(files[0]), '合并结果.pdf'),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });
      if (r.canceled) return { ok: false, canceled: true };
      const merged = await PDFDocument.create();
      for (const file of files) {
        const doc = await PDFDocument.load(fs.readFileSync(file), { ignoreEncryption: true });
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      fs.writeFileSync(r.filePath, await merged.save());
      return { ok: true, file: r.filePath };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  ipcMain.handle('pdf:info', async (_e, file) => {
    try {
      const doc = await PDFDocument.load(fs.readFileSync(file), { ignoreEncryption: true });
      return { ok: true, pages: doc.getPageCount() };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  /* ---------- 图片（用系统 sips / ImageMagick，不打包原生模块） ---------- */
  ipcMain.handle('image:convert', async (_e, opts) => {
    try {
      const { which } = require('./system-tools');
      const { spawnSync } = require('node:child_process');
      const files = opts.files || [];
      const fmt = String(opts.format || 'png').toLowerCase();
      const bin = which('sips') || which('magick') || which('convert');
      if (!bin) return { ok: false, error: '需要系统图片工具（macOS 自带 sips）' };
      const outdir = opts.outdir || path.dirname(files[0] || '.');
      fs.mkdirSync(outdir, { recursive: true });
      const results = [];
      for (const file of files) {
        const base = path.basename(file, path.extname(file));
        const out = path.join(outdir, `${base}.${fmt}`);
        let args;
        if (path.basename(bin) === 'sips') args = ['-s', 'format', fmt, file, '--out', out];
        else args = [file, out];
        const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 30000 });
        if (r.status === 0 && fs.existsSync(out)) results.push(out);
      }
      return { ok: true, files: results };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  /* ---------- 文本工具 ---------- */
  ipcMain.handle('text:process', async (_e, opts) => {
    try {
      const mode = opts.mode;
      let text = String(opts.text || '');
      switch (mode) {
        case 'upper': text = text.toUpperCase(); break;
        case 'lower': text = text.toLowerCase(); break;
        case 'trim': text = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).join('\n'); break;
        case 'dedup': text = [...new Set(text.split(/\r?\n/))].join('\n'); break;
        case 'count': return { ok: true, result: `字符 ${text.length} · 行数 ${text.split(/\r?\n/).length} · 词数 ${(text.match(/\S+/g) || []).length}` };
        case 'reverse': text = text.split('').reverse().join(''); break;
        default: return { ok: false, error: '未知操作' };
      }
      return { ok: true, result: text };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  ipcMain.handle('text:readFile', async (_e, file) => {
    try { return { ok: true, text: fs.readFileSync(file, 'utf8') }; }
    catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.handle('text:saveFile', async (_e, opts) => {
    try {
      fs.writeFileSync(opts.file, String(opts.text || ''), 'utf8');
      return { ok: true };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  /* ---------- 转码缓存（用系统 ffmpeg） ---------- */
  ipcMain.handle('transcode:check', async (_e, file) => {
    try { const st = require('./system-tools'); return await st.probeMedia(file); }
    catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.handle('transcode:run', async (_e, file) => {
    try {
      const st = require('./system-tools');
      return await st.transcode(file, (percent) => send('transcode:progress', { file, percent }));
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.handle('transcode:clear', async () => {
    try { return require('./system-tools').clearCache(); }
    catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
}

module.exports = { register };
