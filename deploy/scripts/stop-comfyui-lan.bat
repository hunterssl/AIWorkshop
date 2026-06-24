@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "PORT=8188"
set "FOUND=0"

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
  set "FOUND=1"
  set "PID=%%p"
  echo [ComfyUI] Port %PORT% is used by PID !PID!
  tasklist /FI "PID eq !PID!" /FO LIST | findstr /I "Image Name"
  echo.
  echo Stopping old ComfyUI process...
  taskkill /PID !PID! /F >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] Could not stop PID !PID!. Try closing the window manually or run as admin.
    pause
    exit /b 1
  )
  echo [ComfyUI] Stopped PID !PID!
)

if "!FOUND!"=="0" (
  echo [ComfyUI] Port %PORT% is free. Nothing to stop.
) else (
  timeout /t 2 /nobreak >nul
)

pause
