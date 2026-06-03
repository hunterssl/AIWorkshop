@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   灵影平台 - 批量压力测试
echo   请先编辑 config.txt 中的服务器地址和用户名
echo ========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 Python。请安装 Python 3.8 或更高版本并勾选 Add to PATH。
  echo 下载: https://www.python.org/downloads/
  goto :end
)

python --version
echo.
python "%~dp0studio_load_test.py"
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE%==0 (
  echo [完成] 全部任务成功，结果见 results 文件夹
) else (
  echo [完成] 部分任务失败或超时，请查看上方日志和 results 文件夹
)

:end
echo.
pause
exit /b %EXIT_CODE%
