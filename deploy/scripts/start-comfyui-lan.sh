#!/usr/bin/env bash
# 内网 Linux 服务器启动 ComfyUI
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
LAN_IP="${LAN_IP:-本机IP}"

echo "========================================"
echo " 灵影平台 - 内网模式"
echo "========================================"
echo "局域网访问地址:"
echo "  http://${LAN_IP}:8188/rh/studio"
echo "  http://${LAN_IP}:8188/rh/canvas2"
echo "  http://${LAN_IP}:8188/comfy"
echo ""
echo "ComfyUI 监听 0.0.0.0:8188（仅内网使用时请确保未映射到公网）"
echo "========================================"

if [[ -f "$ROOT/venv/bin/python" ]]; then
  exec "$ROOT/venv/bin/python" main.py --listen 0.0.0.0 --port 8188
else
  exec python main.py --listen 0.0.0.0 --port 8188
fi
