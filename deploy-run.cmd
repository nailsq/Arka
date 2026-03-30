@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Arka deploy
echo Running deploy.bat from: %CD%
echo.
call deploy.bat
echo.
echo --- deploy.bat finished, exit code %ERRORLEVEL% ---
pause
