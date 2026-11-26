#!/usr/bin/env bash
# 打包扩展 zip（取已提交的文件，排除 .gitattributes 中 export-ignore 的开发文件），
# 并校验 manifest / HTML / JS 引用到的本地文件都在包里。
# 用法: scripts/package.sh [输出路径]，默认 releases/quick-tab.zip
set -euo pipefail
cd "$(dirname "$0")/.."

out="${1:-releases/quick-tab.zip}"
mkdir -p "$(dirname "$out")"
rm -f "$out"
git archive --format=zip -o "$out" HEAD

packed=$(unzip -Z1 "$out")
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
unzip -q "$out" -d "$work"

refs=$(
  {
    jq -r '[.. | strings | select(test("^[A-Za-z0-9_./-]+\\.(js|css|html|png|json)$"))] | .[]' "$work/manifest.json"
    grep -hoE "[\"'][A-Za-z0-9_./-]+\.(js|css|html|png)[\"']" "$work"/*.js "$work"/*.html 2>/dev/null | tr -d "\"'"
  } | sort -u
)

missing=0
for ref in $refs; do
  if ! grep -qxF "$ref" <<<"$packed"; then
    echo "❌ $ref 被引用但不在 $out 中" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || exit 1

echo "✅ $out"
echo "$packed" | sed 's/^/  /'
