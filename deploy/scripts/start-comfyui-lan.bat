@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM 内网 Windows 启动 ComfyUI（无需 Nginx）
REM 其他电脑浏览器访问: http://本机IP:8188/rh/studio

cd /d "%~dp0..\.."

echo ========================================
echo  灵影平台 - 内网模式（无需 Nginx）
echo ========================================
echo.

echo 本机 IPv4 地址:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "IP=%%a"
  set "IP=!IP: =!"
  if not "!IP!"=="" echo   http://!IP!:8188/rh/studio
)
echo.
echo 常用入口:
echo   创作工坊  /rh/studio
echo   无限画布  /rh/canvas2
echo   ComfyUI   /comfy
echo.
echo 局域网打不开时: 以管理员运行 deploy\scripts\windows-firewall-8188.bat
echo ========================================
echo.

if exist "venv\Scripts\python.exe" (
  python main.py --listen 0.0.0.0 --port 8188 --multi-user
) else (
  python main.py --listen 0.0.0.0 --port 8188 --multi-user
)

pause
