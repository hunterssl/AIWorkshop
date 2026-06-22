@echo off
chcp 65001 >nul

REM One-click LAN: ComfyUI 8188 + gateway 8080 (two windows)

cd /d "%~dp0"

echo 正在启动 ComfyUI 算力节点（8188）...
start "灵影-ComfyUI-8188" cmd /k "%~dp0start-comfyui-lan.bat"

timeout /t 3 /nobreak >nul

echo 正在启动工坊网关（8080）...
start "灵影-网关-8080" cmd /k "%~dp0start-lingying-gateway.bat"

echo.
echo 已打开两个窗口，浏览器访问:
echo   http://本机IP:8080/rh/studio
echo.
pause
