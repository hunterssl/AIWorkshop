@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "BASE_URL=http://127.0.0.1:8188"
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /i "BASE_URL=" "%~dp0config.txt" 2^>nul`) do (
  set "BASE_URL=%%b"
)

echo 正在查询: !BASE_URL!/rh/api/apps
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo 请安装 Python 后重试
  goto :end
)

python -c "import json,urllib.request; u='!BASE_URL!'.rstrip('/')+'/rh/api/apps?refresh=1'; d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'Accept':'application/json'}),timeout=30)); apps=d.get('apps') or []; print('共',len(apps),'个应用:\n'); [print(f\"  {a.get('id')}\t{a.get('name')}\t{a.get('studio_modes')}\") for a in apps]"

:end
echo.
pause
