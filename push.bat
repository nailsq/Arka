@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Git Push ===
echo.
git add -A
git status
echo.
git commit -m "Admin: full mobile optimization with bottom nav, card layouts, bottom-sheet modals"
echo.
git push
echo.
echo === Done! ===
pause
