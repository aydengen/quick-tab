# QuickTab

一个尽量极简的 Chrome 标签页切换扩展。

QuickTab 做的事情只有一件：按 `Alt+Q` 打开最近标签列表，并切换到目标标签页。

## 使用

- `Alt+Q`：打开面板
- 按住 `Alt` 连续按 `Q`：向后循环选择
- `Tab` / `↑` / `↓` / `←` / `→`：移动选择
- 松开 `Alt`：切换到当前选中标签
- `Enter`：切换到当前选中标签
- `Esc`：关闭面板

快捷键可在 `chrome://extensions/shortcuts` 自定义。

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
- `storage`：保存最近标签列表（`chrome.storage.session`）

所有数据都只保存在本地会话中，关闭浏览器后自动清空。

## 发布

```bash
VERSION=$(sed -n 's/.*"version": "\(.*\)".*/\1/p' manifest.json)
mkdir -p releases
zip -qr "releases/quick-tab-v${VERSION}.zip" manifest.json background.js content.js content.css icons/icon_32.png icons/icon_36.png icons/icon_48.png icons/icon_128.png
```

修改代码后，在 `chrome://extensions/` 刷新扩展即可。

## 结构

- `manifest.json`：扩展配置
- `background.js`：最近标签记录和切换逻辑
- `content.js`：面板渲染和键盘交互
- `content.css`：面板样式
- `icons/`：扩展图标
