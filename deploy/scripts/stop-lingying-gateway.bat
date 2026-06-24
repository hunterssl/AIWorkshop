@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "PORT=8080"
set "FOUND=0"

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
  set "FOUND=1"
  set "PID=%%p"
  echo [Gateway] Stopping PID !PID! on port %PORT%...
  taskkill /PID !PID! /F >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] Could not stop PID !PID!. Try running as admin.
    pause
    exit /b 1
  )
)

if "!FOUND!"=="0" (
  echo [Gateway] Port %PORT% is free. Nothing to stop.
) else (
  echo [Gateway] Stopped.
)

pause
