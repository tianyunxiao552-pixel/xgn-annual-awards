@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing_node
if not defined XGN_LAUNCH_PORT set "XGN_LAUNCH_PORT=4174"
node scripts\launch.mjs
if errorlevel 1 goto failed
exit /b 0
:missing_node
echo Please install Node.js 24 or newer, then run this file again.
pause
exit /b 1
:failed
echo.
echo XGN could not start. Please read the error above.
pause
exit /b 1
