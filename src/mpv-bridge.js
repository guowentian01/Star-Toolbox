/*!
 * ☆Star工具箱☆ · mpv 外部进程桥（JSON IPC）
 * GPL-3.0-or-later · 修改/创建：star，2026-11-13
 * 说明：本项目【不链接、不打包】mpv/libmpv，只把系统已安装的 mpv 当作独立程序调用，
 *       通过 --input-ipc-server 的 JSON IPC 控制。这样既避开原生模块在
 *       LoongArch64 / MIPS64 上的交叉编译，也避免把 mpv 的 GPL 传染进本发行物。
 */
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

/** 依次尝试的 mpv 可执行文件位置 */
function candidates() {
  const list = [];
  const env = process.env.STAR_MPV_PATH || process.env.MPV_PATH;
  if (env) list.push(env);

  if (process.platform === 'win32') {
    for (const key of ['LOCALAPPDATA', 'ProgramFiles', 'ProgramFiles(x86)']) {
      const root = process.env[key];
      if (!root) continue;
      list.push(path.join(root, 'mpv', 'mpv.exe'));
      list.push(path.join(root, 'mpv', 'mpv.com'));
    }
    list.push('mpv.exe', 'mpv');
  } else {
    list.push(
      '/usr/bin/mpv', '/usr/local/bin/mpv', '/opt/homebrew/bin/mpv',
      '/opt/mpv/bin/mpv', '/snap/bin/mpv', '/usr/bin/mpv-git', 'mpv'
    );
  }
  return list.filter(Boolean);
}

/** 探测系统是否可用 mpv；返回可执行路径或 null */
function findMpv() {
  for (const bin of candidates()) {
    try {
      const r = spawnSync(bin, ['--version'], {
        timeout: 4000, windowsHide: true, encoding: 'utf8', shell: false
      });
      const out = String(r.stdout || '') + String(r.stderr || '');
      if (r.status === 0 && /mpv\s+\d/i.test(out)) return bin;
    } catch (_) { /* 试下一个 */ }
  }
  return null;
}

class MpvBridge {
  /**
   * @param {string} bin mpv 可执行路径
   * @param {(event:object)=>void} onEvent 事件回调（会转发给渲染进程）
   */
  constructor(bin, onEvent) {
    this.bin = bin;
    this.onEvent = onEvent || function () {};
    this.proc = null;
    this.sock = null;
    this.buf = '';
    this.seq = 1;
    this.pending = new Map();
    this.socketPath = '';
    this.starting = null;
  }

  get running() {
    return !!(this.proc && !this.proc.killed);
  }

  start() {
    if (this.starting) return this.starting;
    if (this.running && this.sock) return Promise.resolve(true);
    this.starting = this._start().finally(() => { this.starting = null; });
    return this.starting;
  }

  async _start() {
    const id = crypto.randomBytes(6).toString('hex');
    this.socketPath = process.platform === 'win32'
      ? '\\\\.\\pipe\\star-toolbox-mpv-' + id
      : path.join(os.tmpdir(), 'star-toolbox-mpv-' + id + '.sock');

    const args = [
      '--idle=yes',
      '--force-window=yes',
      '--keep-open=yes',
      '--no-terminal',
      '--no-config',
      '--osc=yes',
      '--input-ipc-server=' + this.socketPath,
      '--title=☆Star工具箱☆ · mpv'
    ];

    // 独立窗口模式：不嵌入 Electron 窗口。
    // 原因：macOS 上 --wid 嵌入 Electron 会黑屏；原生 Wayland 也不支持 wid，
    //       独立窗口在 Windows / macOS / X11 / Xwayland 上表现一致。
    this.proc = spawn(this.bin, args, { stdio: 'ignore', windowsHide: false });
    this.proc.on('exit', () => {
      this.proc = null;
      this._failAll(new Error('mpv 已退出'));
    });
    this.proc.on('error', (err) => this._failAll(err));

    await this._connect(6000);
    // 订阅常用属性，供界面显示状态
    this.command(['observe_property', 1, 'pause']).catch(() => {});
    this.command(['observe_property', 2, 'time-pos']).catch(() => {});
    this.command(['observe_property', 3, 'filename']).catch(() => {});
    return true;
  }

  _connect(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const attempt = () => {
        if (!this.running) { reject(new Error('mpv 启动失败')); return; }
        const s = net.createConnection(this.socketPath);
        const onError = () => {
          s.removeAllListeners();
          s.destroy();
          if (Date.now() > deadline) {
            reject(new Error('无法连接 mpv IPC，请确认 mpv 版本支持 --input-ipc-server'));
          } else {
            setTimeout(attempt, 120);
          }
        };
        s.once('error', onError);
        s.once('connect', () => {
          s.removeListener('error', onError);
          s.setEncoding('utf8');
          this.sock = s;
          s.on('data', (chunk) => this._onData(chunk));
          s.on('error', () => this._failAll(new Error('mpv IPC 连接中断')));
          s.on('close', () => this._failAll(new Error('mpv IPC 已关闭')));
          resolve();
        });
      };
      attempt();
    });
  }

  _onData(chunk) {
    this.buf += chunk;
    let idx;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (_) { continue; }
      if (msg.request_id && this.pending.has(msg.request_id)) {
        const p = this.pending.get(msg.request_id);
        this.pending.delete(msg.request_id);
        clearTimeout(p.timer);
        if (msg.error && msg.error !== 'success') p.reject(new Error(msg.error));
        else p.resolve(msg.data);
      } else if (msg.event) {
        this.onEvent(msg);
      }
    }
  }

  _failAll(err) {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
    if (this.sock) { try { this.sock.destroy(); } catch (_) {} }
    this.sock = null;
  }

  command(args) {
    if (!this.sock) return Promise.reject(new Error('mpv 未就绪'));
    const id = this.seq++;
    const payload = JSON.stringify({ command: args, request_id: id }) + '\n';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('mpv 命令超时'));
      }, 8000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.sock.write(payload); } catch (e) { this._failAll(e); }
    });
  }

  set(property, value) { return this.command(['set_property', property, value]); }
  get(property) { return this.command(['get_property', property]); }
  play(file) { return this.command(['loadfile', file, 'replace']); }
  pause(v) { return this.set('pause', !!v); }
  seek(seconds) { return this.command(['seek', seconds, 'relative']); }
  stop() { return this.command(['stop']); }

  destroy() {
    if (this.sock) {
      try { this.sock.write(JSON.stringify({ command: ['quit'] }) + '\n'); } catch (_) {}
    }
    setTimeout(() => {
      if (this.sock) { try { this.sock.destroy(); } catch (_) {} }
      if (this.proc && !this.proc.killed) { try { this.proc.kill(); } catch (_) {} }
      this.sock = null;
      this.proc = null;
    }, 150);
  }
}

module.exports = { MpvBridge, findMpv };
