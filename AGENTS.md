# AGENTS.md

QuickTab 是一个轻量级 Chrome 标签页切换扩展，使用 Manifest V3 + 原生 JavaScript 开发，零依赖。

**核心功能**: Alt+Q 快捷键在最近访问的标签页间切换，类似 macOS AltTab 交互。

## Dev Commands

```bash
# 更新版本号：直接编辑 manifest.json 的 version 字段

# 推送代码，触发 CI
git push origin main
# origin: 远端名 | main: 主分支

# 创建并推送发布 tag，触发 Release workflow
git tag -a v1.0.5 -m "v1.0.5"
# -a: annotated tag（附注标签） | -m: message（标签说明）

git push origin v1.0.5
# origin: 远端名 | v1.0.5: 要推送的标签名
```

## Release Workflow (Agent)

提交并发版的完整流程：

```bash
# 1. 升版本号
#    编辑 manifest.json 的 version 字段（如 1.1.0 → 1.1.1）

# 2. 暂存相关文件（不要用 git add -A）
git add background.js content.css content.js popup.html popup.js manifest.json
# 只暂存本次改动涉及的文件

# 3. 提交
git commit -m "feat: 简要描述"

# 4. 打 tag
git tag -a v1.1.1 -m "v1.1.1"
# tag 名和 manifest.json version 保持一致，前缀 v

# 5. 推送代码 + tag
git push origin main
git push origin v1.1.1
# 推送 tag 会自动触发 Release workflow（打包 + 发布 GitHub Release + 上传 Chrome Web Store）
```

## Debugging

1. **Service Worker 日志**: `chrome://extensions/` → 点击扩展的「Service Worker」链接
2. **Content Script 日志**: 任意页面 → 开发者工具 → Console
3. **加载扩展**: `chrome://extensions/` → 开启「开发者模式」→「加载已解压的扩展程序」→ 选择项目根目录
4. **热更新**: 修改代码后在 `chrome://extensions/` 点击扩展刷新按钮

## Architecture

```
background.js (Service Worker)
├── 管理最近标签列表（最多 10 个，MAX_TABS 常量）
├── 使用 chrome.storage.session 存储（会话级，浏览器关闭自动清空）
├── 监听标签激活、关闭、更新事件
└── 处理快捷键命令和消息通信

content.js (Content Script)
├── 在所有页面注入（run_at: document_end）
├── 渲染 AltTab 风格切换面板
├── 键盘交互：方向键/Tab 循环，Enter 确认，ESC 取消
├── 连续按快捷键循环选择（通过 chrome.commands 触发）
└── 支持松开 Alt 键自动切换

content.css
└── 面板样式，淡入淡出动画
```

**数据流**:
```
Alt+Q → chrome.commands → background 发消息到 content
→ content 请求标签列表 → background 返回存储的标签
→ content 渲染面板 → 用户选择 → content 发切换请求
→ background 执行 chrome.tabs.update
```

## Code Style

- **零依赖**: 项目无任何 npm 依赖，纯原生实现
- **原生 JS**: 使用标准 DOM API 和 Chrome Extension API
- **模块化**: background.js 和 content.js 各司其职，通过 chrome.runtime 消息通信
- **CSS 隔离**: 所有样式使用 `#quicktab-` 前缀防止污染宿主页面

## Key Constraints

- **不可注入页面**: `chrome://`, `edge://`, `about:`, Chrome Web Store 页面
- **存储类型**: `chrome.storage.session`（非持久化，隐私优先）
- **最大标签数**: 10 个
- **快捷键**: 通过 `chrome.commands` API 处理，用户可在 `chrome://extensions/shortcuts` 自定义，连续按快捷键可循环切换

## File Structure

```
├── manifest.json          # Chrome 扩展清单（MV3），版本号唯一来源
├── background.js          # Service Worker
├── content.js             # Content Script
├── content.css            # 面板样式
└── icons/                 # 扩展图标
```

## Important Notes

1. **版本管理**: 直接编辑 `manifest.json` 的 `version` 字段
2. **发版**: 推送 `v*` tag 会运行 `.github/workflows/release.yml`，自动打包、创建 GitHub Release，并上传到 Chrome Web Store
4. **无本地构建脚本**: 当前仓库不维护 `build.sh`，默认开发流程是直接加载项目根目录
5. **无测试框架**: 项目暂无自动化测试，核心验证方式仍是浏览器手动验证
6. **Chrome API**: 所有 Chrome Extension API 调用在 background.js 中处理
