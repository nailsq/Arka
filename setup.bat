@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === ARKA STUDIO FLOWERS ===
echo.
if exist arka.db del arka.db
call npm install
call node seed.js
echo.
echo Starting server...
call node server.js
