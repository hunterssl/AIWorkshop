@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "PORT=8080"
set "FOUND=0"

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
  set "FOUND=1"
  set "PID=%%p"
  echo 结束占用 %PORT% 的进程 PID=!PID! ...
  taskkill /PID !PID! /F
)

if "%FOUND%"=="0" (
  echo 端口 %PORT% 当前未被占用
) else (
  echo 已停止工坊网关
)

pause
