@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

REM ComfyUI worker LAN mode - port 8188
REM Studio UI runs on gateway port 8080 - see start-lingying-gateway.bat

cd /d "%~dp0..\..\.."

if not exist "main.py" (
  echo [ERROR] main.py not found. Current dir: %CD%
  pause
  exit /b 1
)

set "PORT=8188"
set "PY=python"
if exist "venv\Scripts\python.exe" set "PY=venv\Scripts\python.exe"

echo Stopping old ComfyUI on port %PORT% if any...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
  echo   Found PID %%p, stopping...
  taskkill /PID %%p /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo Checking Python dependencies (first run may take 1-2 minutes)...
"%PY%" -m pip install -q pyOpenSSL opencv-python-headless watchdog matplotlib deepdiff scikit-image compel "comfy-aimdo==0.4.10" imageio-ffmpeg -i https://pypi.tuna.tsinghua.edu.cn/simple --default-timeout=120
if errorlevel 1 (
  echo [WARN] Some packages failed to install. ComfyUI may still start.
)

echo.
echo Starting ComfyUI... first launch can take 3-10 minutes while plugins load.
echo Do not close this window until you see "Starting server".
echo.
echo ========================================
echo  Lingying - ComfyUI worker LAN %PORT%
echo ========================================
echo.
echo Local IPv4 addresses:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "IP=%%a"
  set "IP=!IP: =!"
  if not "!IP!"=="" echo   ComfyUI  http://!IP!:%PORT%
)
echo.
echo Browser: http://127.0.0.1:%PORT%
echo.
echo Start gateway on port 8080 separately:
echo   run deploy\scripts\start-lingying-gateway.bat
echo   then open http://YOUR_IP:8080/rh/studio
echo.
echo To stop ComfyUI only: deploy\scripts\stop-comfyui-lan.bat
echo If LAN cannot connect, run as admin:
echo   deploy\scripts\windows-firewall-8188.bat
echo ========================================
echo.

"%PY%" main.py --listen 0.0.0.0 --port %PORT% --multi-user --cpu

pause
