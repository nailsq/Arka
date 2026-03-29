@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo === Git: set user.name and user.email once on this PC ===
echo Name ^(e.g. as on GitHub^):
set /p GIT_USER_NAME=
echo Email:
set /p GIT_USER_EMAIL=

if "!GIT_USER_NAME!"=="" (
  echo Name cannot be empty.
  pause
  exit /b 1
)
if "!GIT_USER_EMAIL!"=="" (
  echo Email cannot be empty.
  pause
  exit /b 1
)

git config --global user.name "!GIT_USER_NAME!"
git config --global user.email "!GIT_USER_EMAIL!"
if errorlevel 1 (
  echo Failed to save. Is Git installed?
  pause
  exit /b 1
)

echo.
echo Done. Run deploy.bat again.
echo.
pause
