@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM 灵影 studio/chat 压力测试 — 每台电脑改 USER_ID 和 BASE_URL 后双击运行
cd /d "%~dp0..\.."

set "BASE_URL=http://127.0.0.1:8188"
set "USER_ID=%COMPUTERNAME%-test"
set "COUNT=10"
set "CONCURRENCY=1"

echo ========================================
echo  灵影创作工坊 压力测试
echo  服务器: %BASE_URL%
echo  用户ID: %USER_ID%
echo  任务数: %COUNT%  并发: %CONCURRENCY%
echo ========================================
echo.

if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe deploy\scripts\studio_load_test.py --base-url %BASE_URL% --user-id %USER_ID% --count %COUNT% --concurrency %CONCURRENCY% --name-contains 文生图
) else (
  python deploy\scripts\studio_load_test.py --base-url %BASE_URL% --user-id %USER_ID% --count %COUNT% --concurrency %CONCURRENCY% --name-contains 文生图
)

echo.
pause
