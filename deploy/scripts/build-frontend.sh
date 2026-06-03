#!/usr/bin/env bash
# 部署前构建前端（创作工坊静态文件 + 火宝画布）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/studio/comfy"

echo "[1/2] 构建画布 /rh/canvas2 ..."
npm ci
npm run build

echo "[2/2] 创作工坊 index/app.js/styles.css 无需 build，已在 studio/ 目录"
echo "完成。重启 ComfyUI 后生效。"
