#!/usr/bin/env node
/**
 * 构建脚本 - 打包 Chrome 扩展
 * 
 * 用法:
 *   node scripts/build.js        # 仅复制文件到 dist/
 *   node scripts/build.js --zip  # 复制文件并生成 zip
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const RELEASE_DIR = path.join(ROOT_DIR, 'releases');

// 需要打包的文件
const FILES_TO_COPY = [
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'LICENSE',
  'README.md',
];

// 需要打包的文件夹
const DIRS_TO_COPY = [
  'icons',
];

/**
 * 清理并创建目录
 */
function ensureDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * 复制文件
 */
function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`  ✓ ${path.relative(ROOT_DIR, src)}`);
}

/**
 * 递归复制目录
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

/**
 * 创建 ZIP 文件
 */
async function createZip(sourceDir, outPath) {
  const archiver = require('archiver');

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      const size = (archive.pointer() / 1024).toFixed(2);
      console.log(`\n📦 已生成: ${path.relative(ROOT_DIR, outPath)} (${size} KB)`);
      resolve();
    });

    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

/**
 * 获取版本号
 */
function getVersion() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf-8')
  );
  return manifest.version;
}

/**
 * 主函数
 */
async function main() {
  const shouldZip = process.argv.includes('--zip');
  const version = getVersion();

  console.log(`\n🚀 构建 QuickTab v${version}\n`);

  // 清理并创建 dist 目录
  ensureDir(DIST_DIR);
  console.log('📁 复制文件到 dist/:\n');

  // 复制文件
  for (const file of FILES_TO_COPY) {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(DIST_DIR, file);

    if (fs.existsSync(srcPath)) {
      copyFile(srcPath, destPath);
    } else {
      console.warn(`  ⚠ 文件不存在: ${file}`);
    }
  }

  // 复制目录
  for (const dir of DIRS_TO_COPY) {
    const srcPath = path.join(ROOT_DIR, dir);
    const destPath = path.join(DIST_DIR, dir);

    if (fs.existsSync(srcPath)) {
      copyDir(srcPath, destPath);
    } else {
      console.warn(`  ⚠ 目录不存在: ${dir}`);
    }
  }

  // 创建 ZIP
  if (shouldZip) {
    if (!fs.existsSync(RELEASE_DIR)) {
      fs.mkdirSync(RELEASE_DIR, { recursive: true });
    }

    const zipName = `quick-tab-v${version}.zip`;
    const zipPath = path.join(RELEASE_DIR, zipName);

    await createZip(DIST_DIR, zipPath);
  }

  console.log('\n✅ 构建完成!\n');
}

main().catch(err => {
  console.error('❌ 构建失败:', err);
  process.exit(1);
});
