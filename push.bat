@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Git Push ===
echo.
git add -A
git status
echo.
git commit -m "Super admin with crown badge, admin management by username, mobile-optimized admin panel"
echo.
git push
echo.
echo === Done! ===
pause
