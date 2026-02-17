@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === ARKA STUDIO FLOWERS ===
echo.
echo Deleting old database...
if exist arka.db del arka.db
echo Installing dependencies...
call npm install
echo.
echo Seeding database...
call node seed.js
echo.
echo Done!
echo Run "node server.js" to start the server.
echo Admin panel: http://localhost:3000/admin
echo.
pause
