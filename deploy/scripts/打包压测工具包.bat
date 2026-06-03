@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PACK_DIR=%~dp0loadtest-pack"
set "ZIP_FILE=%~dp0灵影压测工具包.zip"

if not exist "%PACK_DIR%" (
  echo [错误] 找不到 loadtest-pack 目录
  pause
  exit /b 1
)

if exist "%ZIP_FILE%" del /f /q "%ZIP_FILE%"

powershell -NoProfile -Command "Compress-Archive -Path '%PACK_DIR%\*' -DestinationPath '%ZIP_FILE%' -Force"

if exist "%ZIP_FILE%" (
  echo.
  echo [成功] 已打包:
  echo   %ZIP_FILE%
  echo.
  echo 将此 zip 发给测试同事，解压后按 使用说明.txt 操作即可。
) else (
  echo [失败] 打包未成功
)

echo.
pause
