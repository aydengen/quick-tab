#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# 读取 manifest.json 版本号
VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": "\(.*\)".*/\1/')

# 清理并创建 dist/
rm -rf dist && mkdir -p dist releases

# 复制文件到 dist/
cp manifest.json background.js content.js content.css LICENSE README.md dist/
cp -r icons dist/

# 生成 zip（如果传入 --zip 参数）
if [[ "$1" == "--zip" ]]; then
    cd dist
    zip -r "../releases/quick-tab-v${VERSION}.zip" .
    echo "Created releases/quick-tab-v${VERSION}.zip"
fi

echo "Build complete: dist/"
