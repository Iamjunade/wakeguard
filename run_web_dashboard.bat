@echo off
title WakeGuard Web Dashboard Launcher
echo ========================================================
echo       WakeGuard - Web Dashboard Local Server
echo ========================================================
echo.
echo [INFO] Starting local web server on port 8000...
echo [INFO] Close this window to stop the server.
echo.
echo Opening browser: http://localhost:8000
echo.

start http://localhost:8000

cd wakeguard-web
python -m http.server 8000
pause
