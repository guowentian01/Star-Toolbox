/*!
 * ☆Star工具箱☆ · 原生 OOXML 处理（纯 JS + JSZip，零第三方 XML 库）
 * GPL-3.0-or-later · star · 2026-11-19
 * 对应 Windows 版 ExcelOps.cs：xlsx 本质是 ZIP + XML，只改必要部件，其余
 * （styles/sharedStrings/theme/drawing）原样保留 → 格式零损。
 */
'use strict';

const JSZip = require('jszip');
const fs = require('node:fs');
const path = require('node:path');

const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function readFile(p) { return fs.readFileSync(p); }
function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}
function uniqSheetName(name, used) {
  let n = String(name || 'Sheet').replace(/[\\/?*\[\]:]/g, '_').slice(0, 31) || 'Sheet';
  if (!used.has(n.toLowerCase())) { used.add(n.toLowerCase()); return n; }
  let k = 2;
  while (true) {
    const suffix = ` (${k})`;
    const cand = n.slice(0, 31 - suffix.length) + suffix;
    if (!used.has(cand.toLowerCase())) { used.add(cand.toLowerCase()); return cand; }
    k++;
  }
}
function normSheetPath(target) {
  let t = String(target || '').replace(/^\//, '');
  if (t.startsWith('xl/')) return t;
  if (t.startsWith('worksheets/')) return 'xl/' + t;
  return 'xl/' + t;
}
function attrs(tagBody) {
  const out = {};
  for (const m of tagBody.matchAll(/([A-Za-z0-9:_-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}
function relsOf(xml) {
  return [...xml.matchAll(/<Relationship\b([^>]*)\/>/g)].map(m => attrs(m[1]));
}

/** 读取一个 xlsx 的结构摘要 */
async function inspect(file) {
  const zip = await JSZip.loadAsync(readFile(file));
  const wbXml = await zip.file('xl/workbook.xml').async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const sheets = [...wbXml.matchAll(/<sheet\b([^>]*)\/>/g)].map(m => attrs(m[1]));
  return { zip, wbXml, relsXml, sheets, rels: relsOf(relsXml) };
}

/** 拆分：每个 worksheet 输出为独立 xlsx，原样保真。返回 [{name, data:Buffer}] */
async function split(file) {
  const { zip, wbXml, relsXml, sheets, rels } = await inspect(file);
  let ctXml = await zip.file('[Content_Types].xml').async('string');
  const results = [];

  for (const sheet of sheets) {
    const rel = rels.find(r => r.Id === sheet['r:id']);
    if (!rel) continue;
    const sheetPath = normSheetPath(rel.Target);

    const out = new JSZip();
    for (const [name, entry] of Object.entries(zip.files)) {
      if (!entry.dir) out.file(name, await entry.async('nodebuffer'));
    }

    // workbook.xml：只保留当前 sheet
    let newWb = wbXml.replace(/<sheets>[\s\S]*?<\/sheets>/, () => {
      const one = `<sheet name="${sheet.name}" sheetId="${sheet.sheetId}" r:id="${sheet['r:id']}"` +
        (sheet.state && sheet.state !== 'visible' ? ` state="${sheet.state}"` : '') + '/>';
      return `<sheets>${one}</sheets>`;
    });
    newWb = newWb.replace(/<definedNames>[\s\S]*?<\/definedNames>/, '');
    out.file('xl/workbook.xml', newWb);

    // rels：只保留当前 worksheet 关系，其余同等部件（styles/theme/sharedStrings）保留
    let newRels = relsXml.replace(/<Relationship\b[^>]*\/>/g, (tag) => {
      const a = attrs(tag.replace(/^<Relationship\b|\/>$/g, ''));
      if ((a.Type || '').endsWith('/worksheet') && a.Id !== sheet['r:id']) return '';
      return tag;
    });
    out.file('xl/_rels/workbook.xml.rels', newRels);

    // 删除其它 worksheet 及其 rels
    for (const r of rels) {
      if (r.Id !== sheet['r:id'] && (r.Type || '').endsWith('/worksheet')) {
        const p = normSheetPath(r.Target);
        out.remove(p);
        out.remove('xl/worksheets/_rels/' + path.basename(p) + '.rels');
        const part = '/' + p;
        const esc = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        ctXml = ctXml.replace(new RegExp(`<Override\\b[^>]*PartName="${esc}"[^>]*\\/>`, 'g'), '');
      }
    }
    out.remove('xl/calcChain.xml');
    let thisCt = ctXml.replace(/<Override\b[^>]*calcChain[^>]*\/>/g, '');
    out.file('[Content_Types].xml', thisCt);

    const base = path.basename(file, path.extname(file));
    const safe = String(sheet.name).replace(/[\\/?*\[\]:]/g, '_');
    results.push({ name: `${base}-${safe}.xlsx`, data: await out.generateAsync({ type: 'nodebuffer' }) });
  }
  return results;
}

/* ---------------- 样式合并 ---------------- */
const STYLE_TAGS = ['numFmts', 'fonts', 'fills', 'borders', 'cellStyleXfs', 'cellXfs', 'dxfs'];
const CHILD_TAG = {
  numFmts: 'numFmt', fonts: 'font', fills: 'fill', borders: 'border',
  cellStyleXfs: 'xf', cellXfs: 'xf', dxfs: 'dxf'
};

/** 提取容器（如 <fonts>）内部的单数子节点（如 <font>），保留每个节点的完整 XML。 */
function childrenOf(xml, containerTag) {
  const child = CHILD_TAG[containerTag];
  const cRe = new RegExp(`<${containerTag}\\b[^>]*>([\\s\\S]*?)<\\/${containerTag}>`, 'm');
  const cm = cRe.exec(xml);
  if (!cm) return [];
  const body = cm[1];
  const nodeRe = new RegExp(`<${child}\\b[^>]*?\\/>|<${child}\\b[^>]*?>[\\s\\S]*?<\\/${child}>`, 'g');
  return [...body.matchAll(nodeRe)].map(m => m[0]);
}
function innerOf(node, tag) {
  const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(node);
  return m ? m[1] : '';
}
function nodeKey(tag, node) {
  if (tag === 'numFmts') return node;
  const child = CHILD_TAG[tag];
  return innerOf(node, child) || node;
}
function replaceSection(xml, tag, nodes) {
  const openRe = new RegExp(`<${tag}\\b[^>]*?\\/?>`);
  const sm = openRe.exec(xml);
  if (!sm) {
    if (!nodes.length) return xml;
    const block = `<${tag} count="${nodes.length}">${nodes.join('')}</${tag}>`;
    return xml.includes('</styleSheet>')
      ? xml.replace('</styleSheet>', block + '</styleSheet>')
      : xml + block;
  }
  const raw = sm[0];
  if (raw.endsWith('/>')) {
    if (!nodes.length) return xml;
    const open = raw.slice(0, -2).replace(/count="\d+"/, `count="${nodes.length}"`) + '>';
    return xml.slice(0, sm.index) + open + nodes.join('') + `</${tag}>` + xml.slice(sm.index + raw.length);
  }
  const end = `</${tag}>`;
  const ei = xml.indexOf(end, sm.index);
  if (ei === -1) return xml;
  const open = raw.replace(/count="\d+"/, `count="${nodes.length}"`);
  return xml.slice(0, sm.index) + open + nodes.join('') + end + xml.slice(ei + end.length);
}

class StyleMerger {
  constructor() { this.master = null; this.def = {}; for (const k of STYLE_TAGS) this.def[k] = []; }
  addBook(stylesXml) {
    if (!this.master) {
      this.master = stylesXml;
      for (const k of STYLE_TAGS) this.def[k] = childrenOf(stylesXml, k);
      return this._identity();
    }
    const map = {};
    for (const k of STYLE_TAGS) {
      const nodes = childrenOf(stylesXml, k);
      map[k] = [];
      for (const node of nodes) {
        const key = nodeKey(k, node);
        let idx = this.def[k].findIndex(n => nodeKey(k, n) === key);
        if (idx === -1) { idx = this.def[k].length; this.def[k].push(node); }
        map[k].push(idx);
      }
    }
    return map;
  }
  _identity() {
    const m = {};
    for (const k of STYLE_TAGS) m[k] = this.def[k].map((_, i) => i);
    return m;
  }
  build() {
    let out = this.master || '<styleSheet/>';
    for (const k of STYLE_TAGS) out = replaceSection(out, k, this.def[k]);
    return out;
  }
}

function remapStyles(sheetXml, map) {
  const cellXfs = map.cellXfs || [], colStyle = map.cellStyleXfs || [], dxfs = map.dxfs || [];
  const pick = (arr, n) => (arr[+n] === undefined ? n : arr[+n]);
  let out = sheetXml;
  out = out.replace(/(<c\b[^>]*?\bs=")(\d+)(")/g, (m, a, n, b) => a + pick(cellXfs, n) + b);
  out = out.replace(/(<col\b[^>]*?\bstyle=")(\d+)(")/g, (m, a, n, b) => a + pick(colStyle, n) + b);
  out = out.replace(/(<row\b[^>]*?\bs=")(\d+)(")/g, (m, a, n, b) => a + pick(colStyle, n) + b);
  out = out.replace(/\bdxfId="(\d+)"/g, (m, n) => `dxfId="${pick(dxfs, n)}"`);
  return out;
}

function inlineSharedStrings(sheetXml, sharedXml) {
  const strings = sharedXml
    ? [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => m[1]) : [];
  if (!strings.length) return sheetXml;
  return sheetXml.replace(/<c\b([^>]*?)\bt="s"([^>]*?)>([\s\S]*?)<\/c>/g, (m, a, b, body) => {
    const vm = /<v>(\d+)<\/v>/.exec(body);
    if (!vm) return m;
    const si = strings[+vm[1]];
    if (si === undefined) return m;
    const text = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('');
    return `<c${a} t="inlineStr"${b}><is><t>${text}</t></is></c>`;
  });
}

async function copyExtras(z, sheetRelPath, out) {
  let srel;
  try { srel = await z.file(sheetRelPath).async('string'); } catch (_) { return; }
  let changed = srel;
  for (const m of srel.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const a = attrs(m[1]);
    const type = a.Type || '', target = String(a.Target || '').replace(/^\.\.\//, '').replace(/^\//, '');
    if (/\/(drawing|table|comments)$/.test(type)) {
      const src = 'xl/' + target;
      try {
        const buf = await z.file(src).async('nodebuffer');
        if (buf) out.file(src, buf);
      } catch (_) {}
    }
  }
  return changed;
}

/** 合并：多个 xlsx 按 sheet 合并为一个（保真） */
async function merge(files, addPrefix) {
  if (!files.length) throw new Error('没有可合并的文件');
  const books = [];
  for (const file of files) {
    const info = await inspect(file);
    let stylesXml = await info.zip.file('xl/styles.xml').async('string');
    let shared = null;
    try { shared = await info.zip.file('xl/sharedStrings.xml').async('string'); } catch (_) {}
    books.push({
      ...info, stylesXml, shared,
      bookName: path.basename(file, path.extname(file))
    });
  }

  const out = new JSZip();
  for (const [name, entry] of Object.entries(books[0].zip.files)) {
    if (!entry.dir) out.file(name, await entry.async('nodebuffer'));
  }

  const merger = new StyleMerger();
  const maps = books.map(b => merger.addBook(b.stylesXml));

  let relsXml = books[0].relsXml;
  let ctXml = await books[0].zip.file('[Content_Types].xml').async('string');
  let wbXml = books[0].wbXml;

  const used = new Set();
  const records = [];
  let sheetIdSeq = Math.max(100, ...books[0].sheets.map(s => +s.sheetId || 0));
  let newFileSeq = 100, newRidSeq = 100;

  for (let bi = 0; bi < books.length; bi++) {
    const b = books[bi];
    for (const s of b.sheets) {
      const finalName = uniqSheetName(addPrefix ? `${b.bookName}-${s.name}` : s.name, used);
      const rel = b.rels.find(r => r.Id === s['r:id']);
      const srcPath = normSheetPath(rel && rel.Target);
      if (bi === 0) {
        records.push({ book: b, sheet: s, finalName, sheetId: +s.sheetId || ++sheetIdSeq,
          rid: s['r:id'], srcPath, path: srcPath, map: maps[bi], isNew: false });
      } else {
        const nf = `xl/worksheets/sheet${++newFileSeq}.xml`;
        records.push({ book: b, sheet: s, finalName, sheetId: ++sheetIdSeq,
          rid: `rId${++newRidSeq}`, srcPath, path: nf, map: maps[bi], isNew: true });
      }
    }
  }

  for (const rec of records) {
    let sx = await rec.book.zip.file(rec.srcPath).async('string');
    sx = inlineSharedStrings(sx, rec.book.shared);
    sx = remapStyles(sx, rec.map);
    out.file(rec.path, sx);

    if (rec.isNew) {
      const target = rec.path.replace(/^xl\//, '');
      relsXml = relsXml.replace(/<\/Relationships>/,
        `<Relationship Id="${rec.rid}" Type="${OFFICE_REL}/worksheet" Target="${target}"/></Relationships>`);
      ctXml = ctXml.replace(/<\/Types>/,
        `<Override PartName="/${rec.path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
      await copyExtras(rec.book.zip, 'xl/worksheets/_rels/' + path.basename(rec.srcPath) + '.rels', out);
    }
  }

  const sheetsXml = records.map(r =>
    `<sheet name="${xmlEscape(r.finalName)}" sheetId="${r.sheetId}" r:id="${r.rid}"` +
    (r.sheet.state && r.sheet.state !== 'visible' ? ` state="${r.sheet.state}"` : '') + '/>'
  ).join('');
  wbXml = wbXml.replace(/<sheets>[\s\S]*?<\/sheets>/, `<sheets>${sheetsXml}</sheets>`)
    .replace(/<definedNames>[\s\S]*?<\/definedNames>/, '');

  out.file('xl/workbook.xml', wbXml);
  out.file('xl/_rels/workbook.xml.rels', relsXml);
  out.file('[Content_Types].xml', ctXml);
  out.file('xl/styles.xml', merger.build());
  out.remove('xl/calcChain.xml');

  return await out.generateAsync({ type: 'nodebuffer' });
}

module.exports = { inspect, split, merge };
