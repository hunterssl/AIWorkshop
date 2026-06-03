@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   灵影平台 - 快速连通测试（仅 1 条任务）
echo ========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 Python，请先安装 Python 3.8+
  goto :end
)

python "%~dp0studio_load_test.py" --count 1 --concurrency 1
set EXIT_CODE=%ERRORLEVEL%

:end
echo.
pause
exit /b %EXIT_CODE%
