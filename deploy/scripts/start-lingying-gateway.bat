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

set "PY=python"
if exist "..\..\venv\Scripts\python.exe" set "PY=..\..\venv\Scripts\python.exe"

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
