# QuickTab

一个尽量极简的 Chrome 标签页切换扩展。

QuickTab 做的事情只有一件：按 `Alt+Q` 打开最近标签列表，并切换到目标标签页。

面板像 macOS 的 AltTab 一样，最多显示 10 张最近标签页的缩略图卡片（含当前标签页），底部没有快捷键提示栏。卡片优先按原尺寸排成一行，空间不足时尝试两行或三行；仍放不下时，选择能让卡片显示得最大的排法并整体等比缩小。面板跟随系统浅色/深色模式。

[官网（中文）](https://aydengen.github.io/quick-tab/) · [Website (English)](https://aydengen.github.io/quick-tab/en/) · [隐私政策](https://aydengen.github.io/quick-tab/privacy.html) · [Privacy Policy](https://aydengen.github.io/quick-tab/en/privacy.html)

## 使用

首次安装时会自动打开快速入门指南，显示当前设置的快捷键，并可打开练习标签页，试着用快捷键切回指南。也可以跳过练习，或稍后从工具栏菜单重新打开指南。

- `Alt+Q`：打开面板
- 按住 `Alt` 连续按 `Q`：向后循环选择
- 面板打开时按 `Alt+Shift+Q`：向前循环选择
- `→` / `Tab` / `J`：向后选择；`←` / `Shift+Tab` / `K`：向前选择；多行时 `↑` / `↓` 切换行
- 鼠标悬停选择，点击切换
- 松开 `Alt`（Mac 上是 `⌥`）：切换到当前选中标签（未开启 Sticky 模式时）
- 快速按一下 `Alt+Q`：直接切回上一个标签（未开启 Sticky 模式时）
- `Enter`：切换到当前选中标签
- `Esc`：关闭面板

在新标签页、`chrome://` 页面、PDF 等无法显示面板的页面上，`Alt+Q` 会直接切回上一个标签。

快捷键可在 `chrome://extensions/shortcuts` 自定义。如果新快捷键不含 `Alt`，用 `Enter` 或点击卡片确认切换。

## 设置

点击工具栏中的 QuickTab 图标：

- **Sticky panel mode**：面板保持打开，不需要一直按住 `Alt`，用 `Enter` 确认
- **Show non-switchable tabs**：把 `chrome://`、Chrome Web Store 等受限页面加入列表；可以从面板切换到这些页面，但无法在这些页面上打开面板
- **Quick start guide**：重新打开快速入门指南

## 安装

当前源码版本为 1.3.0（Manifest V3），需要 Chrome 116 或更高版本。

### Chrome Web Store

[在 Chrome Web Store 查看 QuickTab](https://chromewebstore.google.com/detail/quicktab/pmagocpnoedekbpchligfnhkimheklaj)。商店版本以页面显示为准；若新版仍在审核，可以先从源码加载。

### 从源码加载

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录

## 权限与隐私

- `tabs`：读取标签页标题、网址和图标，供面板显示与切换使用
- `storage`：在本机保存最近标签列表、缩略图和扩展设置
- `activeTab` + `scripting`：安装或更新前已打开的页面，按快捷键时补注入面板脚本，无需刷新
- 所有网站（`<all_urls>`）：在普通网页上显示切换面板，并截取当前可见标签的缩略图（`chrome.tabs.captureVisibleTab`）
- `favicon`：读取 Chrome 缓存的网站图标

缩略图只在标签页加载完成、且位于当前聚焦窗口并可见时截取。切到标签页或页面加载完成后，扩展会等约 0.5 秒再尝试截图；打开面板前也可能补截。没有可用缩略图时，卡片显示网站图标；没有网站图标时显示通用图标。

面板渲染在封闭的 Shadow DOM 中，网页脚本读不到你的其他标签信息；无痕窗口和普通窗口的标签互不显示。

最近标签列表和缩略图保存在本机的 `chrome.storage.session` 中，关闭浏览器后自动清空；设置保存在本机的 `chrome.storage.local` 中，重启浏览器后仍保留。扩展不会上传这些数据。详见[隐私政策](https://aydengen.github.io/quick-tab/privacy.html)，也可阅读[仓库内的双语版本](PRIVACY.md)。

## 开发

修改代码后，在 `chrome://extensions/` 刷新扩展即可。

## 官网

官网源码位于 `docs/`：中英文介绍、可交互的标签切换演示、安装入口、常见问题和隐私政策。纯静态 HTML / CSS / JavaScript，无需依赖或构建；网页演示不读取真实标签页，也不加载第三方资源。

本地预览：在仓库根目录运行 `python3 -m http.server 8000 --directory docs`，然后打开 `http://localhost:8000`。

### GitHub Pages 部署

1. 在 [仓库的 Pages 设置](https://github.com/aydengen/quick-tab/settings/pages)中，将 **Build and deployment → Source** 设为 **GitHub Actions**（首次需要仓库管理员设置）。
2. 合并官网 PR 到 `main`。`.github/workflows/pages.yml` 会检查官网资源并仅发布 `docs/`；也可在 Actions 中手动运行 **Website** workflow。
3. 部署至 [QuickTab 官网](https://aydengen.github.io/quick-tab/)。官网 PR 只做检查，不会发布。

官网演示展示新版缩略图界面；应用商店版本可能尚未包含全部新功能。网站与扩展发布流程独立，不需要创建版本 tag，也不会改变扩展代码或权限。`docs/.gitattributes` 将官网文件排除在 `git archive` 扩展包之外。

## 发布

1. 修改 `manifest.json` 的 `version`。
2. 提交并推送到 `main`，触发 CI 检查。
3. 读取 `manifest.json` 中的新版本号，创建并推送同版本 tag：

```bash
version=$(jq -r '.version' manifest.json)
git tag -a "v$version" -m "v$version"
git push origin "v$version"
```

4. GitHub Actions 的 `Release` workflow 会自动：

- 用 `scripts/package.sh` 生成发布 zip（并校验引用的文件都已打包）
- 创建 GitHub Release
- 上传到 Chrome Web Store

推送到 `main` 或提交 PR 时，`CI` workflow 会做语法检查和打包校验。本地可以运行 `scripts/package.sh` 检查打包结果（基于已提交的文件）。

## 结构

- `manifest.json`：扩展配置
- `background.js`：最近标签记录和切换逻辑
- `content.js`：面板渲染和键盘交互
- `content.css`：面板样式（加载到 Shadow DOM）
- `popup.html` / `popup.js` / `popup.css`：设置弹窗
- `onboarding.html` / `onboarding.js` / `onboarding.css` / `practice.html`：快速入门指南与练习页
- `scripts/package.sh`：打包和校验
- `icons/`：扩展图标
