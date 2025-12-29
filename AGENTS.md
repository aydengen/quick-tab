# AGENTS.md

QuickTab 是一个轻量级 Chrome 标签页切换扩展，使用 Manifest V3 + 原生 JavaScript 开发，零依赖。

**核心功能**: Alt+Q 快捷键在最近访问的标签页间切换，类似 macOS AltTab 交互。

## Dev Commands

```bash
# 构建扩展到 dist/
./scripts/build.sh

# 构建并生成发布用 zip 包
./scripts/build.sh --zip

# 更新版本号：直接编辑 manifest.json 的 version 字段
```

## Debugging

1. **Service Worker 日志**: `chrome://extensions/` → 点击扩展的「Service Worker」链接
2. **Content Script 日志**: 任意页面 → 开发者工具 → Console
3. **加载扩展**: `chrome://extensions/` → 开启「开发者模式」→「加载已解压的扩展程序」→ 选择项目根目录或 `dist/`
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
├── icons/                 # 扩展图标
├── scripts/
│   └── build.sh           # Shell 构建脚本
├── dist/                  # 构建输出（勿直接修改）
└── releases/              # zip 包输出
```

## Important Notes

1. **版本管理**: 直接编辑 `manifest.json` 的 `version` 字段
2. **构建产物**: `dist/` 目录是构建输出，不要直接修改
3. **无测试框架**: 项目暂无自动化测试，需手动在浏览器中验证功能
4. **Chrome API**: 所有 Chrome Extension API 调用在 background.js 中处理
