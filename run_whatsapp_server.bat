@echo off
title WakeGuard WhatsApp Server Proxy
echo ========================================================
echo       WakeGuard - Automated WhatsApp Proxy Server       
echo ========================================================
echo.
echo Starting Node.js backend environment...
cd wakeguard-server
call npm start
pause
