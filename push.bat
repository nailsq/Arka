@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Git Push ===
echo.
git add -A
git status
echo.
git commit -m "Persistent storage: GitHub Gist backup + images in DB, no data loss on deploy"
echo.
git push
echo.
echo === Done! ===
pause
