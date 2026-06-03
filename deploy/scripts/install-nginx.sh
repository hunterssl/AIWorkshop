#!/usr/bin/env bash
# Ubuntu/Debian 一键安装 Nginx 并启用配置（在服务器上运行）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONF_SRC="$ROOT/deploy/nginx/lingying.conf"
CONF_DST="/etc/nginx/sites-available/lingying.conf"

if [[ ! -f "$CONF_SRC" ]]; then
  echo "找不到 $CONF_SRC"
  exit 1
fi

sudo apt update
sudo apt install -y nginx apache2-utils

sudo cp "$CONF_SRC" "$CONF_DST"
sudo ln -sf "$CONF_DST" /etc/nginx/sites-enabled/lingying.conf
sudo rm -f /etc/nginx/sites-enabled/default

echo "请编辑 $CONF_DST ：把 YOUR_DOMAIN 改成你的域名"
echo "然后运行: sudo bash deploy/scripts/gen-auth.sh admin"
echo "测试配置: sudo nginx -t && sudo systemctl reload nginx"
echo "HTTPS: sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d YOUR_DOMAIN"
