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

- 生成发布 zip
- 创建 GitHub Release
- 上传到 Chrome Web Store

本地不再维护单独的构建脚本，也不需要手动打包作为日常流程。

## 结构

- `manifest.json`：扩展配置
- `background.js`：最近标签记录和切换逻辑
- `content.js`：面板渲染和键盘交互
- `content.css`：面板样式
- `icons/`：扩展图标
