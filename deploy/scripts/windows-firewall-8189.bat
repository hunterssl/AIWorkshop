@echo off
chcp 65001 >nul
REM 一次性放行 8189 端口（需右键「以管理员身份运行」）

net session >nul 2>&1
if errorlevel 1 (
  echo 请右键此文件，选择「以管理员身份运行」
  pause
  exit /b 1
)

netsh advfirewall firewall delete rule name="ComfyUI Lingying 8189" >nul 2>&1
netsh advfirewall firewall add rule name="ComfyUI Lingying 8189" dir=in action=allow protocol=TCP localport=8189

if errorlevel 1 (
  echo 添加规则失败
  pause
  exit /b 1
)

echo 已放行 TCP 8189 入站
echo 局域网可访问: http://你的IP:8189/rh/studio
pause
