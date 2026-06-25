@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

set "PORT=8080"

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
for /f "usebackq delims=" %%i in (`node -e "const path=require('path');const c=require(process.argv[1]);process.stdout.write(path.resolve(process.argv[2], String(c.user_data_dir||'../../user')));" "%PROJECT_ROOT%\server\lingying.server.json" "%PROJECT_ROOT%\server" 2^>nul`) do set "USER_DATA_DIR=%%i"
if "%USER_DATA_DIR%"=="" set "USER_DATA_DIR=%PROJECT_ROOT%\studio_users\user"

cd /d "%PROJECT_ROOT%\server"

if not exist "lingying\app.py" (
  echo [ERROR] Gateway code not found. Current dir: %CD%
  pause
  exit /b 1
)

set "PY="
if exist "%COMFYUI_DIR%\.ext\python.exe" (
  set "PY=%COMFYUI_DIR%\.ext\python.exe"
) else if exist "%COMFYUI_DIR%\.ext\Scripts\python.exe" (
  set "PY=%COMFYUI_DIR%\.ext\Scripts\python.exe"
) else if exist "%COMFYUI_DIR%\venv\Scripts\python.exe" (
  set "PY=%COMFYUI_DIR%\venv\Scripts\python.exe"
) else if exist "%PROJECT_ROOT%\venv\Scripts\python.exe" (
  set "PY=%PROJECT_ROOT%\venv\Scripts\python.exe"
) else (
  set "PY=python"
)

echo Using Python: %PY%
"%PY%" -c "import sys; print(sys.executable)"
echo user_data_dir: %USER_DATA_DIR%

echo Stopping old gateway on port %PORT% if any...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
  echo   Found PID %%p, stopping...
  taskkill /PID %%p /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo ========================================
echo  Lingying Gateway LAN %PORT%
echo ========================================
echo.
echo Make sure ComfyUI is running on port 8188
echo Browser: http://127.0.0.1:%PORT%/rh/studio
echo.
echo Local IPv4 addresses:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "IP=%%a"
  set "IP=!IP: =!"
  if not "!IP!"=="" echo   Studio  http://!IP!:%PORT%/rh/studio
)
echo.
echo To stop gateway only: deploy\scripts\stop-lingying-gateway.bat
echo ========================================
echo.

"%PY%" -m pip install -q -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple --default-timeout=60
"%PY%" -m lingying

pause