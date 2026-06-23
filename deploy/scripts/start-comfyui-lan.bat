@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ComfyUI worker LAN mode (port 8188)
REM Studio UI runs on gateway port 8080 - see start-lingying-gateway.bat

REM 项目根目录（AIWorkshop）
set "PROJECT_ROOT=%~dp0..\..\"
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"

REM 通过 Node 读取 config/paths.js 里的 comfyuiRoot
set "COMFYUI_DIR="
pushd "%PROJECT_ROOT%" >nul 2>nul
for /f "usebackq delims=" %%i in (`node -e "const c=require('./config/paths.js');process.stdout.write(String(c.comfyuiRoot||'').trim())" 2^>nul`) do set "COMFYUI_DIR=%%i"
popd >nul 2>nul

if "%COMFYUI_DIR%"=="" (
  echo [错误] 未能从 config/paths.js 读取 comfyuiRoot
  echo [提示] 请检查 config/paths.js 是否存在并导出 comfyuiRoot
  pause
  exit /b 1
)

cd /d "%COMFYUI_DIR%"

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
REM 优先使用 ComfyUI 的 .ext 环境
if exist ".ext\python.exe" (
  set "PY=.ext\python.exe"
) else if exist ".ext\Scripts\python.exe" (
  set "PY=.ext\Scripts\python.exe"
) else if exist "venv\Scripts\python.exe" (
  set "PY=venv\Scripts\python.exe"
)
echo 使用 Python: %PY%
"%PY%" -c "import sys; print(sys.executable)"

"%PY%" main.py --listen 0.0.0.0 --port 8188 --multi-user --cpu

pause
