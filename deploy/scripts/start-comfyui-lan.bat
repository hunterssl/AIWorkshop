@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

REM ComfyUI worker LAN mode - port 8188
REM Studio UI runs on gateway port 8080 - see start-lingying-gateway.bat

set "PROJECT_ROOT=%~dp0..\..\"
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"

set "COMFYUI_DIR="
pushd "%PROJECT_ROOT%" >nul 2>nul
for /f "usebackq delims=" %%i in (`node -e "const c=require(process.argv[1]);process.stdout.write(String(c.comfyuiRoot||'').trim())" "%PROJECT_ROOT%\config\paths.js" 2^>nul`) do set "COMFYUI_DIR=%%i"
popd >nul 2>nul

if "%COMFYUI_DIR%"=="" (
  echo [ERROR] Failed to read comfyuiRoot from config/paths.js
  pause
  exit /b 1
)

set "USER_DATA_DIR="
set "INPUT_DIR="
set "OUTPUT_DIR="
for /f "usebackq tokens=1,2,3 delims=|" %%a in (`node -e "const fs=require('fs');const path=require('path');const cfgPath=process.argv[1];const base=process.argv[2];let c={};try{c=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch{}const user=path.resolve(base,String(c.user_data_dir||'../studio_users/user'));const root=path.dirname(user);const input=c.input_directory?path.resolve(base,String(c.input_directory)):path.join(root,'input');const output=c.output_directory?path.resolve(base,String(c.output_directory)):path.join(root,'output');process.stdout.write([user,input,output].join('|'));" "%PROJECT_ROOT%\server\lingying.server.json" "%PROJECT_ROOT%\server" 2^>nul`) do (
  set "USER_DATA_DIR=%%a"
  set "INPUT_DIR=%%b"
  set "OUTPUT_DIR=%%c"
)
if "%USER_DATA_DIR%"=="" set "USER_DATA_DIR=%PROJECT_ROOT%\studio_users\user"
if "%INPUT_DIR%"=="" set "INPUT_DIR=%PROJECT_ROOT%\studio_users\input"
if "%OUTPUT_DIR%"=="" set "OUTPUT_DIR=%PROJECT_ROOT%\studio_users\output"

cd /d "%COMFYUI_DIR%"

if not exist "main.py" (
  echo [ERROR] main.py not found. Current dir: %CD%
  pause
  exit /b 1
)

set "PORT=8188"
set "PY="
if exist "%COMFYUI_DIR%\.ext\python.exe" (
  set "PY=%COMFYUI_DIR%\.ext\python.exe"
) else if exist "%COMFYUI_DIR%\.ext\Scripts\python.exe" (
  set "PY=%COMFYUI_DIR%\.ext\Scripts\python.exe"
) else if exist "%COMFYUI_DIR%\venv\Scripts\python.exe" (
  set "PY=%COMFYUI_DIR%\venv\Scripts\python.exe"
) else (
  set "PY=python"
)

echo Using Python: %PY%
"%PY%" -c "import sys; print(sys.executable)"
echo user_data_dir: %USER_DATA_DIR%
echo input_directory: %INPUT_DIR%
echo output_directory: %OUTPUT_DIR%

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

set PYTORCH_CUDA_ALLOC_CONF=backend:cudaMallocAsync
"%PY%" main.py ^
 --listen 0.0.0.0^
 --port %PORT% ^
 --multi-user ^
 --enable-cors-header^
 --output-directory %OUTPUT_DIR%^
 --input-directory %INPUT_DIR%^
 --user-directory %USER_DATA_DIR%^
 --use-sage-attention

pause