@echo off
chcp 65001 >nul

REM One-click LAN: ComfyUI 8188 + gateway 8080

cd /d "%~dp0"

echo Starting ComfyUI worker on 8188...
start "Lingying-ComfyUI-8188" cmd /k "%~dp0start-comfyui-lan.bat"

timeout /t 3 /nobreak >nul

echo Starting studio gateway on 8080...
start "Lingying-Gateway-8080" cmd /k "%~dp0start-lingying-gateway.bat"

echo.
echo Two windows opened. Open in browser:
echo   http://127.0.0.1:8080/rh/studio
echo.
pause
