# Chrome 扩展自动化部署指南

本文档详细介绍如何为 Chrome 扩展配置自动化 CI/CD 流程，实现：
- 推送代码自动构建验证
- 推送 Tag 自动创建 GitHub Release
- 推送 Tag 自动发布到 Chrome Web Store

## 目录

- [1. 项目结构](#1-项目结构)
- [2. 本地开发命令](#2-本地开发命令)
- [3. GitHub Actions 配置](#3-github-actions-配置)
- [4. Chrome Web Store API 授权](#4-chrome-web-store-api-授权)
- [5. GitHub Secrets 配置](#5-github-secrets-配置)
- [6. 发布流程](#6-发布流程)
- [7. 常见问题](#7-常见问题)

---

## 1. 项目结构

```
your-extension/
├── .github/
│   └── workflows/
│       ├── ci.yml          # CI 持续集成
│       └── release.yml     # 自动发布
├── scripts/
│   ├── build.js            # 构建脚本
│   └── bump-version.js     # 版本管理
├── releases/               # 构建产物 (git ignored)
├── dist/                   # 构建目录 (git ignored)
├── package.json
├── manifest.json
└── ...
```

---

## 2. 本地开发命令

```bash
# 安装依赖
pnpm install

# 构建到 dist/ 目录
pnpm build

# 构建并生成 zip 包
pnpm build:zip

# 更新版本号
pnpm version:patch   # 1.0.0 → 1.0.1
pnpm version:minor   # 1.0.0 → 1.1.0
pnpm version:major   # 1.0.0 → 2.0.0
```

---

## 3. GitHub Actions 配置

### 3.1 CI 工作流 (`.github/workflows/ci.yml`)

每次推送到 `main` 分支或创建 PR 时自动运行：
- 验证 `manifest.json` 格式
- 构建扩展并生成 zip

### 3.2 Release 工作流 (`.github/workflows/release.yml`)

推送 `v*` 格式的 Tag 时自动运行：
- 构建扩展
- 创建 GitHub Release（附带 zip 下载）
- （可选）发布到 Chrome Web Store

**关键配置：**

```yaml
permissions:
  contents: write  # 必须！允许创建 Release

on:
  push:
    tags:
      - 'v*'  # 只在推送 tag 时触发
```

---

## 4. Chrome Web Store API 授权

### 4.1 创建 Google Cloud 项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择已有项目
3. 搜索并启用 **Chrome Web Store API**

### 4.2 创建 OAuth 凭据

1. 进入 **APIs & Services → Credentials**
2. 点击 **Create Credentials → OAuth client ID**
3. 配置 OAuth 同意屏幕（如果还没有）：
   - User Type: **External**
   - 填写应用名称和邮箱
4. 创建 OAuth Client ID：
   - Application type: **Web application**
   - 名称: `Chrome Web Store Publisher`
   - Authorized redirect URIs 添加：
     ```
     https://developers.google.com/oauthplayground
     ```
5. 记录 **Client ID** 和 **Client Secret**

### 4.3 获取 Refresh Token

1. 访问 [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)

2. 点击右上角 **⚙️ 设置图标**：
   - 勾选 **Use your own OAuth credentials**
   - 输入 Client ID 和 Client Secret

3. 在左侧 **Step 1** 输入框中输入 scope：
   ```
   https://www.googleapis.com/auth/chromewebstore
   ```

4. 点击 **Authorize APIs** → 登录 Google 账号授权

5. 在 **Step 2** 点击 **Exchange authorization code for tokens**

6. 复制返回的 **Refresh token**

### 4.4 获取扩展 ID

在 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 中：
- 上传你的扩展（首次需要手动上传）
- 扩展 ID 在 URL 中：`https://chrome.google.com/webstore/devconsole/.../items/EXTENSION_ID`

---

## 5. GitHub Secrets 配置

### 5.1 添加 Secrets

进入 GitHub 仓库 **Settings → Secrets and variables → Actions → Secrets**

点击 **New repository secret**，添加以下 4 个：

| Name | Value |
|------|-------|
| `CHROME_EXTENSION_ID` | 你的扩展 ID |
| `CHROME_CLIENT_ID` | OAuth Client ID |
| `CHROME_CLIENT_SECRET` | OAuth Client Secret |
| `CHROME_REFRESH_TOKEN` | 从 OAuth Playground 获取的 Refresh Token |

### 5.2 添加 Variable（启用开关）

进入 **Settings → Secrets and variables → Actions → Variables**

点击 **New repository variable**：

| Name | Value |
|------|-------|
| `ENABLE_CHROME_PUBLISH` | `true` |

---

## 6. 发布流程

### 6.1 发布新版本

```bash
# 1. 更新版本号
pnpm version:patch

# 2. 同步 manifest.json 版本（脚本自动处理）

# 3. 提交更改
git add .
git commit -m "chore: bump version to 1.0.x"

# 4. 推送代码
git push origin main

# 5. 创建并推送 tag
git tag v1.0.x
git push origin v1.0.x
```

### 6.2 自动化流程

推送 tag 后，GitHub Actions 会自动：

```
推送 tag (v1.0.x)
    ↓
GitHub Actions 触发
    ↓
构建扩展 → 生成 zip
    ↓
创建 GitHub Release (附带 zip)
    ↓
发布到 Chrome Web Store (如果启用)
```

### 6.3 手动触发

也可以在 GitHub Actions 页面手动触发：
1. 进入 **Actions** 标签
2. 选择 **Release** 工作流
3. 点击 **Run workflow**
4. 输入版本号，点击运行

---

## 7. 常见问题

### Q: GitHub Release 创建失败，报 403 错误

**原因：** 工作流缺少写入权限

**解决：** 在 `release.yml` 顶部添加：
```yaml
permissions:
  contents: write
```

### Q: Chrome Web Store 发布被跳过 (Skipped)

**检查项：**
1. 是否通过 **tag** 触发（不是普通 push）
2. 是否配置了 `ENABLE_CHROME_PUBLISH` Variable 为 `true`
3. 是否配置了所有 4 个 Secrets

### Q: 本地无法连接 Google API

**原因：** 网络问题，需要代理

**解决：** 设置代理环境变量：
```bash
export https_proxy=http://127.0.0.1:7890
```

### Q: OAuth Playground 报错 "redirect_uri not registered"

**解决：** 在 Google Cloud Console 的 OAuth 凭据中添加：
```
https://developers.google.com/oauthplayground
```
到 Authorized redirect URIs，保存后等待 1-2 分钟生效。

### Q: Refresh Token 获取失败 (OOB flow blocked)

**原因：** Google 已弃用 OOB 流程

**解决：** 使用 OAuth 2.0 Playground 获取，不要使用本地脚本的 `urn:ietf:wg:oauth:2.0:oob` 方式。

---

## 参考链接

- [Chrome Web Store API 文档](https://developer.chrome.com/docs/webstore/using-api)
- [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [chrome-webstore-upload-cli](https://www.npmjs.com/package/chrome-webstore-upload-cli)
