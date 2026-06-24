@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

set "PORT=8080"

cd /d "%~dp0..\..\server"

if not exist "lingying\app.py" (
  echo [ERROR] Gateway code not found. Current dir: %CD%
  pause
  exit /b 1
)

set "PY=python"
if exist "..\..\venv\Scripts\python.exe" set "PY=..\..\venv\Scripts\python.exe"

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
