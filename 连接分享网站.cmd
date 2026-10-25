@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
node scripts\connect-cloudflare.mjs
echo.
pause
