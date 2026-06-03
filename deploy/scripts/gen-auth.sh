#!/usr/bin/env bash
# 生成 Nginx 登录账号（对外部署必做）
# 用法: sudo bash deploy/scripts/gen-auth.sh admin
set -euo pipefail

USER_NAME="${1:-admin}"
OUT="/etc/nginx/lingying.htpasswd"

if ! command -v htpasswd >/dev/null 2>&1; then
  echo "请先安装 apache2-utils (Ubuntu: apt install apache2-utils)"
  exit 1
fi

sudo mkdir -p "$(dirname "$OUT")"
if [[ -f "$OUT" ]]; then
  sudo htpasswd "$OUT" "$USER_NAME"
else
  sudo htpasswd -c "$OUT" "$USER_NAME"
fi

echo "已写入 $OUT ，重启 Nginx: sudo systemctl reload nginx"
