# ☆Star工具箱☆ — 许可证与修改声明

本文件是本分发包的正式法律通知（Appropriate Legal Notices），随二进制程序一同分发，请勿删除。

> **版本说明**：本工程为 ☆Star工具箱☆ 的**银河麒麟 / Linux（X86_64）Electron 版**。下文"来源与身份""修改记录"沿袭自同一 GPL 衍生项目的完整变更历史（含早期 Windows 版条目，用于履行 GPL 变更声明义务）；其中 Windows 专属的内置工具（ContextMenuManager / Geek / Dism++ / 红果短剧）**不在本版源码与打包范围内**，仅作为历史记录保留文字描述。本版实际随包内容见第 6 节。

## 1. 来源与身份

- 本软件 **☆Star工具箱☆** 是 **开物 Kaiwu v0.4.4** 的非官方衍生版本（下称"上游"）。
- 上游项目：<https://github.com/dls0412/kaiwu>，Release tag `v0.4.4`，commit `576df19ed663ca8b383124c2cf32f1a31b2a5a40`（2026-11-09）。
- 上游作者为 dls0412 及开物贡献者。**本分发版与上游作者无关联，未获其背书、支持或授权**；名称与品牌已更改，以免被误认为官方版本。
- 自 2026-11-18 起，主程序已由源码重新编译为 `StarToolbox.exe`，窗口标题、任务栏图标、内嵌图标均已统一为「☆Star工具箱☆」，是本分发包唯一的可执行主程序。

## 2. 许可证

- 上游代码按 **GNU General Public License v3.0 or later (GPL-3.0-or-later)** 发布，许可证全文见本目录 `LICENSE.txt`。
- 本分发版对上游的全部修改与新增文件，**同样按 GPL-3.0-or-later 授权**，不附加任何额外限制。任何接收者都有权依该许可证复制、修改和再分发。
- 第三方组件保留各自许可与版权声明，见 `THIRD-PARTY.md` 与 `licenses/` 目录（LibreOffice/ZetaOffice、ZetaJS、PDF.js、pdf-lib、WebView2 SDK、Lux、whisper.cpp、Whisper 模型、libmpv/FFmpeg 等）。这些组件不受本项目 GPL 条款替换。
- 本软件按"现状"提供，**不提供任何明示或默示担保**（GPLv3 第 15、16 条）。

## 3. 修改声明（GPLv3 第 5 条）

| 项目 | 内容 |
| --- | --- |
| 修改者 | star（☆Star工具箱☆ 分发版维护者） |
| 修改日期 | 2026-11-13；图标替换 2026-11-18；首页"最近打开"增加单条删除按钮 2026-11-18；顶部导航品牌名完整显示 2026-11-18；图标改为 GX 磨砂底板版 2026-11-18；首页顶部 logo 单独用回透明底 GX 版 2026-11-18；新增大码率视频自动转码缓存 2026-11-18；Excel 按 Sheet 拆分/合并且格式保真 2026-11-19；全套图标统一换为新版 GX 玻璃图标（透明底）2026-11-19；图标文件统一更名 kaiwu.ico → star.ico 2026-11-19；内置 GPL-3.0 开源工具 ContextMenuManager 3.3.3.1 2026-11-19；随包聚合 Geek Uninstaller / Dism++ / 红果短剧播放器三个闭源工具并从工具页直接调用 2026-11-19 |
| 基于版本 | 开物 Kaiwu v0.4.4 / commit `576df19` |

改动文件清单（相对上游 tag；发布包路径 → 源码仓库路径）：

| 发布包路径 | 上游源码路径 | 改动内容 |
| --- | --- | --- |
| `StarToolbox.exe`（重编译，原 `开物.exe`） | 上游 `src/*.cs` + `build.ps1` | 2026-11-18 从源码重编译：窗口标题 / MessageBox / 提示文字品牌统一为「☆Star工具箱☆」；`/win32icon` 指向新 GX 图标；exe 更名；应用 `host-openExternal.patch`（http/https 白名单外链打开）。注册表登记名按兼容性要求保持「开物」不变。2026-11-18 追加：首页"最近打开"每行右侧新增 `×` 删除按钮，可从列表中逐条移除记录（仅删记录、不删实际文件），修改位于 `src/HomeView.cs`（`RecentStore.Remove`、`RecentButton`、`UpdateRecent`） |
| `source/build-ready/src/HomeView.cs` | 上游 `src/HomeView.cs` | 首页"最近打开"单条删除按钮的实现源码，已编译进当前 `StarToolbox.exe` |
| `source/build-ready/src/WindowChrome.cs` | 上游 `src/WindowChrome.cs` | 顶部导航布局调整：品牌名「☆Star工具箱☆」文字框由 94px 加宽至 180px 以完整显示（原被截断为「☆St...」）；分隔线与「首页/媒体/文档/下载/工具」导航区整体右移；窄窗口自适应收缩避免与窗口按钮重叠。已编译进当前 `StarToolbox.exe` |
| `source/build-ready/src/Player.cs`、`src/Transcoder.cs`（**新增**） | 上游 `src/Player.cs` | 2026-11-18 新增"流畅播放"：打开 HEVC / AV1 / VP9 高分辨率视频时，用随附 libmpv 的编码能力在后台转成 720p H.264 缓存（缺少 HEVC 硬解的显卡可流畅播放）；命中缓存直接播放、转完无缝切换，带进度提示与右键菜单开关/清缓存。缓存位于 `%LOCALAPPDATA%\GlintPlayer\transcode\`。补丁见 `source/player-autotranscode.patch`、`source/Transcoder.cs.reference` |
| `source/build-ready/build.ps1` | 上游 `build.ps1` | 编译清单加入 `src/Transcoder.cs`、`src/ExcelOps.cs`，并加入 `System.Xml.dll` / `System.Xml.Linq.dll` 引用 |
| `app/tools.html`、`app/tools.js` | 上游 `documents/app/tools.html`、`tools.js` | 在「文件工具」栏新增「Excel 表格」：按 Sheet 拆分（选择目标文件夹后，每个工作表各存为一个 xlsx 直接写入，不打包压缩包）、多表格按 Sheet 合并（可选择加来源文件名前缀、工作表名去重与非法字符清洗）。2026-11-19 由初版的 SheetJS 单元格序列化改为**原生 OOXML 保真方案**：直接读写 xlsx(ZIP) 包底层结构，完整保留字体/颜色/填充/边框/数字格式/列宽/行高/合并单元格等样式。处理全部在本机完成，不上传 |
| `source/build-ready/src/ExcelOps.cs`（**新增**） | — | Excel 保真拆分/合并的 OOXML 实现：拆分时整包复制、只改 workbook.xml 工作表清单与关系，样式/主题/共享字符串原封不动；合并时累积各源工作簿的 fonts/fills/borders/numFmts/cellXfs/dxfs 并重映射单元格样式索引，共享字符串转内联串避免索引冲突，drawing/table/comment 等附属资源按依赖关系复制。已编译进当前 `StarToolbox.exe`。此前一度引入的 SheetJS 因丢失格式已弃用并从包中移除 |
| `source/build-ready/src/ToolServices.cs`、`src/Tools.cs` | 上游同名文件 | `toolSave` 允许保存 `.xlsx`；文件类型白名单纳入 `.xlsx/.xlsm/.xls/.csv`（支持资源管理器打开直接进入 Excel 工具）。2026-11-19 追加宿主命令 `toolExcelSplit` / `toolExcelMerge`，按 token 直接读取源文件（不经 base64，规避大小限制），Excel 模式文件对话框限定 xlsx/xlsm。拆分命令弹 `FolderBrowserDialog` 选择保存目录、直接落盘各工作表 xlsx（重名自动加 `(2)`），不再生成 ZIP。已编译进当前 `StarToolbox.exe` |
| `app/index.html` | `documents/app/index.html` | 品牌文字改为「☆Star工具箱☆」；关于弹窗增加开源与许可声明；挂载模块脚本；加入修改声明注释 |
| `app/app.js` | `documents/app/app.js` | 文档标题、打印提示中的品牌文字；加入修改声明注释 |
| `app/tools.html` | `documents/app/tools.html` | 页面标题、品牌按钮、工具导航栏；挂载模块脚本；加入修改声明注释 |
| `app/star-modules.js` | **新增** | 可扩展模块入口：工具栏「在线工具 ↗」指向 `https://ffee.me/zh/`；模块注册表、宿主/浏览器双通道打开与降级、公开扩展接口 |
| `helpers/contextmenu/ContextMenuManager.exe`、`source/third-party/ContextMenuManager/`、`app/tools.html`、`app/tools.js`、`src/ToolServices.cs` | **新增**（内置第三方 GPL 工具） | 2026-11-19 新增「右键菜单管理」：随包内置开源工具 **ContextMenuManager 3.3.3.1**（<https://github.com/BluePointLilac/ContextMenuManager>，GPL-3.0，作者 BluePointLilac），点击文件工具导航栏按钮由宿主启动随包 exe（固定路径、不接受外部传参），用于管理 Windows 文件/文件夹右键菜单。本分发版**未修改**该工具源码，仅原样内置；其完整源码、LICENSE（GPL-3.0）与官方 exe 一并置于 `source/third-party/ContextMenuManager/`，第三方声明见 `THIRD-PARTY.md`。宿主侧仅新增 `toolLaunchContextMenu` 一条命令，前端新增一个导航按钮与 action |
| `web/index.html` | **新增** | 单文件跨平台 Web 入口，供 macOS / 银河麒麟等系统的浏览器使用 |
| `star.ico`（原 `kaiwu.ico`，2026-11-19 更名）、`ui/app-icon*.png`、`ui/icon-sizes/*`、`app/icon.svg`、`ui/app-icon.svg` | 上游对应图标资源 | 2026-11-18 将 K 图标替换为本项目原创的「GX 玻璃质感」图标（由 star 设计）。当日先统一为纯 GX 玻璃字母版（透明底），后改为**GX 磨砂底板版**：白色圆角底板 + 蓝绿玻璃质感 G 字母 + 右下绿/粉双菱形，母版为 `icon-1024.png`（1024×1024 RGBA），全套 ICO/PNG/SVG 由它缩放生成；exe 内嵌 256px 图标经重编译同步（已逐像素校验与母版一致）。原 K 图标备份于 `source/original-icons/`，历史版本备份于 `source/original-icons/frosted-backup-20261118/` 与.workspace `backup/icons-before-frosted/`。`ui/atlas.png` 为功能插画精灵图，未改动。2026-11-18 追加：应用内首页顶部栏品牌名左侧的小 logo（`ui/app-icon.png`，由 `WindowChrome.cs` 以 `Asset(...,1,...)` 绘制）单独换回**纯透明底 GX 字母版**（256px，哈希 `3e0d4131…`），与 exe 内嵌/任务栏图标（磨砂版 `kaiwu.ico`）刻意区分：界面内 logo 透明清爽、系统层图标带底板更醒目。**2026-11-19 追加：全套图标统一替换为新版 GX 玻璃图标（由 star 设计）**——母版 `glass-duo8-xl-B-2048-t.png`（2048×2048 RGBA，透明底，圆角磨砂板 + 蓝绿玻璃 G + 橙/粉双菱形），由它缩放生成全套 ICO（16/24/32/48/64/128/256 七档）、PNG、内嵌 base64 SVG；首页 logo 与系统层图标此次不再区分，全部使用这一透明底新版。exe 内嵌 256px 图标经重编译同步，已逐像素校验与母版一致；`app/icon.svg` 内嵌图亦校验一致。历史版本备份于 `source/original-icons/duob-glass-backup-20261119/`。**2026-11-19 追加：图标文件统一更名** `kaiwu.ico` → `star.ico`（根目录、`ui/` 各一份），所有运行时引用（`build.ps1` 的 `/win32icon` 与复制、`HomeView.cs`、`DocumentWindow.cs`、`PrintWindow.cs`、`tests/BuildSmoke.cs`、`tools/package-release.ps1`、桌面快捷方式与 `sync-shortcut-icon.ps1`）同步改为 `star.ico`；exe 已重编译，内嵌 256px 图标经像素校验与新母版一致。`source/original-icons/` 下的历史备份保留原文件名以维持溯源。 |
| `source/*` | **新增** | 对应源码、改动补丁、重编译补丁与构建复现说明 |
| `NOTICE.md`、`SOURCE-OFFER.txt` | **新增** | 本通知与源码要约 |
| `helpers/contextmenu/`、`helpers/geek/`、`helpers/dism/`、`helpers/hongguo/`、`src/ToolServices.cs`、`documents/app/tools.html`、`documents/app/tools.js`、`documents/app/tools.css` | **新增/修改** | 工具页新增四个内置独立工具入口（右键菜单管理 / Geek 卸载 / Dism++ / 红果短剧），经 `toolLaunchContextMenu` 与白名单命令 `toolLaunchBundled`（仅接受固定 key，不接受外部路径）启动 `helpers/` 下随包程序。ContextMenuManager 为 GPL-3.0 开源工具（源码随附）；Geek / Dism++ / 红果为闭源专有程序，仅作聚合分发，见第 7 节 |

未改动的部分：`licenses/`、`ui/atlas.png`、全部 DLL 与 `libmpv-2.dll` 均与上游 Release 二进制一致（`helpers/` 目录在上游基础上新增了上表所列的随包工具）。上游 Release 原始包 SHA256 为 `905eca72b4cec435e99b0ce581b128ccdd344203df55726ff3df39aa0a4bfa39`。

完整的可复现构建工程（已回填编译依赖、已应用全部改动）位于随包 `source/build-ready/`，在其目录执行 `powershell -ExecutionPolicy Bypass -File build.ps1 -OutputDirectory dist` 即可从源码重建 `StarToolbox.exe`。

`source/host-openExternal.patch` 已应用至当前重编译版本；`source/REBRAND.md` 为品牌统一的完整清单与复现说明。

## 4. 完整对应源码（GPLv3 第 6 条）

分发本二进制时，接收者有权取得完整的 Corresponding Source。本分发包已在 `source/` 目录提供：

- `kaiwu-v0.4.4-src.tar.gz`：上游 v0.4.4 完整源码（含 `build.ps1`、`tools/setup-dependencies.ps1`、`tools/dependencies.json` 等构建脚本与依赖固定清单）。
- `star-toolbox-changes.patch`：本分发版对界面层的全部改动，可直接 `git apply`。
- `README-SOURCE.md`：逐字复现本二进制的构建步骤。
- `host-openExternal.patch`、`REBRAND.md`：可选的源码级补丁与品牌统一清单。

亦可从 <https://github.com/dls0412/kaiwu/tree/v0.4.4> 取得上游源码。更完整的书面要约见 `SOURCE-OFFER.txt`。

运行依赖（mpv、文档 WASM、WebView2 SDK、Lux、whisper.cpp 及可选语音模型）由上游 Release 单独分发并固定版本，其来源、许可与哈希见 `THIRD-PARTY.md`、上游 `tools/` 目录及 `documents/app/engine/manifest.json`；它们属于各自许可下的独立组件。Excel 拆分/合并为本分发版自研的原生 OOXML 处理（`src/ExcelOps.cs`），不引入任何第三方库，完全离线运行，不作网络请求。

## 5. 平台支持

当前二进制 **仅支持 Windows 10/11 x64**（需 .NET Framework 4.8 与 Microsoft Edge WebView2 Runtime）。上游为 C# / WinForms 应用，WebView2 Runtime 与 .NET Framework 4.8 均不提供 macOS 或 Linux 版本，因此本包 **不能在 macOS 或银河麒麟（Linux）原生运行**。`web/index.html` 提供的是不依赖上述运行时的纯浏览器入口层，仅覆盖在线工具与后续 Web 模块。

## 6. 保留文件清单（分发时不可删减）

`LICENSE.txt`、`THIRD-PARTY.md`、`licenses/`（全部第三方许可文本）、`NOTICE.md`、`SOURCE-OFFER.txt`、`src/`（本版完整 Electron 源码）。

银河麒麟 / Linux 版本版实际随包项：`src/**`、`package.json`、`build/icon.png`、上述合规文件。**不含**任何 Windows 专属内置工具或其二进制（详见本文件顶部版本说明）。

## 7. 随包第三方闭源工具与再分发提醒

> **不适用于本版**：银河麒麟 / Linux Electron 版**不随包分发**下列任何闭源工具，源码与打包产物中均无其二进制。本节仅保留为同一 GPL 衍生项目 Windows 版的历史声明。

工具页内置的 **Geek Uninstaller 1.6.0.200**、**Dism++ 10.1.1002.1**、**红果短剧播放器 1.2.29** 是**闭源专有程序**，由各自作者发布，不属于本应用的 GPL-3.0-or-later 授权范围，也不是本应用的衍生作品。本包以未经修改的独立二进制形式随包分发、按需作为独立进程启动（GPLv3 所称 "mere aggregation"），不附带、也无法附带其源码。

**个人使用 / 本机自用**：直接运行无碍。**对外公开发布含这些工具的整包前**，请注意：三者作者均未明确公开授权"可随其他软件捆绑再分发"。若需公开发布，建议改用"仅提供启动入口、由用户自行下载安装"的方式，或事先取得各作者授权。本分发版的 GPL 源码义务仅覆盖本应用自身代码与 GPL 组件（如 ContextMenuManager），不因聚合这些闭源工具而扩大。各工具来源与许可状态见 `THIRD-PARTY.md`。
