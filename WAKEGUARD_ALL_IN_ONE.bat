@echo off
title WakeGuard - ALL-IN-ONE System Launcher
color 0b

echo ========================================================
echo       WakeGuard - Full Powered Presentation System       
echo ========================================================
echo.
echo [1/3] Starting WhatsApp Proxy Server...
start "WhatsApp Server" cmd /c "cd wakeguard-server && npm start"

timeout /t 5 /nobreak > nul

echo [2/3] Starting Web Dashboard (Local Server)...
start "Web Dashboard" cmd /c "cd wakeguard-web && python -m http.server 8000"

timeout /t 3 /nobreak > nul

echo [3/3] Starting Localtunnel (Internet Bridge)...
echo [NOTE] Copy the link from this window and paste it into "Secret Settings" (pasha123)
start "Localtunnel" cmd /c "lt --port 3000"

timeout /t 5 /nobreak > nul

echo.
echo ========================================================
echo       All systems are spinning up!
echo ========================================================
echo.
echo [INFO] Opening Local Dashboard: http://localhost:8000
start http://localhost:8000

echo.
echo [INFO] To run the Desktop Detector (Python), type 'python drowsiness_detect.py' manually if needed.
echo.
echo Ready for presentation! Keep these windows open.
pause
