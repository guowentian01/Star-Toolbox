# ☆Star工具箱☆ · 跨平台版（macOS 优先）

开物 Kaiwu v0.4.4（dls0412/kaiwu，GPL-3.0-or-later）的非官方衍生版。这是从 Windows 版
（C# / WinForms / WebView2 / .NET Framework 4.8）迁移而来的 **Electron 跨平台版**，
macOS 优先，Windows / Linux 兼容。

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

## 系统依赖（按需安装）

```bash
# macOS
brew install mpv ffmpeg yt-dlp

# Linux (Debian/银河麒麟)
sudo apt install mpv ffmpeg yt-dlp
```

未安装某项不影响其他功能，设置（右上角 ⚙）里可查看检测状态。

## 本地开发（Windows / macOS 通用）

```bash
npm install
npm start
```

## macOS 云打包（GitHub Actions）

本仓库含 `.github/workflows/build-mac.yml`，在 macOS runner 上：
1. 用系统 `sips` + `iconutil` 从 `build/icon.png` 生成 `build/icon.icns`；
2. `npm install` 后 `npm run dist:mac` 产出 universal `.dmg`；
3. 上传为 Actions artifact；打 `v*` tag 时自动附到 Release。

打包采用 ad-hoc 签名（无需 Apple 开发者账号），首次打开需右键 → 打开。
如需正式签名 + 公证，在 workflow 中加入 Apple Developer 证书与 `xcrun notarytool`
（需配置 `APPLE_ID` / `APPLE_TEAM_ID` / `APPLE_APP_PASSWORD` secrets）。

```bash
# 手动本地打包（仅 macOS 机器）
npm run dist:mac          # universal (x64 + arm64)
npm run dist:mac:arm64
npm run dist:mac:x64
```

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
├── .github/workflows/    macOS 云打包
└── LICENSE.txt / NOTICE.md / THIRD-PARTY.md / SOURCE-OFFER.txt / licenses/
```
