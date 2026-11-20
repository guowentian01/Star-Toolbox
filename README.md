# ☆Star工具箱☆ · 银河麒麟 / Linux 版（X86_64）

开物 Kaiwu v0.4.4（dls0412/kaiwu，GPL-3.0-or-later）的非官方衍生版。这是从 Windows 版
（C# / WinForms / WebView2 / .NET Framework 4.8）迁移而来的 **Electron 跨平台版**，
本工程专供 **银河麒麟 / Linux（X86_64 / amd64）**，macOS 版在独立的 StarToolbox-Cross 工程维护。

## 许可证

GPL-3.0-or-later。衍生改动同许可证。完整 GPL 声明见 `NOTICE.md`，源码要约见 `SOURCE-OFFER.txt`
（`guowentian@163.com`），第三方许可见 `THIRD-PARTY.md` 与 `licenses/`。

## 架构

```
渲染层  src/renderer/*   界面与交互（复用 web/index.html 视觉 + star-modules 模块思路）
安全桥  src/preload.js   contextBridge 白名单，渲染层拿不到 fs / child_process
宿主层  src/main.js      窗口、菜单、外链白名单、本地媒体 Range 服务、IPC handlers
工具层  src/lib/*         Excel OOXML / PDF / 转码 / 下载 / 系统工具探测
引擎层  系统 mpv          外部独立程序 + JSON IPC，不打包 mpv 二进制
```

**不打包 mpv / ffmpeg / yt-dlp**：这些是外部 GPL/其他许可程序，作为系统依赖调用，
规避 GPL 传染，也绕开龙芯 / 申威的交叉编译。分发只声明依赖，用户自行安装。

## 功能

- 首页：最近打开（逐条删除 / 清空）、快捷入口
- 媒体播放：`<video>` 播常见格式；系统 mpv 独立窗口兜底 mkv / flac / 外挂字幕 / 流媒体 / 硬解；
  大码率 HEVC/AV1 视频可选后台转 720p H.264 缓存（系统 ffmpeg）
- 文档编辑：轻量文本 / Markdown 编辑，本地保存
- 下载：yt-dlp 外部程序，进度实时显示
- 文件工具：
  - **Excel 按 Sheet 拆分到文件夹 / 合并**（纯 JS 原生 OOXML，字体/颜色/填充/数字格式/列宽/
    合并单元格保真，全离线，仅 xlsx/xlsm）
  - PDF 按页拆分 / 合并（pdf-lib）
  - 图片格式批量转换（系统 sips / ImageMagick）
  - 文本去重 / 去空行 / 大小写 / 倒序 / 统计
- 在线工具入口 ffee.me，应用内一键用系统浏览器打开

**已移除**（Windows 专属，无法在 mac 使用）：右键菜单管理（注册表）、Geek 卸载、Dism++、红果短剧。

## 功能概览

首页（最近打开/快捷入口）、媒体播放（`<video>` + 系统 mpv 兜底 + 大码率自动转码）、
文档工具（Excel 拆分合并 / PDF / 图片 / 文本）、yt-dlp 视频下载、最近文件，共 5 个栏目。

**已移除**（Windows 专属）：右键菜单管理、Geek 卸载、Dism++、红果短剧——本版不含这些程序。

## 本地开发（Linux 通用）

```bash
npm install
npm start
```

## 系统依赖（按需安装，不打包）

```bash
# 银河麒麟 / Debian / Ubuntu（X86_64）
sudo apt install mpv ffmpeg imagemagick yt-dlp
```

未安装某项不影响其他功能，右上角 ⚙ 可查看检测状态。若应用因 namespace/sandbox 报错无法启动，用 `STAR_NO_SANDBOX=1 npm start` 启动（安全沙箱默认开启，仅此开关关闭）。

## Linux 云打包（GitHub Actions）

本仓库含 `.github/workflows/build-linux.yml`，在 `ubuntu-latest` runner 上：
1. `npm install` 后 `npm run dist:linux` 产出 **deb + AppImage**（x64 / amd64）；
2. 上传为 Actions artifact `StarToolbox-Linux-x64`；打 `v*` tag 时自动附到 Release。

银河麒麟 X86_64 推荐装 `.deb`（`sudo dpkg -i StarToolbox_*.deb`，依赖不满足时再 `sudo apt -f install`）；
AppImage 为免安装单文件，下载后 `chmod +x` 双击运行。两者均为 amd64，与麒麟 X86_64 一致。

```bash
# 手动本地打包（需 Linux x64 机器）
npm run dist:linux             # deb + AppImage (x64)
npm run dist:linux:deb         # 仅 deb
npm run dist:linux:appimage    # 仅 AppImage
```

> 说明：MIPS64 / LoongArch64（龙芯 / 飞腾）不在本工程范围内，npm 无预编译 Electron，
> 需龙芯离线 Electron + `electron-packager`，且必须在目标架构机器上构建。

## 目录

```
├── src/
│   ├── main.js           主进程
│   ├── preload.js        安全桥
│   ├── mpv-bridge.js     mpv JSON IPC
│   ├── lib/
│   │   ├── ooxml.js      Excel 原生 OOXML 拆分/合并
│   │   ├── tools.js      Excel/PDF/图片/文本 IPC
│   │   ├── media-server.js  本地媒体 Range 服务
│   │   ├── system-tools.js  工具探测/媒体信息/转码
│   │   ├── download.js   yt-dlp 下载
│   │   └── recent.js     最近打开
│   └── renderer/         UI
├── build/icon.png        图标母版（2048 GX 玻璃）
├── .github/workflows/    Linux 云打包（build-linux.yml）
└── LICENSE.txt / NOTICE.md / THIRD-PARTY.md / SOURCE-OFFER.txt / licenses/
```
