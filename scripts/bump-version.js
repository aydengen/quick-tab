#!/usr/bin/env node
/**
 * 版本号管理脚本
 * 
 * 用法:
 *   node scripts/bump-version.js patch  # 1.0.0 -> 1.0.1
 *   node scripts/bump-version.js minor  # 1.0.0 -> 1.1.0
 *   node scripts/bump-version.js major  # 1.0.0 -> 2.0.0
 *   node scripts/bump-version.js 1.2.3  # 设置为指定版本
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');
const PACKAGE_PATH = path.join(ROOT_DIR, 'package.json');

/**
 * 解析版本号
 */
function parseVersion(version) {
  const parts = version.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

/**
 * 递增版本号
 */
function bumpVersion(currentVersion, type) {
  const v = parseVersion(currentVersion);

  switch (type) {
    case 'major':
      return `${v.major + 1}.0.0`;
    case 'minor':
      return `${v.major}.${v.minor + 1}.0`;
    case 'patch':
      return `${v.major}.${v.minor}.${v.patch + 1}`;
    default:
      // 如果是具体版本号，直接返回
      if (/^\d+\.\d+\.\d+$/.test(type)) {
        return type;
      }
      throw new Error(`无效的版本类型: ${type}`);
  }
}

/**
 * 更新 JSON 文件中的版本号
 */
function updateJsonFile(filePath, newVersion) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ 文件不存在: ${path.basename(filePath)}`);
    return;
  }

  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  content.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`  ✓ ${path.basename(filePath)}`);
}

/**
 * 主函数
 */
function main() {
  const type = process.argv[2];

  if (!type) {
    console.error('用法: node scripts/bump-version.js <patch|minor|major|x.y.z>');
    process.exit(1);
  }

  // 读取当前版本
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const currentVersion = manifest.version;

  // 计算新版本
  const newVersion = bumpVersion(currentVersion, type);

  console.log(`\n📌 版本更新: ${currentVersion} → ${newVersion}\n`);
  console.log('更新文件:');

  // 更新 manifest.json 和 package.json
  updateJsonFile(MANIFEST_PATH, newVersion);
  updateJsonFile(PACKAGE_PATH, newVersion);

  console.log(`\n✅ 版本已更新为 ${newVersion}\n`);

  return newVersion;
}

main();
