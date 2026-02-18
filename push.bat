@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Git Push ===
echo.
git add -A
git status
echo.
git commit -m "Super admin: separate crown icon + ADMIN badge, admin management by username"
echo.
git push
echo.
echo === Done! ===
pause
