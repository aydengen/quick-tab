# QuickTab

一个尽量极简的 Chrome 标签页切换扩展。

QuickTab 做的事情只有一件：按 `Alt+Q` 打开最近标签列表，并切换到目标标签页。

面板像 macOS 的 AltTab 一样，用每个标签的页面缩略图展示，跟随系统浅色/深色模式。

## 使用

- `Alt+Q`：打开面板
- 按住 `Alt` 连续按 `Q`：向后循环选择
- `←` / `→` / `Tab` / `J` / `K`：移动选择；`↑` / `↓`：按行移动
- 鼠标悬停选择，点击切换
- 松开 `Alt`（Mac 上是 `⌥`）：切换到当前选中标签
- 快速按一下 `Alt+Q`：直接切回上一个标签
- `Enter`：切换到当前选中标签
- `Esc`：关闭面板

在新标签页、`chrome://` 页面、PDF 等无法显示面板的页面上，`Alt+Q` 会直接切回上一个标签。

快捷键可在 `chrome://extensions/shortcuts` 自定义。

## 设置

点击工具栏中的 QuickTab 图标：

- **Sticky panel mode**：面板保持打开，不需要一直按住 `Alt`，用 `Enter` 确认
- **Show non-switchable tabs**：在列表中显示 `chrome://`、Web Store 等受限页面

## 安装

### Chrome Web Store

https://chromewebstore.google.com/detail/quicktab/pmagocpnoedekbpchligfnhkimheklaj

### 从源码加载

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录

## 权限

- `tabs`：读取标签页标题和图标，并切换标签页
- `storage`：保存最近标签列表（`chrome.storage.session`）和设置
- `activeTab` + `scripting`：安装或更新前已打开的页面，按快捷键时补注入面板脚本，无需刷新
- 所有网站（`<all_urls>`）：截取当前可见标签的缩略图（`chrome.tabs.captureVisibleTab`）
- `favicon`：读取 Chrome 缓存的网站图标

缩略图只能在标签可见时截取：标签停留约 0.5 秒、加载完成或打开面板时更新。扩展启动后还没看过的标签显示网站图标。

面板渲染在封闭的 Shadow DOM 中，网页脚本读不到你的其他标签信息；无痕窗口和普通窗口的标签互不显示。

所有数据（包括缩略图）都只保存在本地会话中，关闭浏览器后自动清空。

## 开发

修改代码后，在 `chrome://extensions/` 刷新扩展即可。

## 发布

1. 修改 `manifest.json` 的 `version`。
2. 提交并推送到 `main`，触发 CI 检查。
3. 创建并推送同版本 tag，例如：

```bash
git tag -a v1.1.1 -m "v1.1.1"
# -a: annotated tag（附注标签） | -m: message（标签说明）

git push origin v1.1.1
# origin: 远端名 | v1.1.1: 要推送的标签名
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
- `scripts/package.sh`：打包和校验
- `icons/`：扩展图标
