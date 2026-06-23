@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "PORT=8080"
set "FOUND=0"

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
  set "FOUND=1"
  set "PID=%%p"
  echo [灵影] 端口 %PORT% 已被占用 PID=!PID!
  tasklist /FI "PID eq !PID!" /FO LIST | findstr /I "Image Name"
  echo.
  echo 若是上次未关干净的网关，将自动结束该进程...
  taskkill /PID !PID! /F >nul 2>&1
  if errorlevel 1 (
    echo [错误] 无法结束进程，请手动关闭占用 %PORT% 的程序后重试
    pause
    exit /b 1
  )
  echo [灵影] 已释放端口 %PORT%
  timeout /t 1 /nobreak >nul
)

cd /d "%~dp0..\..\server"

if not exist "lingying\app.py" (
  echo [错误] 找不到网关代码，当前目录: %CD%
  pause
  exit /b 1
)

set "PROJECT_ROOT=%~dp0..\.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"

set "COMFYUI_DIR="
for /f "usebackq delims=" %%i in (`node -e "const c=require(process.argv[1]);process.stdout.write(String(c.comfyuiRoot||'').trim())" "%PROJECT_ROOT%\config\paths.js" 2^>nul`) do set "COMFYUI_DIR=%%i"
if "%COMFYUI_DIR%"=="" (
  echo [错误] 无法从 config/paths.js 读取 comfyuiRoot
  pause
  exit /b 1
)

set "PY=%COMFYUI_DIR%\.ext\python.exe"

if not exist "%PY%" (
  echo [错误] 找不到 ComfyUI Python: %PY%
  pause
  exit /b 1
)


echo 使用 Python: %PY%
"%PY%" -c "import sys; print(sys.executable)"

echo ========================================
echo  灵影 - 工坊网关（内网 %PORT%）
echo ========================================
echo.
echo 请确保 ComfyUI 已在 8188 运行
echo 浏览器访问 http://本机IP:%PORT%/rh/studio
echo ========================================
echo.

"%PY%" -m lingying
pause
