@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ComfyUI worker LAN mode (port 8188)
REM Studio UI runs on gateway port 8080 - see start-lingying-gateway.bat

cd /d "%~dp0..\..\.."

if not exist "main.py" (
  echo [错误] 找不到 main.py，当前目录: %CD%
  pause
  exit /b 1
)

echo ========================================
echo  灵影 - ComfyUI 算力节点（内网 8188）
echo ========================================
echo.
echo 本机 IPv4 地址:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "IP=%%a"
  set "IP=!IP: =!"
  if not "!IP!"=="" echo   ComfyUI  http://!IP!:8188
)
echo.
echo 工坊页面请另开网关（8080）:
echo   运行 deploy\scripts\start-lingying-gateway.bat
echo   然后访问 http://本机IP:8080/rh/studio
echo.
echo 局域网打不开时，管理员运行 deploy\scripts\windows-firewall-8188.bat
echo ========================================
echo.

set "PY=python"
if exist "venv\Scripts\python.exe" set "PY=venv\Scripts\python.exe"

"%PY%" main.py --listen 0.0.0.0 --port 8188 --multi-user --cpu

pause
